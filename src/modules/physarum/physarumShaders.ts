export function physarumMovementShader(numPoints: number): string {
   return `
      @group(0) @binding(0) var<storage, read_write> diffusionArrayCurrent: array<f32>;
      @group(0) @binding(1) var<storage, read_write> diffusionArrayNew: array<f32>;

      @group(1) @binding(0) var<storage, read_write> particlePositionData: array<f32>;
      @group(1) @binding(1) var<storage, read_write> particleDirectionData: array<f32>;

      @compute @workgroup_size(64)
      fn cs(@builtin(global_invocation_id) global_id: vec3<u32>) {
         let resolution = vec2<u32>(${window.innerWidth}, ${window.innerHeight});
         let i = global_id.x;

         if (i >= arrayLength(&particlePositionData) / 2) {
            return;
         }

         let pos = vec2<f32>(
            particlePositionData[2*i],
            particlePositionData[2*i + 1]
         );

         let pi = radians(180.0);

         let dir = particleDirectionData[i];
         let dirL = particleDirectionData[i]+0.1*pi;
         let dirR = particleDirectionData[i]-0.1*pi;

         let v = vec2<f32>(cos(dir), sin(dir));
         let vL = vec2<f32>(cos(dir), sin(dir));
         let vR = vec2<f32>(cos(dir), sin(dir));

         let front = pos + 10f*v;
         let left = pos + 10f*vL;
         let right = pos + 10f*vR;

         particlePositionData[2*i] += v[0];
         particlePositionData[2*i+1] += v[1];

         let index = u32(particlePositionData[2*i])*resolution.x+u32(particlePositionData[2*i+1]);

         diffusionArrayNew[u32(pos.y)*resolution.x+u32(pos.x)] = 1f;
      }

      fn hash(y: u32) -> f32 {
         let x = f32(y / ${numPoints});
         return fract(sin(x*radians(360.0))*43758.5453123);
      }
   `
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
         let indexUp = ((j+1) % resolution.y) * resolution.x + i;
         let indexDown = ((j-1) % resolution.y) * resolution.x + i;

         diffusionArrayCurrent[index] = diffusionArrayNew[index];

         let left = diffusionArrayCurrent[index-1];
         let right = diffusionArrayCurrent[index+1];
         let up = diffusionArrayCurrent[indexUp];
         let down = diffusionArrayCurrent[indexDown];
         let center = diffusionArrayCurrent[index];
         diffusionArrayNew[index] = 0.95 * (center + 0.25 * ( left + right + up + down - 4 * center ));

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

      @fragment
      fn fs(@builtin(position) fragCoord: vec4<f32>) -> @location(0) vec4<f32> {
         let resolution = vec2<u32>(${window.innerWidth}, ${window.innerHeight});

         let index = u32(fragCoord.y) * resolution.x + u32(fragCoord.x);
         let intensity = diffusionArrayNew[index];
         return vec4<f32>(intensity*0.8, intensity*0.4, intensity*0.6, 1.0);
       }
   `;
}
