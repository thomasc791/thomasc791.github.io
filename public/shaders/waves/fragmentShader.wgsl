@group(0) @binding(0) var<storage, read_write> waveArrayOld: array<f32>;
@group(0) @binding(1) var<storage, read_write> waveArrayCurrent: array<f32>;
@group(0) @binding(2) var<storage, read_write> waveArrayNew: array<f32>;

@fragment
fn fs(@builtin(position) fragCoord: vec4<f32>) -> @location(0) vec4<f32> {
    let resolution = vec2<f32>(RESOLUTION_WIDTHf, RESOLUTION_HEIGHTf);
    let stepX = 1f / resolution.x;
    let stepY = 1f / resolution.y;

    let index = fragCoord.y * resolution.x + fragCoord.x;
    let i = u32(index);

    waveArrayOld[i] = waveArrayCurrent[i];
    waveArrayCurrent[i] = waveArrayNew[i];
    let current = waveArrayCurrent[i];
    let old = waveArrayOld[i];
    let positive = max(sign(current), 0f) * current;
    let negative = max(sign(-current), 0f) * -1f * current;
    return 10f * positive * vec4<f32>(0.3, 0.3, 1.0, 1.0) + 10f * negative * vec4<f32>(1.0, 0.3, 0.3, 1.0);
}
