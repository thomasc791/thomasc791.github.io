// Navigation functionality
const navLinks = document.querySelectorAll('.nav-link');
const pages = document.querySelectorAll('.page');
const mobileToggle = document.querySelector('.mobile-toggle');
const navMenu = document.querySelector('.nav-menu');
const navbar = document.querySelector('.navbar');
const navbarTrigger = document.querySelector('.navbar-trigger');

// Show navbar on hover over trigger area
navbarTrigger.addEventListener('mouseenter', () => {
   navbar.classList.add('show');
});

// Hide navbar when mouse leaves
navbar.addEventListener('mouseleave', () => {
   navbar.classList.remove('show');
});

// Page navigation with auto-initialization
navLinks.forEach(link => {
   link.addEventListener('click', (e) => {
      e.preventDefault();
      const targetPage = link.getAttribute('data-page');

      // Update active nav link
      navLinks.forEach(l => l.classList.remove('active'));
      link.classList.add('active');

      // Show target page
      pages.forEach(p => p.classList.remove('active'));
      document.getElementById(targetPage).classList.add('active');

      // Auto-initialize the simulation
      setTimeout(() => {
         if (targetPage === 'home') initHome();
         else if (targetPage === 'physarum') initPhysarum();
         else if (targetPage === 'waves') initWaves();
      }, 100);

      // Close mobile menu
      navbar.classList.remove('show');
   });
});

// Mobile menu toggle
mobileToggle.addEventListener('click', () => {
   navbar.classList.toggle('show');
});

// WebGPU Boilerplate
let device = null;
let context = null;
let isAnimating = false;

async function checkWebGPUSupport() {
   const supportDiv = document.getElementById('webgpu-support');

   if (!navigator.gpu) {
      supportDiv.style.display = 'block';
      supportDiv.textContent = 'WebGPU is not supported in this browser.';
      return false;
   }

   try {
      const adapter = await navigator.gpu.requestAdapter();
      if (!adapter) {
         supportDiv.style.display = 'block';
         supportDiv.textContent = 'Failed to get WebGPU adapter.';
         return false;
      }

      device = await adapter.requestDevice();
      return true;
   } catch (error) {
      supportDiv.style.display = 'block';
      supportDiv.textContent = `WebGPU error: ${error.message}`;
      return false;
   }
}

async function initWebGPU(canvasId) {
   const canvas = document.getElementById(canvasId);
   if (!canvas) return null;

   if (!device) {
      const supported = await checkWebGPUSupport();
      if (!supported) return null;
   }

   context = canvas.getContext('webgpu');
   const canvasFormat = navigator.gpu.getPreferredCanvasFormat();

   context.configure({
      device: device,
      format: canvasFormat,
   });

   return { device, context, canvasFormat };
}

// Basic vertex shader (triangle)
const basicVertexShader = `
   @vertex
   fn vs_main(@builtin(vertex_index) vertexIndex: u32) -> @builtin(position) vec4<f32> {
       var pos = array<vec2<f32>, 3>(
           vec2<f32>( 0.0,  0.5),
           vec2<f32>(-0.5, -0.5),
           vec2<f32>( 0.5, -0.5)
       );
       return vec4<f32>(pos[vertexIndex], 0.0, 1.0);
   }
`;

// Basic fragment shader (solid color)
const basicFragmentShader = `
   @fragment
   fn fs_main() -> @location(0) vec4<f32> {
       return vec4<f32>(0.486, 0.227, 0.929, 1.0); // Purple color
   }
`;

// Auto-initialize simulations when pages load
async function initHome() {
   const canvas = document.getElementById('home-canvas');
   canvas.width = window.innerWidth;
   canvas.height = window.innerHeight;

   const webgpu = await initWebGPU('home-canvas');
   if (!webgpu) return;

   const { device, context, canvasFormat } = webgpu;

   // Simple gradient background for home
   const homeFragmentShader = `
       @fragment
       fn fs_main(@builtin(position) fragCoord: vec4<f32>) -> @location(0) vec4<f32> {
           let resolution = vec2<f32>(f32(${window.innerWidth}), f32(${window.innerHeight}));
           let uv = fragCoord.xy / resolution;
           
           let color = mix(
               vec3<f32>(0.051, 0.067, 0.090),
               vec3<f32>(0.486, 0.227, 0.929),
               uv.y
           );
           
           return vec4<f32>(color, 1.0);
       }
   `;

   const fullscreenVertexShader = `
       @vertex
       fn vs_main(@builtin(vertex_index) vertexIndex: u32) -> @builtin(position) vec4<f32> {
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

   const vertexShaderModule = device.createShaderModule({ code: fullscreenVertexShader });
   const fragmentShaderModule = device.createShaderModule({ code: homeFragmentShader });

   const pipeline = device.createRenderPipeline({
      layout: 'auto',
      vertex: {
         module: vertexShaderModule,
         entryPoint: 'vs_main',
      },
      fragment: {
         module: fragmentShaderModule,
         entryPoint: 'fs_main',
         targets: [{ format: canvasFormat }],
      },
      primitive: {
         topology: 'triangle-list',
      },
   });

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
      renderPass.setPipeline(pipeline);
      renderPass.draw(6);
      renderPass.end();

      device.queue.submit([commandEncoder.finish()]);
   }

   render();
}

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

async function initWaves() {
   const canvas = document.getElementById('waves-canvas');
   canvas.width = window.innerWidth;
   canvas.height = window.innerHeight;

   const webgpu = await initWebGPU('waves-canvas');
   if (!webgpu) return;

   const { device, context, canvasFormat } = webgpu;

   const waveFragmentShader = `
       @fragment
       fn fs_main(@builtin(position) fragCoord: vec4<f32>) -> @location(0) vec4<f32> {
           let resolution = vec2<f32>(f32(${window.innerWidth}), f32(${window.innerHeight}));
           let uv = (fragCoord.xy - 0.5 * resolution) / resolution.y;
           let time = 0.0; // Will be animated later
           
           let d = length(uv);
           let wave = sin(d * 8.0 - time * 3.0) / (8.0 * d);
           let intensity = abs(wave);
           
           let color = vec3<f32>(
               0.2 + intensity * 0.8,
               0.4 + intensity * 0.6,
               0.8 + intensity * 0.2
           );
           
           return vec4<f32>(color, 1.0);
       }
   `;

   const fullscreenVertexShader = `
       @vertex
       fn vs_main(@builtin(vertex_index) vertexIndex: u32) -> @builtin(position) vec4<f32> {
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

   const vertexShaderModule = device.createShaderModule({ code: fullscreenVertexShader });
   const fragmentShaderModule = device.createShaderModule({ code: waveFragmentShader });

   const pipeline = device.createRenderPipeline({
      layout: 'auto',
      vertex: {
         module: vertexShaderModule,
         entryPoint: 'vs_main',
      },
      fragment: {
         module: fragmentShaderModule,
         entryPoint: 'fs_main',
         targets: [{ format: canvasFormat }],
      },
      primitive: {
         topology: 'triangle-list',
      },
   });

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
      renderPass.setPipeline(pipeline);
      renderPass.draw(6);
      renderPass.end();

      device.queue.submit([commandEncoder.finish()]);
   }

   render();
}

// Initialize on load
window.onload = function() {
   checkWebGPUSupport();
   initHome(); // Auto-start home page
};

// Handle canvas resizing
window.addEventListener('resize', () => {
   const canvases = document.querySelectorAll('canvas');
   canvases.forEach(canvas => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
   });

   // Reinitialize current page
   const activePage = document.querySelector('.page.active');
   if (activePage) {
      const pageId = activePage.id;
      setTimeout(() => {
         if (pageId === 'home') initHome();
         else if (pageId === 'physarum') initPhysarum();
         else if (pageId === 'waves') initWaves();
      }, 100);
   }
});
