@group(0) @binding(0) var<storage, read_write> diffusionArrayCurrent: array<f32>;
@group(0) @binding(1) var<storage, read_write> diffusionArrayNew: array<f32>;

@compute @workgroup_size(16, 4)
fn cs(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let resolution = vec2<u32>(RESOLUTION_WIDTHu, RESOLUTION_HEIGHTu);
    let i = global_id.x;
    let j = global_id.y;

    let index = j * resolution.x + i;
    if index < 0u || index >= arrayLength(&diffusionArrayCurrent) {
        return;
    }

    let indexLeft = j * resolution.x + (i - 1u) % resolution.x;
    let indexRight = j * resolution.x + (i + 1u) % resolution.x;
    let indexUp = ((j + 1u) % resolution.y) * resolution.x + i;
    let indexDown = ((j - 1u) % resolution.y) * resolution.x + i;

    diffusionArrayCurrent[index] = diffusionArrayNew[index];

    let left = diffusionArrayCurrent[indexLeft];
    let right = diffusionArrayCurrent[indexRight];
    let up = diffusionArrayCurrent[indexUp];
    let down = diffusionArrayCurrent[indexDown];
    let center = diffusionArrayCurrent[index];
    diffusionArrayNew[index] = 0.950 * (center + 0.25 * (left + right + up + down - 4f * center));

    return;
}
