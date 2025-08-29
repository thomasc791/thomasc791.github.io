import { WebGPUUtils } from '../../utils/webgpu-utils';
import { DiffusionBuffers } from '../../types/webgpu';
import { diffusionComputeShader, diffusionVertexShader, diffusionFragmentShader } from './diffusionShaders';

export class DiffusionSimulation {
   private animationId: number | null = null;
   private isDrawing = false;

   async init(): Promise<void> {
      const canvas = document.getElementById('diffusion-canvas') as HTMLCanvasElement;
      if (!canvas) return;

      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;

      const webgpu = await WebGPUUtils.initWebGPU('diffusion-canvas');
      if (!webgpu) return;

      const { device, context, canvasFormat } = webgpu;

      // Create shaders
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

      // Create pipelines
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

      // Initialize diffusion data and buffers
      const diffusionArrayData = this.createDiffusionArrayData(canvas.width, canvas.height, 8, 2.0);
      const buffers = this.initDiffusionArrays(device, diffusionArrayData, canvas.width, canvas.height);

      // Create bind groups
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

      this.setupMouseEvents(canvas, device, buffers.diffusionArrayCurrent);
      this.startRenderLoop(device, context, computePipeline, renderPipeline, computeBindGroup, renderBindGroup, canvas);
   }

   private setupMouseEvents(canvas: HTMLCanvasElement, device: GPUDevice, diffusionArrayCurrent: GPUBuffer) {
      canvas.addEventListener("mousemove", (event) => {
         if (this.isDrawing) {
            let index = event.clientY * canvas.width + event.clientX - Math.floor(canvas.width / 2);
            const newDiffusion = new Float32Array(1);
            newDiffusion[0] = 1.0;
            device.queue.writeBuffer(diffusionArrayCurrent, index * 4, newDiffusion);
         }
      })

      canvas.addEventListener("mousedown", (_) => { this.isDrawing = !this.isDrawing; });
   }

   private startRenderLoop(device: GPUDevice, context: GPUCanvasContext, computePipeline: GPUComputePipeline, renderPipeline: GPURenderPipeline, computeBindGroup: GPUBindGroup, renderBindGroup: GPUBindGroup, canvas: HTMLCanvasElement) {
      function render() {
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

         requestAnimationFrame(render);
      }
      requestAnimationFrame(render)
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
      const createBuffer = () => device.createBuffer({
         size: width * height * 4,
         usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST,
      });

      const buffers: DiffusionBuffers = {
         diffusionArrayCurrent: createBuffer(),
         diffusionArrayNew: createBuffer(),
      };

      Object.values(buffers).forEach(buffer => {
         device.queue.writeBuffer(buffer, 0, arrayData);
      });

      return buffers;
   }

   destroy(): void {
      if (this.animationId) {
         cancelAnimationFrame(this.animationId);
         this.animationId = null;
      }
   }
}
