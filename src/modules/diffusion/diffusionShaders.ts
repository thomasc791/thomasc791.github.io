export function diffusionComputeShader(): string {
   return `
      @group(0) @binding(0) var<storage, read_write> diffusionArrayCurrent: array<f32>;
      @group(0) @binding(1) var<storage, read_write> diffusionArrayNew: array<f32>;
      
      @compute @workgroup_size(16, 4)
      fn cs(@builtin(global_invocation_id) global_id: vec3<u32>) {
         let resolution = vec2<u32>(${window.innerWidth}, ${window.innerHeight});
         let i = global_id.x;
         let j = global_id.y;

         let index = j*resolution.x + i;

         if (i == 0 || i == resolution.x || j == 0 || j == resolution.y) {
            diffusionArrayNew[u32(index)] = 0.0;
         }

         let left = diffusionArrayCurrent[index-1];
         let right = diffusionArrayCurrent[index+1];
         let up = diffusionArrayCurrent[(index - resolution.x)];
         let down = diffusionArrayCurrent[(index + resolution.x)];
         let center = diffusionArrayCurrent[index];
         diffusionArrayNew[index] = center + 0.25 * ( left + right + up + down - 4 * center );

         return;
      }
   `
}

export function diffusionVertexShader(): string {
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

export function diffusionFragmentShader(): string {
   return `
      @group(0) @binding(0) var<storage, read_write> diffusionArrayCurrent: array<f32>;
      @group(0) @binding(1) var<storage, read_write> diffusionArrayNew: array<f32>;

      @fragment
      fn fs(@builtin(position) fragCoord: vec4<f32>) -> @location(0) vec4<f32> {
         let resolution = vec2<f32>(f32(${window.innerWidth}), f32(${window.innerHeight}));
         let stepX = 1/resolution.x;
         let stepY = 1/resolution.y;

         let index = fragCoord.y*resolution.x+fragCoord.x;
         let i = u32(index);
 
         diffusionArrayCurrent[i] = diffusionArrayNew[i];
         let current = diffusionArrayCurrent[i];
         let positive = max(sign(current), 0) * current;
         let negative = max(sign(-current), 0) * -1*current;
         return 10*positive*vec4<f32>(0.3, 0.3, 1.0, 1.0) + 10*negative*vec4<f32>(1.0, 0.3, 0.3, 1.0);
       }
   `;
}
