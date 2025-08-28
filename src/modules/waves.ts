import { WebGPUUtils } from '../utils/webgpu-utils';
import { WaveBuffers } from '../types/webgpu';

export class WaveSimulation {
   private animationId: number | null = null;
   private isDrawing = false;

   async init(): Promise<void> {
      const canvas = document.getElementById('waves-canvas') as HTMLCanvasElement;
      if (!canvas) return;

      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;

      const webgpu = await WebGPUUtils.initWebGPU('waves-canvas');
      if (!webgpu) return;

      const { device, context, canvasFormat } = webgpu;

      // Create shaders
      const computeShaderModule = WebGPUUtils.createShaderModule(
         device,
         this.createWaveComputeShader(),
         'waveCompute'
      );

      const vertexShaderModule = WebGPUUtils.createShaderModule(
         device,
         this.createFullscreenVertexShader(),
         'waveVertex'
      );

      const fragmentShaderModule = WebGPUUtils.createShaderModule(
         device,
         this.createWaveFragmentShader(),
         'waveFragment'
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
         label: 'WaveRenderPipeline',
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

      // Initialize wave data and buffers
      const waveArrayData = this.createWaveArrayData(canvas.width, canvas.height, 8, 2.0);
      const buffers = this.initWaveArrays(device, waveArrayData, canvas.width, canvas.height);

      // Create bind groups
      const computeBindGroup = device.createBindGroup({
         layout: computePipeline.getBindGroupLayout(0),
         entries: [
            { binding: 0, resource: { buffer: buffers.waveArrayOld } },
            { binding: 1, resource: { buffer: buffers.waveArrayCurrent } },
            { binding: 2, resource: { buffer: buffers.waveArrayNew } },
         ],
      });

      const renderBindGroup = device.createBindGroup({
         layout: renderPipeline.getBindGroupLayout(0),
         entries: [
            { binding: 0, resource: { buffer: buffers.waveArrayOld } },
            { binding: 1, resource: { buffer: buffers.waveArrayCurrent } },
            { binding: 2, resource: { buffer: buffers.waveArrayNew } },
         ],
      });

      this.setupMouseEvents(canvas, device, buffers.waveArrayCurrent);
      this.startRenderLoop(device, context, computePipeline, renderPipeline, computeBindGroup, renderBindGroup, canvas);
   }

   private setupMouseEvents(canvas: HTMLCanvasElement, device: GPUDevice, waveArrayCurrent: GPUBuffer) {
      canvas.addEventListener("mousemove", (event) => {
         if (this.isDrawing) {
            let index = event.clientY * canvas.width + event.clientX - Math.floor(canvas.width / 2);
            const newWave = new Float32Array(1);
            newWave[0] = 1.0;
            device.queue.writeBuffer(waveArrayCurrent, index * 4, newWave);
            // device.queue.writeBuffer(waveArrayOld, index * 4, newWave);
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

   private createWaveArrayData(width: number, height: number, radius: number, val: number): BufferSource {
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

   private initWaveArrays(device: GPUDevice, arrayData: BufferSource, width: number, height: number): WaveBuffers {
      const createBuffer = () => device.createBuffer({
         size: width * height * 4,
         usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST,
      });

      const buffers: WaveBuffers = {
         waveArrayOld: createBuffer(),
         waveArrayCurrent: createBuffer(),
         waveArrayNew: createBuffer(),
      };

      Object.values(buffers).forEach(buffer => {
         device.queue.writeBuffer(buffer, 0, arrayData);
      });

      return buffers;
   }

   private createWaveComputeShader(): string {
      return `
      @group(0) @binding(0) var<storage, read_write> waveArrayOld: array<f32>;
      @group(0) @binding(1) var<storage, read_write> waveArrayCurrent: array<f32>;
      @group(0) @binding(2) var<storage, read_write> waveArrayNew: array<f32>;
      
      @compute @workgroup_size(16, 4)
      fn cs(@builtin(global_invocation_id) global_id: vec3<u32>) {
         let resolution = vec2<u32>(${window.innerWidth}, ${window.innerHeight});
         let i = global_id.x;
         let j = global_id.y;

         let index = j*resolution.x + i;

         if (i == 0 || i == resolution.x || j == 0 || j == resolution.y) {
            waveArrayNew[u32(index)] = 0.0;
         }

         let left = waveArrayCurrent[index-1];
         let right = waveArrayCurrent[index+1];
         let up = waveArrayCurrent[(index - resolution.x)];
         let down = waveArrayCurrent[(index + resolution.x)];
         let center = waveArrayCurrent[index];
         let old = waveArrayOld[index];
         waveArrayNew[index] = 0.99 * (2f * center - old + 0.25 * ( left + right + up + down - 4 * center ));

         return;
      }
   `
   }

   private createFullscreenVertexShader(): string {
      return `
       @vertex
       fn vs(@builtin(vertex_index) vertexIndex: u32) -> @builtin(position) vec4<f32> {
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

   private createWaveFragmentShader(): string {
      return `
      @group(0) @binding(0) var<storage, read_write> waveArrayOld: array<f32>;
      @group(0) @binding(1) var<storage, read_write> waveArrayCurrent: array<f32>;
      @group(0) @binding(2) var<storage, read_write> waveArrayNew: array<f32>;

      @fragment
      fn fs(@builtin(position) fragCoord: vec4<f32>) -> @location(0) vec4<f32> {
         let resolution = vec2<f32>(f32(${window.innerWidth}), f32(${window.innerHeight}));
         let stepX = 1/resolution.x;
         let stepY = 1/resolution.y;

         let index = fragCoord.y*resolution.x+fragCoord.x;
         let i = u32(index);
 
         waveArrayOld[i] = waveArrayCurrent[i];
         waveArrayCurrent[i] = waveArrayNew[i];
         let current = waveArrayCurrent[i];
         let old = waveArrayOld[i];
         let positive = max(sign(current), 0) * current;
         let negative = max(sign(-current), 0) * -1*current;
         return 10*positive*vec4<f32>(0.3, 0.3, 1.0, 1.0) + 10*negative*vec4<f32>(1.0, 0.3, 0.3, 1.0);
         // return vec4<f32>(fragCoord.y/resolution.y, 0.0, 0.0, 1.0);
       }
   `;
   }
   destroy(): void {
      if (this.animationId) {
         cancelAnimationFrame(this.animationId);
         this.animationId = null;
      }
   }
}
