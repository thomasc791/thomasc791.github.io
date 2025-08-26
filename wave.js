function createWaveArrayData(width, height, radius, val) {
   const _ = 0.0;

   var arrayData = Array(width * height).fill(_);

   for (let i = -radius; i < radius; i++) {
      for (let j = -radius; j < radius; j++) {
         if (i * i + j * j > radius * radius)
            continue;

         let index = (i + Math.floor(height / 2)) * width + j + width;

         arrayData[index] = val;
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

   const waveFragmentShader = `
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

   const waveArrayData = createWaveArrayData(canvas.width, canvas.height, 8, 2.0);
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
      computePass.dispatchWorkgroups(Math.ceil(canvas.width / 16), Math.ceil(canvas.height / 4));
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

   var draw = false;

   canvas.addEventListener("mousemove", (event) => {
      if (draw) {
         index = event.clientY * canvas.width + event.clientX - Math.floor(canvas.width / 2);
         const newWave = new Float32Array(1);
         newWave[0] = 1.0;
         device.queue.writeBuffer(waveArrayCurrent, index * 4, newWave);
         // device.queue.writeBuffer(waveArrayOld, index * 4, newWave);
      }
      move += 1;
   })

   canvas.addEventListener("mousedown", (_) => { draw = !draw; });

   requestAnimationFrame(render);
}
