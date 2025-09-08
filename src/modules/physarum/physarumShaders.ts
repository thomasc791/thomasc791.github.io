export function physarumMovementShader(numParticles: number): string {
   return ``
}

export function physarumDiffusionShader(): string {
   return `
      @group(0) @binding(0) var<storage, read_write> diffusionArrayCurrent: array<f32>;
      @group(0) @binding(1) var<storage, read_write> diffusionArrayNew: array<f32>;

      @compute @workgroup_size(16, 4)
      fn cs(@builtin(global_invocation_id) global_id: vec3<u32>) {
         let resolution = vec2<u32>(${window.innerWidth}, ${window.innerHeight});
         let i = global_id.x;
         let j = global_id.y;

         let index = j*resolution.x + i;
         if (index < 0 || index >= arrayLength(&diffusionArrayCurrent)) {
            return;
         }

         let indexLeft = j * resolution.x + (i - 1) % resolution.x;
         let indexRight = j * resolution.x + (i + 1) % resolution.x;
         let indexUp = ((j+1) % resolution.y) * resolution.x + i;
         let indexDown = ((j-1) % resolution.y) * resolution.x + i;

         diffusionArrayCurrent[index] = diffusionArrayNew[index];

         let left = diffusionArrayCurrent[indexLeft];
         let right = diffusionArrayCurrent[indexRight];
         let up = diffusionArrayCurrent[indexUp];
         let down = diffusionArrayCurrent[indexDown];
         let center = diffusionArrayCurrent[index];
         diffusionArrayNew[index] = 0.950 * (center + 0.25 * ( left + right + up + down - 4 * center ));

         return;
      }
   `
}

export function physarumVertexShader(): string {
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

export function physarumFragmentShader(): string {
   return `
      @group(0) @binding(0) var<storage, read_write> diffusionArrayCurrent: array<f32>;
      @group(0) @binding(1) var<storage, read_write> diffusionArrayNew: array<f32>;

      @group(1) @binding(0) var<storage, read_write> particlePositionData: array<f32>;
      @group(1) @binding(1) var<storage, read_write> particleDirectionData: array<f32>;

      @group(2) @binding(0) var<uniform> settings: vec4<f32>;
      @group(2) @binding(1) var<uniform> time: vec4<f32>;

      @fragment
      fn fs(@builtin(position) fragCoord: vec4<f32>) -> @location(0) vec4<f32> {
         let resolution = vec2<u32>(${window.innerWidth}, ${window.innerHeight});

         let index = u32(fragCoord.y) * resolution.x + u32(fragCoord.x);

         let intensity = diffusionArrayNew[index];
         let isZero = intensity > 0.5e-2;
         // return vec4<f32>(intensity, intensity, intensity, 1.0);
         return f32(isZero) * vec4<f32>(intensity, intensity, intensity, 1.0);
      }

      fn hash(y: u32) -> f32 {
            var h = y;
            h ^= h >> 16;
            h *= 0x85ebca6bu;
            h ^= h >> 13;
            h *= 0xc2b2ae35u;
            h ^= h >> 16;
            return f32(h) / 4294967295.0;
      }
   `;
}
