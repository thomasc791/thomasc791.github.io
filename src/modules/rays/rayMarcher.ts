import { WebGPUUtils } from '../../utils/webgpu-utils';
import { SettingsBuffers } from '../../types/webgpu';
import { GPUResourceManager } from '@/utils/gpu-resource-manager';
import { MouseTracker } from '@/utils/mouse-tracker';
import { ShaderLoader } from '@/utils/shader-loader';

export class RayMarcherSimulation {
   private animationId: number | null = null;
   private mouseTracker: MouseTracker = new MouseTracker();
   private resourceManager = new GPUResourceManager();
   private settingsData: [Float32Array, Float32Array, Float32Array];
   // private startTime: number = Date.now();

   public constructor() {
      this.settingsData = this.createSettingsData();
   }

   async init(): Promise<void> {
      const canvas = document.getElementById('ray-canvas') as HTMLCanvasElement;
      if (!canvas) return;

      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;

      this.mouseTracker.setResolution(canvas.width, canvas.height);

      const webgpu = await WebGPUUtils.initWebGPU('ray-canvas');
      if (!webgpu) return;

      const { device, context, canvasFormat } = webgpu;

      const replacements = {
         'RESOLUTION_WIDTH': canvas.width,
         'RESOLUTION_HEIGHT': canvas.height,
      };

      const [_computeShaderCode, vertexShaderCode, fragmentShaderCode] = await Promise.all([
         ShaderLoader.loadShader('rays/compute', replacements),
         ShaderLoader.loadShader('rays/vertex'),
         ShaderLoader.loadShader('rays/fragment', replacements),
      ])

      // const rayMarcherShaderModule = WebGPUUtils.createShaderModule(
      //    device,
      //    computeShaderCode,
      //    'rayMarcher'
      // );

      const vertexShaderModule = WebGPUUtils.createShaderModule(
         device,
         vertexShaderCode,
         'rayMarcherVertex'
      );

      const fragmentShaderModule = WebGPUUtils.createShaderModule(
         device,
         fragmentShaderCode,
         'rayMarcherFragment'
      );

      // const rayMarcherBindGroupLayout = device.createBindGroupLayout({
      //    entries: [
      //       {
      //          binding: 0,
      //          visibility: GPUShaderStage.COMPUTE | GPUShaderStage.FRAGMENT,
      //          buffer: {
      //             type: "storage",
      //          },
      //       },
      //       {
      //          binding: 1,
      //          visibility: GPUShaderStage.COMPUTE | GPUShaderStage.FRAGMENT,
      //          buffer: {
      //             type: "storage",
      //          },
      //       },
      //    ],
      //    label: 'ParticleBindGroupLayout'
      // });

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
            {
               binding: 2,
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
            settingsBindGroupLayout
         ],
         label: 'PipelineLayout'
      });

      // const rayMarcherPipeline = device.createComputePipeline({
      //    label: 'rayMarcherPipeline',
      //    layout: pipelineLayout,
      //    compute: {
      //       module: rayMarcherShaderModule,
      //       entryPoint: 'cs',
      //    },
      // });

      const renderPipeline = device.createRenderPipeline({
         label: 'rayMarcherRenderPipeline',
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

      // this.resourceManager.registerPipeline(rayMarcherPipeline);
      this.resourceManager.registerPipeline(renderPipeline);

      const settingsBuffers = this.initSettingsData(device, this.settingsData);


      const settingsBindGroup = device.createBindGroup({
         layout: settingsBindGroupLayout,
         entries: [
            { binding: 0, resource: { buffer: settingsBuffers.settings } },
            { binding: 1, resource: { buffer: settingsBuffers.time } },
            { binding: 2, resource: { buffer: settingsBuffers.resolution } },
         ],
         label: "settingsBindGroup"
      });

      this.resourceManager.registerBindGroup(settingsBindGroup);

      this.startRenderLoop(device, context, renderPipeline, settingsBindGroup, settingsBuffers, canvas);
   }

   // private updateSettings(device: GPUDevice, settingsBuffer: SettingsBuffers): void {
   //    let settings = this.mouseTracker.getSettings();
   //
   //    settings.forEach((v, i) => {
   //       this.settingsData[0][i] = v;
   //    });
   //    this.settingsData[1][0] = (Date.now() - this.startTime) / 1000;
   //
   //    device.queue.writeBuffer(settingsBuffer.settings, 0, new Float32Array(this.settingsData[0]));
   //    device.queue.writeBuffer(settingsBuffer.time, 0, new Float32Array(this.settingsData[1]));
   // }

   private startRenderLoop(device: GPUDevice, context: GPUCanvasContext, renderPipeline: GPURenderPipeline, settingsBindGroup: GPUBindGroup, _settingsBuffer: SettingsBuffers, _canvas: HTMLCanvasElement) {

      const render = () => {
         const commandEncoder = device.createCommandEncoder();

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
         renderPass.setBindGroup(0, settingsBindGroup);
         renderPass.draw(6);
         renderPass.end();

         device.queue.submit([commandEncoder.finish()]);

         this.animationId = requestAnimationFrame(render);
      }
      render();
   }


   private createSettingsData(): [Float32Array, Float32Array, Float32Array] {
      var settings = new Float32Array(4).fill(0);
      var time = new Float32Array(4).fill(0);
      var resolution = new Float32Array([window.innerWidth, window.innerHeight, 0.0, 0.0]);

      return [settings, time, resolution];
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
      console.log("Destroying rayMarcherSimulation resources...");

      if (this.animationId) {
         cancelAnimationFrame(this.animationId);
         this.animationId = null;
      }

      this.mouseTracker.destroy();
      this.resourceManager.destroy();

      const resourceCount = this.resourceManager.getResourceCount();
      console.log('rayMarcherSimulation cleanup complete:', resourceCount);
   }
}
