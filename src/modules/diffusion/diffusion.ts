import { WebGPUUtils } from '../../utils/webgpu-utils';
import { DiffusionBuffers } from '../../types/webgpu';
import { diffusionComputeShader, diffusionVertexShader, diffusionFragmentShader } from './diffusionShaders';
import { GPUResourceManager } from '@/utils/gpu-resource-manager';

export class DiffusionSimulation {
   private animationId: number | null = null;
   private isDrawing = false;
   private resourceManager = new GPUResourceManager();
   private mouseEventCleanup: (() => void)[] = [];

   async init(): Promise<void> {
      const canvas = document.getElementById('diffusion-canvas') as HTMLCanvasElement;
      if (!canvas) return;

      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;

      const webgpu = await WebGPUUtils.initWebGPU('diffusion-canvas');
      if (!webgpu) return;

      const { device, context, canvasFormat } = webgpu;

      const computeShaderModule = WebGPUUtils.createShaderModule(
         device,
         diffusionComputeShader(),
         'diffusionCompute'
      );
      const vertexShaderModule = WebGPUUtils.createShaderModule(
         device,
         diffusionVertexShader(),
         'diffusionVertex'
      );
      const fragmentShaderModule = WebGPUUtils.createShaderModule(
         device,
         diffusionFragmentShader(),
         'diffusionFragment'
      );

      const computePipeline = device.createComputePipeline({
         layout: 'auto',
         compute: {
            module: computeShaderModule,
            entryPoint: 'cs',
         },
      });
      const renderPipeline = device.createRenderPipeline({
         label: 'DiffusionRenderPipeline',
         layout: 'auto',
         vertex: {
            module: vertexShaderModule,
            entryPoint: 'vs',
         },
         fragment: {
            module: fragmentShaderModule,
            entryPoint: 'fs',
            targets: [{ format: canvasFormat }],
         },
         primitive: {
            topology: 'triangle-list',
         },
      });

      this.resourceManager.registerPipeline(computePipeline);
      this.resourceManager.registerPipeline(renderPipeline);

      const diffusionArrayData = this.createDiffusionArrayData(canvas.width, canvas.height, 8, 2.0);
      const buffers = this.initDiffusionArrays(device, diffusionArrayData, canvas.width, canvas.height);

      const computeBindGroup = device.createBindGroup({
         layout: computePipeline.getBindGroupLayout(0),
         entries: [
            { binding: 0, resource: { buffer: buffers.diffusionArrayCurrent } },
            { binding: 1, resource: { buffer: buffers.diffusionArrayNew } },
         ],
      });
      const renderBindGroup = device.createBindGroup({
         layout: renderPipeline.getBindGroupLayout(0),
         entries: [
            { binding: 0, resource: { buffer: buffers.diffusionArrayCurrent } },
            { binding: 1, resource: { buffer: buffers.diffusionArrayNew } },
         ],
      });

      this.resourceManager.registerBindGroup(computeBindGroup);
      this.resourceManager.registerBindGroup(renderBindGroup);

      this.setupMouseEvents(canvas, device, buffers.diffusionArrayCurrent);
      this.startRenderLoop(device, context, computePipeline, renderPipeline, computeBindGroup, renderBindGroup, canvas);
   }

   private setupMouseEvents(canvas: HTMLCanvasElement, device: GPUDevice, diffusionArrayCurrent: GPUBuffer) {
      const handleMouseMove = (event: MouseEvent) => {
         if (this.isDrawing) {
            let index = event.clientY * canvas.width + event.clientX - Math.floor(canvas.width / 2);
            const newDiffusion = new Float32Array(1);
            newDiffusion[0] = 1.0;
            device.queue.writeBuffer(diffusionArrayCurrent, index * 4, newDiffusion);
         }
      };
      const handleMouseDown = () => {
         this.isDrawing = !this.isDrawing;
      };

      canvas.addEventListener('mousemove', handleMouseMove);
      canvas.addEventListener('mousedown', handleMouseDown);

      this.mouseEventCleanup.push(
         () => canvas.removeEventListener('mousemove', handleMouseMove),
         () => canvas.removeEventListener('mousedown', handleMouseDown),
      );
   }

   private startRenderLoop(device: GPUDevice, context: GPUCanvasContext, computePipeline: GPUComputePipeline, renderPipeline: GPURenderPipeline, computeBindGroup: GPUBindGroup, renderBindGroup: GPUBindGroup, canvas: HTMLCanvasElement) {
      const render = () => {
         const commandEncoder = device.createCommandEncoder();

         const computePass = commandEncoder.beginComputePass();
         computePass.setPipeline(computePipeline);
         computePass.setBindGroup(0, computeBindGroup);
         computePass.dispatchWorkgroups(Math.ceil(canvas.width / 16), Math.ceil(canvas.height / 4));
         computePass.end();

         const renderPassDescriptor: GPURenderPassDescriptor = {
            colorAttachments: [{
               view: context.getCurrentTexture().createView(),
               clearValue: { r: 0, g: 0, b: 0, a: 1.0 },
               loadOp: 'clear',
               storeOp: 'store',
            }],
         };

         const renderPass = commandEncoder.beginRenderPass(renderPassDescriptor);
         renderPass.setPipeline(renderPipeline);
         renderPass.setBindGroup(0, renderBindGroup);
         renderPass.draw(6);
         renderPass.end();

         device.queue.submit([commandEncoder.finish()]);

         this.animationId = requestAnimationFrame(render);
      }
      render();
   }

   private createDiffusionArrayData(width: number, height: number, radius: number, val: number): BufferSource {
      const arrayData = Array(width * height).fill(0.0);

      for (let i = -radius; i < radius; i++) {
         for (let j = -radius; j < radius; j++) {
            if (i * i + j * j > radius * radius) continue;

            const index = (i + Math.floor(height / 2)) * width + j + width;
            if (index >= 0 && index < arrayData.length) {
               arrayData[index] = val;
            }
         }
      }

      return new Float32Array(arrayData);
   }

   private initDiffusionArrays(device: GPUDevice, arrayData: BufferSource, width: number, height: number): DiffusionBuffers {
      const createBuffer = (label: string) => {
         const buffer = device.createBuffer({
            size: width * height * 4,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST, label
         });

         return this.resourceManager.registerBuffer(buffer);
      };

      const buffers: DiffusionBuffers = {
         diffusionArrayCurrent: createBuffer('diffusionArrayCurrent'),
         diffusionArrayNew: createBuffer('diffusionArrayNew'),
      };

      Object.values(buffers).forEach(buffer => {
         device.queue.writeBuffer(buffer, 0, arrayData);
      });

      return buffers;
   }

   destroy(): void {
      console.log("Destroying DiffusionSimulation resources...");

      if (this.animationId) {
         cancelAnimationFrame(this.animationId);
         this.animationId = null;
      }

      this.mouseEventCleanup.forEach(cleanup => cleanup());
      this.mouseEventCleanup.length = 0;

      this.resourceManager.destroy();

      const resourceCount = this.resourceManager.getResourceCount();
      console.log('DiffusionSimulation cleanup complete:', resourceCount);
   }
}
