
@group(0) @binding(0) var<storage, read_write> diffusionArrayCurrent: array<f32>;
@group(0) @binding(1) var<storage, read_write> diffusionArrayNew: array<f32>;

@group(1) @binding(0) var<storage, read_write> particlePositionData: array<f32>;
@group(1) @binding(1) var<storage, read_write> particleDirectionData: array<f32>;

@group(2) @binding(0) var<uniform> settings: vec4<f32>;
@group(2) @binding(1) var<uniform> time: vec4<f32>;

@compute @workgroup_size(64)
fn cs(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let resolution = vec2<u32>(RESOLUTION_WIDTHu, RESOLUTION_HEIGHTu);
    moveParticle(global_id.x);
}

fn moveParticle(particleIndex: u32) {
    let resolution = vec2<f32>(RESOLUTION_WIDTHf, RESOLUTION_HEIGHTf);

    if particleIndex >= NUM_PARTICLESu {
        return;
    }

    var pos = vec2<f32>(
        particlePositionData[2u * particleIndex],
        particlePositionData[2u * particleIndex + 1u]
    );

    let zeroVec = vec2<f32>(0f, 0f);

    let pi = radians(180.0);
    let turnAngle = settings[0];
    let angle = settings[1];
    let lookAhead = settings[2];
    let velocity = settings[3];

    var outOfBounds = (pos < zeroVec) | (pos > resolution);

    pos -= resolution * sign(pos) * vec2<f32>(outOfBounds);

    var dir = particleDirectionData[particleIndex];
    let dirL = particleDirectionData[particleIndex] + angle;
    let dirR = particleDirectionData[particleIndex] - angle;

    let v = vec2<f32>(cos(dir), sin(dir));
    let vL = vec2<f32>(cos(dirL), sin(dirL));
    let vR = vec2<f32>(cos(dirR), sin(dirR));

    var frontPos = pos + v * lookAhead;
    outOfBounds = (frontPos < zeroVec) | (frontPos > resolution);
    frontPos -= resolution * sign(frontPos) * vec2<f32>(outOfBounds);

    var leftPos = pos + vL * lookAhead;
    outOfBounds = (leftPos < zeroVec) | (leftPos > resolution);
    leftPos -= resolution * sign(leftPos) * vec2<f32>(outOfBounds);

    var rightPos = pos + vR * lookAhead;
    outOfBounds = (rightPos < zeroVec) | (rightPos > resolution);
    rightPos -= resolution * sign(rightPos) * vec2<f32>(outOfBounds);

    let lookFront = diffusionArrayCurrent[u32(frontPos.y) * u32(resolution.x) + u32(frontPos.x)];
    let lookLeft = diffusionArrayCurrent[u32(leftPos.y) * u32(resolution.x) + u32(leftPos.x)];
    let lookRight = diffusionArrayCurrent[u32(rightPos.y) * u32(resolution.x) + u32(rightPos.x)];

    let straight = lookFront >= lookLeft && lookFront >= lookRight;
    let random = lookLeft >= lookFront && lookRight >= lookFront && !straight;
    let left = (lookLeft > lookFront && lookFront > lookRight && !random) || (random && (hash(u32(f32(particleIndex) * time[0])) > 0.5));
    let right = (lookRight > lookFront && lookFront > lookLeft && !random) || (random && (hash(u32(f32(particleIndex) * time[0])) <= 0.5));

    dir = modulo(dir - turnAngle * (f32(right) - f32(left)), 2f * pi);
    pos += velocity * vec2<f32>(cos(dir), sin(dir));

    diffusionArrayNew[u32(pos.y) * u32(resolution.x) + u32(pos.x)] = 1f;

    particleDirectionData[particleIndex] = dir;
    particlePositionData[2 * particleIndex] = pos.x;
    particlePositionData[2 * particleIndex + 1] = pos.y;
}

fn modulo(a: f32, b: f32) -> f32 {
    return a - floor(a / b) * b;
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
   
