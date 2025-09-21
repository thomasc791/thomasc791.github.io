@group(0) @binding(0) var<storage, read_write> diffusionArrayCurrent: array<f32>;
@group(0) @binding(1) var<storage, read_write> diffusionArrayNew: array<f32>;

@group(1) @binding(0) var<storage, read_write> particlePositionData: array<f32>;
@group(1) @binding(1) var<storage, read_write> particleDirectionData: array<f32>;

@group(2) @binding(0) var<uniform> settings: vec4<f32>;
@group(2) @binding(1) var<uniform> time: vec4<f32>;

@fragment
fn fs(@builtin(position) fragCoord: vec4<f32>) -> @location(0) vec4<f32> {
    let resolution = vec2<u32>(RESOLUTION_WIDTHu, RESOLUTION_HEIGHTu);

    let index = u32(fragCoord.y) * resolution.x + u32(fragCoord.x);

    let intensity = diffusionArrayNew[index];
    let isZero = intensity > 0.5e-2;
    return f32(isZero) * vec4<f32>(intensity, intensity, intensity, 1.0);
}

fn hash(y: u32) -> f32 {
    var h = y;
    h ^= h >> 16u;
    h *= 0x85ebca6bu;
    h ^= h >> 13u;
    h *= 0xc2b2ae35u;
    h ^= h >> 16u;
    return f32(h) / 4294967295.0;
}
