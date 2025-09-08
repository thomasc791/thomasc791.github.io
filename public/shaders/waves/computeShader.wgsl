@group(0) @binding(0) var<storage, read_write> waveArrayOld: array<f32>;
@group(0) @binding(1) var<storage, read_write> waveArrayCurrent: array<f32>;
@group(0) @binding(2) var<storage, read_write> waveArrayNew: array<f32>;

@compute @workgroup_size(8, 8)
fn cs(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let resolution = vec2<u32>(RESOLUTION_WIDTHu, RESOLUTION_HEIGHTu);
    let i = global_id.x;
    let j = global_id.y;

    let index = j * resolution.x + i;

    if i == 0u || i == resolution.x || j == 0u || j == resolution.y {
        waveArrayNew[index] = 0.0;
    }

    let left = waveArrayCurrent[index - 1u];
    let right = waveArrayCurrent[index + 1u];
    let up = waveArrayCurrent[(index - resolution.x)];
    let down = waveArrayCurrent[(index + resolution.x)];
    let center = waveArrayCurrent[index];
    let old = waveArrayOld[index];
    waveArrayNew[index] = 0.99 * (2f * center - old + 0.25 * (left + right + up + down - 4f * center));

    return;
}
