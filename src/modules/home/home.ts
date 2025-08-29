import { WebGPUUtils } from '../../utils/webgpu-utils';
import { GPUResourceManager } from '@/utils/gpu-resource-manager';

export class HomeSimulation {
   private animationId: number | null = null;
   private resourceManager = new GPUResourceManager();

   async init(): Promise<void> {
      const canvas = document.getElementById('home-canvas') as HTMLCanvasElement;
      if (!canvas) return;

      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;

      const webgpu = await WebGPUUtils.initWebGPU('home-canvas');
      if (!webgpu) return;

      const { device, context, canvasFormat } = webgpu;

      const homeFragmentShader = this.createHomeFragmentShader();
      const fullscreenVertexShader = this.createFullscreenVertexShader();

      const vertexShaderModule = WebGPUUtils.createShaderModule(
         device,
         fullscreenVertexShader,
         'homeVertex'
      );
      const fragmentShaderModule = WebGPUUtils.createShaderModule(
         device,
         homeFragmentShader,
         'homeFragment'
      );

      const pipeline = device.createRenderPipeline({
         layout: 'auto',
         vertex: {
            module: vertexShaderModule,
            entryPoint: 'vs_main',
         },
         fragment: {
            module: fragmentShaderModule,
            entryPoint: 'fs_main',
            targets: [{ format: canvasFormat }],
         },
         primitive: {
            topology: 'triangle-list',
         },
      });

      this.resourceManager.registerPipeline(pipeline);

      this.render(device, context, pipeline);
   }

   private createHomeFragmentShader(): string {
      return `
      @fragment
      fn fs_main(@builtin(position) fragCoord: vec4<f32>) -> @location(0) vec4<f32> {
        let resolution = vec2<f32>(f32(${window.innerWidth}), f32(${window.innerHeight}));
        let uv = fragCoord.xy / resolution;
        
        let color = mix(
          vec3<f32>(0.051, 0.067, 0.090),
          vec3<f32>(0.486, 0.227, 0.929),
          uv.y
        );
        
        return vec4<f32>(color, 1.0);
      }
    `;
   }

   private createFullscreenVertexShader(): string {
      return `
      @vertex
      fn vs_main(@builtin(vertex_index) vertexIndex: u32) -> @builtin(position) vec4<f32> {
        var pos = array<vec2<f32>, 6>(
          vec2<f32>(-1.0, -1.0),
          vec2<f32>( 1.0, -1.0),
          vec2<f32>(-1.0,  1.0),
          vec2<f32>(-1.0,  1.0),
          vec2<f32>( 1.0, -1.0),
          vec2<f32>( 1.0,  1.0)
        );
        return vec4<f32>(pos[vertexIndex], 0.0, 1.0);
      }
    `;
   }

   private render(device: GPUDevice, context: GPUCanvasContext, pipeline: GPURenderPipeline): void {
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
      renderPass.setPipeline(pipeline);
      renderPass.draw(6);
      renderPass.end();

      device.queue.submit([commandEncoder.finish()]);
   }

   destroy(): void {
      console.log("Destroying HomeSimulation resources...");

      if (this.animationId) {
         cancelAnimationFrame(this.animationId);
         this.animationId = null;
      }

      this.resourceManager.destroy();

      const resourceCount = this.resourceManager.getResourceCount();
      console.log('HomeSimulation cleanup complete:', resourceCount);
   }
}
