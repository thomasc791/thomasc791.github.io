@compute @workgroup_size(64)
fn cs(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let resolution = vec2<u32>(RESOLUTION_WIDTHu, RESOLUTION_HEIGHTu);
}
