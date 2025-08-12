function createWaveTextureData(width, height, radius) {
   const _ = [0, 0, 0, 255];
   const h = [255, 255, 255, 255];

   var textureData = Array(width * height).fill(h);

   for (let i = -radius; i < radius; i++) {
      for (let j = -radius; j < radius; j++) {
         if (i * i + j * j > radius * radius)
            continue;

         let index = (i + Math.floor(height / 2)) * width + j + Math.floor(width / 2);

         textureData[index] = _;
      }
   }

   return new Uint8Array(textureData.flat());
}

function initWaveTextures(device, textureData, width, height, canvasFormat) {
   const waveTextureOld = device.createTexture({
      size: [width, height],
      format: canvasFormat,
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
   });

   const waveTextureCurrent = device.createTexture({
      size: [width, height],
      format: canvasFormat,
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
   });

   const waveTextureNew = device.createTexture({
      size: [width, height],
      format: canvasFormat,
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
   });

   for (let texture of [waveTextureOld, waveTextureCurrent, waveTextureNew]) {
      device.queue.writeTexture(
         { texture },
         textureData,
         { bytesPerRow: width * 4 },
         { width: width, height: height },
      );
   }
   return { waveTextureOld, waveTextureCurrent, waveTextureNew };
}

async function initWaves() {
   const canvas = document.getElementById('waves-canvas');
   canvas.width = window.innerWidth;
   canvas.height = window.innerHeight;

   const webgpu = await initWebGPU('waves-canvas');
   if (!webgpu) return;

   const { device, context, canvasFormat } = webgpu;

   const waveFragmentShader = `
      @group(0) @binding(0) var textureSampler: sampler;
      @group(0) @binding(1) var waveTextureOld: texture_2d<f32>;
      @group(0) @binding(2) var waveTextureCurrent: texture_2d<f32>;
      @group(0) @binding(3) var waveTextureNew: texture_2d<f32>;

      @fragment
      fn fs(@builtin(position) fragCoord: vec4<f32>) -> @location(0) vec4<f32> {
         let resolution = vec2<f32>(f32(${window.innerWidth}), f32(${window.innerHeight}));
         let uv = (fragCoord.xy - 0.5 * resolution) / resolution.y;
         let time = 0.0; // Will be animated later

         var xy = vec2<f32>(fragCoord.x/resolution.x, fragCoord.y/resolution.y);
         let xStep = 1/resolution.x;
         let yStep = 1/resolution.y;

         xy.x -= xStep;
         let left = textureSample(waveTextureCurrent, textureSampler, xy);
         xy.x += 2*xStep;
         let right = textureSample(waveTextureCurrent, textureSampler, xy);
         xy.x -= xStep;
         xy.y += yStep;
         let top = textureSample(waveTextureCurrent, textureSampler, xy);
         xy.y -= 2*yStep;
         let bot = textureSample(waveTextureCurrent, textureSampler, xy);
         xy.y += yStep;
         let oldWave = textureSample(waveTextureOld, textureSampler, xy);
         var currentWave = textureSample(waveTextureCurrent, textureSampler, xy);
         var newWave = textureSample(waveTextureNew, textureSampler, xy);
         newWave = 2*currentWave - oldWave + 0.25*(left+right+top+bot-4*currentWave);

         currentWave = newWave;
         return newWave;
       }
   `;

   const fullscreenVertexShader = `
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

   const vertexShaderModule = device.createShaderModule({
      label: 'vertexShader', code: fullscreenVertexShader
   });
   const fragmentShaderModule = device.createShaderModule({ label: 'fragmentShader', code: waveFragmentShader });

   const pipeline = device.createRenderPipeline({
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

   const waveTextureData = createWaveTextureData(canvas.width, canvas.height, 10);
   const { waveTextureOld, waveTextureCurrent, waveTextureNew } = initWaveTextures(device, waveTextureData, canvas.width, canvas.height, canvasFormat);

   const sampler = device.createSampler();

   const bindGroup = device.createBindGroup({
      layout: pipeline.getBindGroupLayout(0),
      entries: [
         { binding: 0, resource: sampler },
         { binding: 1, resource: waveTextureOld.createView() },
         { binding: 2, resource: waveTextureCurrent.createView() },
         { binding: 3, resource: waveTextureNew.createView() },
      ],
   });

   function render() {
      const commandEncoder = device.createCommandEncoder();
      const renderPassDescriptor = {
         colorAttachments: [{
            view: context.getCurrentTexture().createView(),
            clearValue: { r: 0, g: 0, b: 0, a: 1.0 },
            loadOp: 'clear',
            storeOp: 'store',
         }],
      };

      const renderPass = commandEncoder.beginRenderPass(renderPassDescriptor);
      renderPass.setPipeline(pipeline);
      renderPass.setBindGroup(0, bindGroup);
      renderPass.draw(6);
      renderPass.end();

      device.queue.submit([commandEncoder.finish()]);
   }

   render();
}
