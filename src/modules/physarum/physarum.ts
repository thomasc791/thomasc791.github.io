import { WebGPUUtils } from '../../utils/webgpu-utils';
import { PhysarumBuffers } from '../../types/webgpu';
import { physarumComputeShader, physarumVertexShader, physarumFragmentShader } from './physarumShaders';
import { GPUResourceManager } from '@/utils/gpu-resource-manager';

export class PhysarumSimulation {
   private animationId: number | null = null;
   private resourceManager = new GPUResourceManager();

   async init(): Promise<void> {
      const canvas = document.getElementById('physarum-canvas') as HTMLCanvasElement;
      if (!canvas) return;

      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;

      const webgpu = await WebGPUUtils.initWebGPU('physarum-canvas');
      if (!webgpu) return;

      const { device, context, canvasFormat } = webgpu;

      // Create shaders
      const computeShaderModule = WebGPUUtils.createShaderModule(
         device,
         physarumComputeShader(),
         'PhysarumCompute'
      );

      const vertexShaderModule = WebGPUUtils.createShaderModule(
         device,
         physarumVertexShader(),
         'PhysarumVertex'
      );

      const fragmentShaderModule = WebGPUUtils.createShaderModule(
         device,
         physarumFragmentShader(),
         'PhysarumFragment'
      );

      const computePipeline = device.createComputePipeline({
         layout: 'auto',
         compute: {
            module: computeShaderModule,
            entryPoint: 'cs',
         },
      });
      const renderPipeline = device.createRenderPipeline({
         label: 'PhysarumRenderPipeline',
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

      const physarumArrayData = this.createPhysarumArrayData(canvas.width, canvas.height, 8, 2.0);
      const buffers = this.initPhysarumArrays(device, physarumArrayData, canvas.width, canvas.height);

      const computeBindGroup = device.createBindGroup({
         layout: computePipeline.getBindGroupLayout(0),
         entries: [
            { binding: 0, resource: { buffer: buffers.physarumArrayCurrent } },
            { binding: 1, resource: { buffer: buffers.physarumArrayNew } },
         ],
      });
      const renderBindGroup = device.createBindGroup({
         layout: renderPipeline.getBindGroupLayout(0),
         entries: [
            { binding: 0, resource: { buffer: buffers.physarumArrayCurrent } },
            { binding: 1, resource: { buffer: buffers.physarumArrayNew } },
         ],
      });

      this.resourceManager.registerBindGroup(computeBindGroup);
      this.resourceManager.registerBindGroup(renderBindGroup);

      this.startRenderLoop(device, context, computePipeline, renderPipeline, computeBindGroup, renderBindGroup, canvas);
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


   private createPhysarumArrayData(width: number, height: number, radius: number, val: number): BufferSource {
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

   private initPhysarumArrays(device: GPUDevice, arrayData: BufferSource, width: number, height: number): PhysarumBuffers {
      const createBuffer = (label: string) => {
         const buffer = device.createBuffer({
            size: width * height * 4,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST, label
         });

         return this.resourceManager.registerBuffer(buffer);
      };

      const buffers: PhysarumBuffers = {
         physarumArrayCurrent: createBuffer('physarumArrayCurrent'),
         physarumArrayNew: createBuffer('physarumArrayNew'),
      };

      Object.values(buffers).forEach(buffer => {
         device.queue.writeBuffer(buffer, 0, arrayData);
      });

      return buffers;
   }

   destroy(): void {
      console.log("Destroying PhysarumSimulation resources...");

      if (this.animationId) {
         cancelAnimationFrame(this.animationId);
         this.animationId = null;
      }

      this.resourceManager.destroy();

      const resourceCount = this.resourceManager.getResourceCount();
      console.log('PhysarumSimulation cleanup complete:', resourceCount);
   }
}
