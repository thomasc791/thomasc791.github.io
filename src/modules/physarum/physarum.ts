import { WebGPUUtils } from '../../utils/webgpu-utils';
import { DiffusionBuffers, PhysarumBuffers, SettingsBuffers } from '../../types/webgpu';
import { ShaderLoader } from '@/utils/shader-loader';
import { GPUResourceManager } from '@/utils/gpu-resource-manager';
import { MouseTracker } from '@/utils/mouse-tracker';

export class PhysarumSimulation {
   private animationId: number | null = null;
   private mouseTracker: MouseTracker = new MouseTracker();
   private resourceManager = new GPUResourceManager();
   private numParticles: number = 1024000 / 2;
   private settingsData: [Float32Array, Float32Array, Float32Array];
   private startTime: number = Date.now();

   public constructor() {
      this.settingsData = this.createSettingsData();
   }

   async init(): Promise<void> {
      const canvas = document.getElementById('physarum-canvas') as HTMLCanvasElement;
      if (!canvas) return;

      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;

      this.mouseTracker.setResolution(canvas.width, canvas.height);

      const webgpu = await WebGPUUtils.initWebGPU('physarum-canvas');
      if (!webgpu) return;

      const { device, context, canvasFormat } = webgpu;

      const replacements = {
         'RESOLUTION_HEIGHT': canvas.height,
         'RESOLUTION_WIDTH': canvas.width,
         'NUM_PARTICLES': this.numParticles,
      };

      const [movementShaderCode, diffusionShaderCode, vertexShaderCode, fragmentShaderCode] = await Promise.all([
         ShaderLoader.loadShader('physarum/movement', replacements),
         ShaderLoader.loadShader('physarum/diffuse', replacements),
         ShaderLoader.loadShader('physarum/vertex', replacements),
         ShaderLoader.loadShader('physarum/fragment', replacements),
      ])

      const movementShaderModule = WebGPUUtils.createShaderModule(
         device,
         movementShaderCode,
         'PhysarumMovement'
      );

      const diffusionShaderModule = WebGPUUtils.createShaderModule(
         device,
         diffusionShaderCode,
         'PhysarumDiffusion'
      );

      const vertexShaderModule = WebGPUUtils.createShaderModule(
         device,
         vertexShaderCode,
         'PhysarumVertex'
      );

      const fragmentShaderModule = WebGPUUtils.createShaderModule(
         device,
         fragmentShaderCode,
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

      const settingsBindGroupLayout = device.createBindGroupLayout({
         entries: [
            {
               binding: 0,
               visibility: GPUShaderStage.COMPUTE | GPUShaderStage.FRAGMENT,
               buffer: {
                  type: "uniform",
               },
            },
            {
               binding: 1,
               visibility: GPUShaderStage.COMPUTE | GPUShaderStage.FRAGMENT,
               buffer: {
                  type: "uniform",
               },
            },
         ],
         label: 'settingsBindGroupLayout'
      });

      const pipelineLayout = device.createPipelineLayout({
         bindGroupLayouts: [
            physarumBindGroupLayout,
            physarumBindGroupLayout,
            settingsBindGroupLayout
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
      const settingsBuffers = this.initSettingsData(device, this.settingsData);


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
      const settingsBindGroup = device.createBindGroup({
         layout: settingsBindGroupLayout,
         entries: [
            { binding: 0, resource: { buffer: settingsBuffers.settings } },
            { binding: 1, resource: { buffer: settingsBuffers.time } },
         ],
         label: "settingsBindGroup"
      });

      this.resourceManager.registerBindGroup(diffusionBindGroup);
      this.resourceManager.registerBindGroup(particleBindGroup);
      this.resourceManager.registerBindGroup(settingsBindGroup);

      this.startRenderLoop(device, context, movementPipeline, diffusionPipeline, renderPipeline, diffusionBindGroup, particleBindGroup, settingsBindGroup, settingsBuffers, canvas);
   }

   private updateSettings(device: GPUDevice, settingsBuffer: SettingsBuffers): void {
      let settings = this.mouseTracker.getSettings();
      settings[0] *= Math.PI / 180;
      settings[1] *= Math.PI / 180;

      settings.forEach((v, i) => {
         this.settingsData[0][i] = v;
      });
      this.settingsData[1][0] = (Date.now() - this.startTime) / 1000;

      device.queue.writeBuffer(settingsBuffer.settings, 0, new Float32Array(this.settingsData[0]));
      device.queue.writeBuffer(settingsBuffer.time, 0, new Float32Array(this.settingsData[1]));
   }

   private startRenderLoop(device: GPUDevice, context: GPUCanvasContext, movementPipeline: GPUComputePipeline, diffusionPipeline: GPUComputePipeline, renderPipeline: GPURenderPipeline, diffusionBindGroup: GPUBindGroup, particleBindGroup: GPUBindGroup, settingsBindGroup: GPUBindGroup, settingsBuffer: SettingsBuffers, canvas: HTMLCanvasElement) {

      const render = () => {
         const commandEncoder = device.createCommandEncoder();

         const movementPass = commandEncoder.beginComputePass();
         movementPass.setPipeline(movementPipeline);
         movementPass.setBindGroup(0, diffusionBindGroup);
         movementPass.setBindGroup(1, particleBindGroup);
         movementPass.setBindGroup(2, settingsBindGroup);
         this.updateSettings(device, settingsBuffer);
         movementPass.dispatchWorkgroups(Math.ceil(this.numParticles / 64), 1);
         movementPass.end();

         const diffusionPass = commandEncoder.beginComputePass();
         diffusionPass.setPipeline(diffusionPipeline);
         diffusionPass.setBindGroup(0, diffusionBindGroup);
         diffusionPass.setBindGroup(1, particleBindGroup);
         diffusionPass.setBindGroup(2, settingsBindGroup);
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
         renderPass.setBindGroup(2, settingsBindGroup);
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
         () => [1 + Math.random() * (width - 2), Math.random() * height]
      );

      const particleDirectionData = Array.from(
         { length: numParticle },
         () => Math.random() * 2 * Math.PI
      );

      return [new Float32Array(particlePositionData.flat()), new Float32Array(particleDirectionData)];
   }

   private createSettingsData(): [Float32Array, Float32Array, Float32Array] {
      var settings = new Float32Array(4).fill(0);
      var time = new Float32Array(4).fill(0);
      var resolution = new Float32Array([window.innerWidth, window.innerHeight]);

      return [settings, time, resolution];
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

   private initSettingsData(device: GPUDevice, arrayData: [Float32Array, Float32Array, Float32Array]): SettingsBuffers {
      const createBuffer = (label: string) => {
         const buffer = device.createBuffer({
            size: 4 * 4,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST, label
         });

         return this.resourceManager.registerBuffer(buffer);
      };

      const buffers: SettingsBuffers = {
         settings: createBuffer('settingsData'),
         time: createBuffer('time'),
         resolution: createBuffer('resolution'),
      };

      Object.values(buffers).forEach((buffer, index) => {
         device.queue.writeBuffer(buffer, 0, new Float32Array(arrayData[index]));
      });

      return buffers;
   }

   destroy(): void {
      console.log("Destroying PhysarumSimulation resources...");

      if (this.animationId) {
         cancelAnimationFrame(this.animationId);
         this.animationId = null;
      }

      this.mouseTracker.destroy();
      this.resourceManager.destroy();

      const resourceCount = this.resourceManager.getResourceCount();
      console.log('PhysarumSimulation cleanup complete:', resourceCount);
   }
}
