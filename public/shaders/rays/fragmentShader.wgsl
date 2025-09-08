@group(0) @binding(0) var<uniform> settings: vec4<f32>;
@group(0) @binding(1) var<uniform> time: vec4<f32>;
@group(0) @binding(2) var<uniform> resolution: vec4<f32>;

@fragment
fn fs(@builtin(position) fragCoord: vec4<f32>) -> @location(0) vec4<f32> {

    return vec4<f32>(fragCoord.x / resolution.x, fragCoord.y / resolution.x, 0.0, 1.0);
}

fn hash(y: u32) -> f32 {
    var h: u32 = y;
    h ^= h >> 16u;
    h *= 0x85ebca6bu;
    h ^= h >> 13u;
    h *= 0xc2b2ae35u;
    h ^= h >> 16u;
    return f32(h) / 4294967295.0;
}
