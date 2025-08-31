import { WebGPUUtils } from '../../utils/webgpu-utils';
import { DiffusionBuffers, PhysarumBuffers } from '../../types/webgpu';
import { physarumMovementShader, physarumDiffusionShader, physarumVertexShader, physarumFragmentShader } from './physarumShaders';
import { GPUResourceManager } from '@/utils/gpu-resource-manager';

export class PhysarumSimulation {
   private animationId: number | null = null;
   private resourceManager = new GPUResourceManager();
   private numParticles: number = 102400;

   async init(): Promise<void> {
      const canvas = document.getElementById('physarum-canvas') as HTMLCanvasElement;
      if (!canvas) return;

      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;

      const webgpu = await WebGPUUtils.initWebGPU('physarum-canvas');
      if (!webgpu) return;

      const { device, context, canvasFormat } = webgpu;

      const movementShaderModule = WebGPUUtils.createShaderModule(
         device,
         physarumMovementShader(this.numParticles),
         'PhysarumMovement'
      );

      const diffusionShaderModule = WebGPUUtils.createShaderModule(
         device,
         physarumDiffusionShader(),
         'PhysarumDiffusion'
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

      const physarumBindGroupLayout = device.createBindGroupLayout({
         entries: [
            {
               binding: 0,
               visibility: GPUShaderStage.COMPUTE | GPUShaderStage.FRAGMENT,
               buffer: {
                  type: "storage",
               },
            },
            {
               binding: 1,
               visibility: GPUShaderStage.COMPUTE | GPUShaderStage.FRAGMENT,
               buffer: {
                  type: "storage",
               },
            },
         ],
         label: 'ParticleBindGroupLayout'
      });

      const pipelineLayout = device.createPipelineLayout({
         bindGroupLayouts: [
            physarumBindGroupLayout,
            physarumBindGroupLayout
         ],
         label: 'PipelineLayout'
      });

      const movementPipeline = device.createComputePipeline({
         label: 'PhysarumMovementPipeline',
         layout: pipelineLayout,
         compute: {
            module: movementShaderModule,
            entryPoint: 'cs',
         },
      });

      const diffusionPipeline = device.createComputePipeline({
         label: 'PhysarumDiffusionPipeline',
         layout: pipelineLayout,
         compute: {
            module: diffusionShaderModule,
            entryPoint: 'cs',
         },
      });

      const renderPipeline = device.createRenderPipeline({
         label: 'PhysarumRenderPipeline',
         layout: pipelineLayout,
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

      this.resourceManager.registerPipeline(movementPipeline);
      this.resourceManager.registerPipeline(diffusionPipeline);
      this.resourceManager.registerPipeline(renderPipeline);

      const diffusionArrayData = this.createDiffusionArrayData(canvas.width, canvas.height);
      const particleData = this.createPhysarumArrayData(canvas.width, canvas.height, this.numParticles);
      const diffusionBuffers = this.initDiffusionArrays(device, diffusionArrayData, canvas.width, canvas.height);
      const particleBuffers = this.initPhysarumArrays(device, particleData, this.numParticles);


      const diffusionBindGroup = device.createBindGroup({
         layout: physarumBindGroupLayout,
         entries: [
            { binding: 0, resource: { buffer: diffusionBuffers.diffusionArrayCurrent } },
            { binding: 1, resource: { buffer: diffusionBuffers.diffusionArrayNew } },
         ],
         label: "diffusionBindGroup"
      });
      const particleBindGroup = device.createBindGroup({
         layout: physarumBindGroupLayout,
         entries: [
            { binding: 0, resource: { buffer: particleBuffers.particlePositionData } },
            { binding: 1, resource: { buffer: particleBuffers.particleDirectionData } },
         ],
         label: "particleBindGroup"
      });

      this.resourceManager.registerBindGroup(diffusionBindGroup);
      this.resourceManager.registerBindGroup(particleBindGroup);

      this.startRenderLoop(device, context, movementPipeline, diffusionPipeline, renderPipeline, diffusionBindGroup, particleBindGroup, canvas);
   }

   private startRenderLoop(device: GPUDevice, context: GPUCanvasContext, movementPipeline: GPUComputePipeline, diffusionPipeline: GPUComputePipeline, renderPipeline: GPURenderPipeline, diffusionBindGroup: GPUBindGroup, particleBindGroup: GPUBindGroup, canvas: HTMLCanvasElement) {
      const render = () => {
         const commandEncoder = device.createCommandEncoder();

         const movementPass = commandEncoder.beginComputePass();
         movementPass.setPipeline(movementPipeline);
         movementPass.setBindGroup(0, diffusionBindGroup);
         movementPass.setBindGroup(1, particleBindGroup);
         movementPass.dispatchWorkgroups(Math.ceil(this.numParticles / 64), 1);
         movementPass.end();

         const diffusionPass = commandEncoder.beginComputePass();
         diffusionPass.setPipeline(diffusionPipeline);
         diffusionPass.setBindGroup(0, diffusionBindGroup);
         diffusionPass.setBindGroup(1, particleBindGroup);
         diffusionPass.dispatchWorkgroups(Math.ceil(canvas.width / 16), Math.ceil(canvas.height / 4));
         diffusionPass.end();

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
         renderPass.setBindGroup(0, diffusionBindGroup);
         renderPass.setBindGroup(1, particleBindGroup);
         renderPass.draw(6);
         renderPass.end();

         device.queue.submit([commandEncoder.finish()]);

         this.animationId = requestAnimationFrame(render);
      }
      render();
   }


   private createDiffusionArrayData(width: number, height: number): BufferSource {
      const arrayData = Array(width * height).fill(0.0);

      return new Float32Array(arrayData);
   }

   private createPhysarumArrayData(width: number, height: number, numParticle: number): [BufferSource, BufferSource] {
      const particlePositionData = Array.from(
         { length: numParticle },
         () => [Math.random() * width, Math.random() * height]
      );

      const particleDirectionData = Array.from(
         { length: numParticle },
         () => Math.random() * 2 * Math.PI
      );

      return [new Float32Array(particlePositionData.flat()), new Float32Array(particleDirectionData)];
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

   private initPhysarumArrays(device: GPUDevice, particleData: [BufferSource, BufferSource], numParticles: number): PhysarumBuffers {
      const createBuffer = (label: string, size: number) => {
         const buffer = device.createBuffer({
            size: numParticles * size * 4,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST, label
         });

         return this.resourceManager.registerBuffer(buffer);
      };

      const buffers: PhysarumBuffers = {
         particlePositionData: createBuffer('particlePositionArray', 2),
         particleDirectionData: createBuffer('particleDirectionArray', 1),
      };

      Object.values(buffers).forEach((buffer, index) => {
         device.queue.writeBuffer(buffer, 0, particleData[index]);
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
