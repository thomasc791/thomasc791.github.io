function createWaveArrayData(width, height, radius) {
   const _ = 0.0;
   const h = 1.0;

   var arrayData = Array(width * height).fill(h);

   for (let i = -radius; i < radius; i++) {
      for (let j = -radius; j < radius; j++) {
         if (i * i + j * j > radius * radius)
            continue;

         let index = (i + Math.floor(height / 2)) * width + j + Math.floor(width / 2);

         arrayData[index] = _;
      }
   }

   return new Float32Array(arrayData);
}

function initWaveArrays(device, arrayData, width, height) {
   const waveArrayOld = device.createBuffer({
      size: width * height * 4,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST,
   });

   const waveArrayCurrent = device.createBuffer({
      size: width * height * 4,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST,
   });

   const waveArrayNew = device.createBuffer({
      size: width * height * 4,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST,
   });

   for (let array of [waveArrayOld, waveArrayCurrent, waveArrayNew]) {
      device.queue.writeBuffer(array, 0, arrayData);
   }
   return { waveArrayOld, waveArrayCurrent, waveArrayNew };
}

async function initWaves() {
   const canvas = document.getElementById('waves-canvas');
   canvas.width = window.innerWidth;
   canvas.height = window.innerHeight;

   const webgpu = await initWebGPU('waves-canvas');
   if (!webgpu) return;

   const { device, context, canvasFormat } = webgpu;

   const waveFragmentShader = `
      @group(0) @binding(0) var<storage, read_write> waveArrayOld: array<f32>;
      @group(0) @binding(1) var<storage, read_write> waveArrayCurrent: array<f32>;
      @group(0) @binding(2) var<storage, read_write> waveArrayNew: array<f32>;

      @fragment
      fn fs(@builtin(position) fragCoord: vec4<f32>) -> @location(0) vec4<f32> {
         let resolution = vec2<f32>(f32(${window.innerWidth}), f32(${window.innerHeight}));
         let stepX = 1/resolution.x;
         let stepY = 1/resolution.y;
         let time = 0.0; // Will be animated later

         let oldWave = waveArrayOld[u32(fragCoord.y*resolution.x+fragCoord.x-resolution.x/2)];
         let left = waveArrayCurrent[u32(fragCoord.y*resolution.x+fragCoord.x-stepX-resolution.x/2)];
         let right = waveArrayCurrent[u32(fragCoord.y*resolution.x+fragCoord.x+stepX-resolution.x/2)];
         let up = waveArrayCurrent[u32((fragCoord.y+stepY)*resolution.x+fragCoord.x-resolution.x/2)];
         let down = waveArrayCurrent[u32((fragCoord.y-stepY)*resolution.x+fragCoord.x-resolution.x/2)];
         let currentWave = waveArrayCurrent[u32(fragCoord.y*resolution.x+fragCoord.x-resolution.x/2)];
         waveArrayNew[u32(fragCoord.y*resolution.x+fragCoord.x-resolution.x/2)] = 2 * currentWave - oldWave - 0.25 * ( left + right + up + down - 4 * currentWave);
         let newWave = waveArrayNew[u32(fragCoord.y*resolution.x+fragCoord.x-resolution.x/2)];
         waveArrayNew[u32(fragCoord.y*resolution.x+fragCoord.x-resolution.x/2)] = waveArrayNew[u32(fragCoord.y*resolution.x+fragCoord.x-resolution.x/2)] + 0.1;
         return vec4<f32>(newWave, 0, 0, 1.0);
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

   const waveArrayData = createWaveArrayData(canvas.width, canvas.height, 10);
   const { waveArrayOld, waveArrayCurrent, waveArrayNew } = initWaveArrays(device, waveArrayData, canvas.width, canvas.height);

   const bindGroup = device.createBindGroup({
      layout: pipeline.getBindGroupLayout(0),
      entries: [
         { binding: 0, resource: waveArrayOld },
         { binding: 1, resource: waveArrayCurrent },
         { binding: 2, resource: waveArrayNew },
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

      requestAnimationFrame(render);
   }

   requestAnimationFrame(render);
}
