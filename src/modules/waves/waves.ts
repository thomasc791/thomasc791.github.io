import { WebGPUUtils } from '../../utils/webgpu-utils';
import { WaveBuffers } from '../../types/webgpu';
import { waveComputeShader, waveVertexShader, waveFragmentShader } from './waveShaders';

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

      const computeShaderModule = WebGPUUtils.createShaderModule(
         device,
         waveComputeShader(),
         'waveCompute'
      );

      const vertexShaderModule = WebGPUUtils.createShaderModule(
         device,
         waveVertexShader(),
         'waveVertex'
      );

      const fragmentShaderModule = WebGPUUtils.createShaderModule(
         device,
         waveFragmentShader(),
         'waveFragment'
      );

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

   destroy(): void {
      if (this.animationId) {
         cancelAnimationFrame(this.animationId);
         this.animationId = null;
      }
   }
}
