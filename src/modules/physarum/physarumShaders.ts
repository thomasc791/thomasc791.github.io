export function physarumMovementShader(numPoints: number): string {
   return `
      struct PhysarumSettings {
         turnAngle: f32,
         angle: f32,
         lookAhead: f32,
         p: f32,
      }

      @group(0) @binding(0) var<storage, read_write> diffusionArrayCurrent: array<f32>;
      @group(0) @binding(1) var<storage, read_write> diffusionArrayNew: array<f32>;

      @group(1) @binding(0) var<storage, read_write> particlePositionData: array<f32>;
      @group(1) @binding(1) var<storage, read_write> particleDirectionData: array<f32>;

      @group(2) @binding(0) var<uniform> settings: PhysarumSettings;
      @group(2) @binding(1) var<uniform> time: vec4<f32>;

      @compute @workgroup_size(64)
      fn cs(@builtin(global_invocation_id) global_id: vec3<u32>) {
         let resolution = vec2<u32>(${window.innerWidth}, ${window.innerHeight});
         moveParticle(global_id.x);

         // let pos = vec2<f32>(
         //    particlePositionData[2*global_id.x],
         //    particlePositionData[2*global_id.x + 1]
         // );
         //
         // diffusionArrayNew[u32(pos.y)*resolution.x+u32(pos.x)] = 1f;
      }

      fn moveParticle(particleIndex: u32) {
         let resolution = vec2<f32>(${window.innerWidth}, ${window.innerHeight});

         if (particleIndex >= ${numPoints}) {
            return;
         }

         var pos = vec2<f32>(
            particlePositionData[2*particleIndex],
            particlePositionData[2*particleIndex + 1]
         );

         let zeroVec = vec2<f32>(0, 0);

         let pi = radians(180.0);
         let turnAngle = settings.turnAngle;
         let angle = settings.angle;
         let lookAhead = settings.lookAhead;
         let p = settings.p;

         var outOfBounds = pos < zeroVec | pos > resolution;

         pos -= resolution * sign(pos) * vec2<f32>(outOfBounds);


         var dir = particleDirectionData[particleIndex];
         let dirL = particleDirectionData[particleIndex]+angle;
         let dirR = particleDirectionData[particleIndex]-angle;

         let v = vec2<f32>(cos(dir), sin(dir));
         let vL = vec2<f32>(cos(dirL), sin(dirL));
         let vR = vec2<f32>(cos(dirR), sin(dirR));

         var frontPos = pos + v * lookAhead;
         outOfBounds = frontPos < zeroVec | frontPos > resolution;
         frontPos -= resolution * sign(frontPos) * vec2<f32>(outOfBounds);

         var leftPos = pos + vL * lookAhead;
         outOfBounds = leftPos < zeroVec | leftPos > resolution;
         leftPos -= resolution * sign(leftPos) * vec2<f32>(outOfBounds);

         var rightPos = pos + vR * lookAhead;
         outOfBounds = rightPos < zeroVec | rightPos > resolution;
         rightPos -= resolution * sign(rightPos) * vec2<f32>(outOfBounds);

         let lookFront = diffusionArrayCurrent[u32(frontPos.y * resolution.x) + u32(frontPos.x)];
         let lookLeft = diffusionArrayCurrent[u32(leftPos.y * resolution.x) + u32(leftPos.x)];
         let lookRight = diffusionArrayCurrent[u32(rightPos.y * resolution.x) + u32(rightPos.x)];

         let straight = lookFront >= lookLeft && lookFront >= lookRight;
         let random = lookLeft >= lookFront && lookRight >= lookFront && !straight;
         let left = lookLeft > lookFront && lookFront > lookRight && !random || random && (hash(u32(f32(particleIndex) * time[0])) <= p);
         let right = lookRight > lookFront && lookFront > lookLeft && !random || random && (hash(u32(f32(particleIndex) * time[0])) <= p);

         dir = modulo(dir - turnAngle * (f32(right) - f32(left)), 2f * pi);
         // pos += 0.1 * vec2<f32>(cos(dir), sin(dir));
         // pos.y += 1.0;

         particleDirectionData[particleIndex] = dir;
         particlePositionData[2*particleIndex] = pos.x;
         particlePositionData[2*particleIndex + 1] = pos.y;

         diffusionArrayNew[u32(pos.y*resolution.x)+u32(pos.x)+u32(resolution.x/2)] = pos.x/resolution.x;
      }

      fn modulo(a: f32, b: f32) -> f32 {
         return a-floor(a/b)*b;
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
         if (index >= arrayLength(&diffusionArrayCurrent)) {
            return;
         }

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

      @group(2) @binding(0) var<uniform> settings: vec4<f32>;
      @group(2) @binding(1) var<uniform> time: vec4<f32>;

      @fragment
      fn fs(@builtin(position) fragCoord: vec4<f32>) -> @location(0) vec4<f32> {
         let resolution = vec2<u32>(${window.innerWidth}, ${window.innerHeight});

         let index = u32(fragCoord.y) * resolution.x + u32(fragCoord.x);
         let intensity = diffusionArrayNew[index];
         return intensity*vec4<f32>(1.0, 1.0, 1.0, 1.0);
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
