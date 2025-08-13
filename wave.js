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

   const waveComputeShader = `
      @group(0) @binding(0) var<storage, read_write> waveArrayOld: array<f32>;
      @group(0) @binding(1) var<storage, read_write> waveArrayCurrent: array<f32>;
      @group(0) @binding(2) var<storage, read_write> waveArrayNew: array<f32>;
      
      @compute @workgroup_size(8, 8)
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
         waveArrayNew[index] = 0.999 * (2f * center - old + 0.25 * ( left + right + up + down - 4 * center ));

         return;
      }
   `

   const waveFragmentShader = `
      @group(0) @binding(0) var<storage, read_write> waveArrayOld: array<f32>;
      @group(0) @binding(1) var<storage, read_write> waveArrayCurrent: array<f32>;
      @group(0) @binding(2) var<storage, read_write> waveArrayNew: array<f32>;

      @fragment
      fn fs(@builtin(position) fragCoord: vec4<f32>) -> @location(0) vec4<f32> {
         let resolution = vec2<f32>(f32(${window.innerWidth}), f32(${window.innerHeight}));
         let i = fragCoord.x/resolution.x;
         let stepX = 1/resolution.x;
         let stepY = 1/resolution.y;

         let index = fragCoord.y*resolution.x+fragCoord.x;
 
         waveArrayOld[u32(index)] = waveArrayCurrent[u32(index)];
         waveArrayCurrent[u32(index)] = waveArrayNew[u32(index)];
         let positive = max(sign(waveArrayCurrent[u32(index)]), 0) * waveArrayCurrent[u32(index)];
         let negative = max(sign(-waveArrayCurrent[u32(index)]), 0) * waveArrayCurrent[u32(index)];
         return vec4<f32>(negative, positive, 1.0, 1.0);
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

   const computeShaderModule = device.createShaderModule({ label: 'computeShader', code: waveComputeShader });
   const vertexShaderModule = device.createShaderModule({ label: 'vertexShader', code: fullscreenVertexShader });
   const fragmentShaderModule = device.createShaderModule({ label: 'fragmentShader', code: waveFragmentShader });

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

   const waveArrayData = createWaveArrayData(canvas.width, canvas.height, 10);
   const { waveArrayOld, waveArrayCurrent, waveArrayNew } = initWaveArrays(device, waveArrayData, canvas.width, canvas.height);

   const computeBindGroup = device.createBindGroup({
      layout: computePipeline.getBindGroupLayout(0),
      entries: [
         { binding: 0, resource: waveArrayOld },
         { binding: 1, resource: waveArrayCurrent },
         { binding: 2, resource: waveArrayNew },
      ],
   });

   const renderBindGroup = device.createBindGroup({
      layout: renderPipeline.getBindGroupLayout(0),
      entries: [
         { binding: 0, resource: waveArrayOld },
         { binding: 1, resource: waveArrayCurrent },
         { binding: 2, resource: waveArrayNew },
      ],
   });

   function render() {
      const commandEncoder = device.createCommandEncoder();

      const computePass = commandEncoder.beginComputePass();
      computePass.setPipeline(computePipeline);
      computePass.setBindGroup(0, computeBindGroup);
      computePass.dispatchWorkgroups(Math.ceil(canvas.width / 8), Math.ceil(canvas.height / 8));
      computePass.end();

      const renderPassDescriptor = {
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

   requestAnimationFrame(render);
}
