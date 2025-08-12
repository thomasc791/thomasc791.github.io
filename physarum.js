async function initPhysarum() {
   const canvas = document.getElementById('physarum-canvas');
   canvas.width = window.innerWidth;
   canvas.height = window.innerHeight;

   // Placeholder for physarum - just black screen for now
   const webgpu = await initWebGPU('physarum-canvas');
   if (!webgpu) return;

   const { device, context } = webgpu;

   function render() {
      const commandEncoder = device.createCommandEncoder();
      const renderPassDescriptor = {
         colorAttachments: [{
            view: context.getCurrentTexture().createView(),
            clearValue: { r: 0, g: 0, b: 0, a: 1.0 },
            loadOp: 'clear',
            storeOp: 'store',
         }],
      };

      const renderPass = commandEncoder.beginRenderPass(renderPassDescriptor);
      renderPass.end();

      device.queue.submit([commandEncoder.finish()]);
   }

   render();
}
