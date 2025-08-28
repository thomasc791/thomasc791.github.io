(function(){const e=document.createElement("link").relList;if(e&&e.supports&&e.supports("modulepreload"))return;for(const n of document.querySelectorAll('link[rel="modulepreload"]'))r(n);new MutationObserver(n=>{for(const a of n)if(a.type==="childList")for(const i of a.addedNodes)i.tagName==="LINK"&&i.rel==="modulepreload"&&r(i)}).observe(document,{childList:!0,subtree:!0});function t(n){const a={};return n.integrity&&(a.integrity=n.integrity),n.referrerPolicy&&(a.referrerPolicy=n.referrerPolicy),n.crossOrigin==="use-credentials"?a.credentials="include":n.crossOrigin==="anonymous"?a.credentials="omit":a.credentials="same-origin",a}function r(n){if(n.ep)return;n.ep=!0;const a=t(n);fetch(n.href,a)}})();class l{static device=null;static async checkWebGPUSupport(){const e=document.getElementById("webgpu-support");if(!navigator.gpu)return this.showError(e,"WebGPU is not supported in this browser."),!1;try{const t=await navigator.gpu.requestAdapter();return t?(this.device=await t.requestDevice(),!0):(this.showError(e,"Failed to get WebGPU adapter."),!1)}catch(t){return this.showError(e,`WebGPU error: ${t instanceof Error?t.message:"Unknown error"}`),!1}}static async initWebGPU(e){const t=document.getElementById(e);if(!t||!this.device&&!await this.checkWebGPUSupport())return null;const r=t.getContext("webgpu");if(!r)return null;const n=navigator.gpu.getPreferredCanvasFormat();return r.configure({device:this.device,format:n}),{device:this.device,context:r,canvasFormat:n}}static showError(e,t){e&&(e.style.display="block",e.textContent=t)}static createShaderModule(e,t,r){return e.createShaderModule({code:t,...r&&{label:r}})}}class g{animationId=null;async init(){const e=document.getElementById("home-canvas");if(!e)return;e.width=window.innerWidth,e.height=window.innerHeight;const t=await l.initWebGPU("home-canvas");if(!t)return;const{device:r,context:n,canvasFormat:a}=t,i=this.createHomeFragmentShader(),o=this.createFullscreenVertexShader(),u=l.createShaderModule(r,o,"homeVertex"),d=l.createShaderModule(r,i,"homeFragment"),c=r.createRenderPipeline({layout:"auto",vertex:{module:u,entryPoint:"vs_main"},fragment:{module:d,entryPoint:"fs_main",targets:[{format:a}]},primitive:{topology:"triangle-list"}});this.render(r,n,c)}createHomeFragmentShader(){return`
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
    `}createFullscreenVertexShader(){return`
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
    `}render(e,t,r){const n=e.createCommandEncoder(),a={colorAttachments:[{view:t.getCurrentTexture().createView(),clearValue:{r:0,g:0,b:0,a:1},loadOp:"clear",storeOp:"store"}]},i=n.beginRenderPass(a);i.setPipeline(r),i.draw(6),i.end(),e.queue.submit([n.finish()])}destroy(){this.animationId&&(cancelAnimationFrame(this.animationId),this.animationId=null)}}class y{animationId=null;isDrawing=!1;async init(){const e=document.getElementById("waves-canvas");if(!e)return;e.width=window.innerWidth,e.height=window.innerHeight;const t=await l.initWebGPU("waves-canvas");if(!t)return;const{device:r,context:n,canvasFormat:a}=t,i=l.createShaderModule(r,this.createWaveComputeShader(),"waveCompute"),o=l.createShaderModule(r,this.createFullscreenVertexShader(),"waveVertex"),u=l.createShaderModule(r,this.createWaveFragmentShader(),"waveFragment"),d=r.createComputePipeline({layout:"auto",compute:{module:i,entryPoint:"cs"}}),c=r.createRenderPipeline({label:"WaveRenderPipeline",layout:"auto",vertex:{module:o,entryPoint:"vs"},fragment:{module:u,entryPoint:"fs",targets:[{format:a}]},primitive:{topology:"triangle-list"}}),f=this.createWaveArrayData(e.width,e.height,8,2),s=this.initWaveArrays(r,f,e.width,e.height),h=r.createBindGroup({layout:d.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:s.waveArrayOld}},{binding:1,resource:{buffer:s.waveArrayCurrent}},{binding:2,resource:{buffer:s.waveArrayNew}}]}),m=r.createBindGroup({layout:c.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:s.waveArrayOld}},{binding:1,resource:{buffer:s.waveArrayCurrent}},{binding:2,resource:{buffer:s.waveArrayNew}}]});this.setupMouseEvents(e,r,s.waveArrayCurrent),this.startRenderLoop(r,n,d,c,h,m,e)}setupMouseEvents(e,t,r){e.addEventListener("mousemove",n=>{if(this.isDrawing){let a=n.clientY*e.width+n.clientX-Math.floor(e.width/2);const i=new Float32Array(1);i[0]=1,t.queue.writeBuffer(r,a*4,i)}}),e.addEventListener("mousedown",n=>{this.isDrawing=!this.isDrawing})}startRenderLoop(e,t,r,n,a,i,o){function u(){const d=e.createCommandEncoder(),c=d.beginComputePass();c.setPipeline(r),c.setBindGroup(0,a),c.dispatchWorkgroups(Math.ceil(o.width/16),Math.ceil(o.height/4)),c.end();const f={colorAttachments:[{view:t.getCurrentTexture().createView(),clearValue:{r:0,g:0,b:0,a:1},loadOp:"clear",storeOp:"store"}]},s=d.beginRenderPass(f);s.setPipeline(n),s.setBindGroup(0,i),s.draw(6),s.end(),e.queue.submit([d.finish()]),requestAnimationFrame(u)}requestAnimationFrame(u)}createWaveArrayData(e,t,r,n){const a=Array(e*t).fill(0);for(let i=-r;i<r;i++)for(let o=-r;o<r;o++){if(i*i+o*o>r*r)continue;const u=(i+Math.floor(t/2))*e+o+e;u>=0&&u<a.length&&(a[u]=n)}return new Float32Array(a)}initWaveArrays(e,t,r,n){const a=()=>e.createBuffer({size:r*n*4,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC|GPUBufferUsage.COPY_DST}),i={waveArrayOld:a(),waveArrayCurrent:a(),waveArrayNew:a()};return Object.values(i).forEach(o=>{e.queue.writeBuffer(o,0,t)}),i}createWaveComputeShader(){return`
      @group(0) @binding(0) var<storage, read_write> waveArrayOld: array<f32>;
      @group(0) @binding(1) var<storage, read_write> waveArrayCurrent: array<f32>;
      @group(0) @binding(2) var<storage, read_write> waveArrayNew: array<f32>;
      
      @compute @workgroup_size(16, 4)
      fn cs(@builtin(global_invocation_id) global_id: vec3<u32>) {
         let resolution = vec2<u32>(${window.innerWidth}, ${window.innerHeight});
         let i = global_id.x;
         let j = global_id.y;

         let index = j*resolution.x + i;

         if (i == 0 || i == resolution.x || j == 0 || j == resolution.y) {
            waveArrayNew[u32(index)] = 0.0;
         }

         let left = waveArrayCurrent[index-1];
         let right = waveArrayCurrent[index+1];
         let up = waveArrayCurrent[(index - resolution.x)];
         let down = waveArrayCurrent[(index + resolution.x)];
         let center = waveArrayCurrent[index];
         let old = waveArrayOld[index];
         waveArrayNew[index] = 0.99 * (2f * center - old + 0.25 * ( left + right + up + down - 4 * center ));

         return;
      }
   `}createFullscreenVertexShader(){return`
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
   `}createWaveFragmentShader(){return`
      @group(0) @binding(0) var<storage, read_write> waveArrayOld: array<f32>;
      @group(0) @binding(1) var<storage, read_write> waveArrayCurrent: array<f32>;
      @group(0) @binding(2) var<storage, read_write> waveArrayNew: array<f32>;

      @fragment
      fn fs(@builtin(position) fragCoord: vec4<f32>) -> @location(0) vec4<f32> {
         let resolution = vec2<f32>(f32(${window.innerWidth}), f32(${window.innerHeight}));
         let stepX = 1/resolution.x;
         let stepY = 1/resolution.y;

         let index = fragCoord.y*resolution.x+fragCoord.x;
         let i = u32(index);
 
         waveArrayOld[i] = waveArrayCurrent[i];
         waveArrayCurrent[i] = waveArrayNew[i];
         let current = waveArrayCurrent[i];
         let old = waveArrayOld[i];
         let positive = max(sign(current), 0) * current;
         let negative = max(sign(-current), 0) * -1*current;
         return 10*positive*vec4<f32>(0.3, 0.3, 1.0, 1.0) + 10*negative*vec4<f32>(1.0, 0.3, 0.3, 1.0);
         // return vec4<f32>(fragCoord.y/resolution.y, 0.0, 0.0, 1.0);
       }
   `}destroy(){this.animationId&&(cancelAnimationFrame(this.animationId),this.animationId=null)}}class p{animationId=null;async init(){const e=document.getElementById("physarum-canvas");if(!e)return;e.width=window.innerWidth,e.height=window.innerHeight;const t=await l.initWebGPU("physarum-canvas");if(!t)return;const{device:r,context:n,canvasFormat:a}=t,i=l.createShaderModule(r,this.createPhysarumComputeShader(),"PhysarumCompute"),o=l.createShaderModule(r,this.createFullscreenVertexShader(),"PhysarumVertex"),u=l.createShaderModule(r,this.createPhysarumFragmentShader(),"PhysarumFragment"),d=r.createComputePipeline({layout:"auto",compute:{module:i,entryPoint:"cs"}}),c=r.createRenderPipeline({label:"PhysarumRenderPipeline",layout:"auto",vertex:{module:o,entryPoint:"vs"},fragment:{module:u,entryPoint:"fs",targets:[{format:a}]},primitive:{topology:"triangle-list"}}),f=this.createPhysarumArrayData(e.width,e.height,8,2),s=this.initPhysarumArrays(r,f,e.width,e.height),h=r.createBindGroup({layout:d.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:s.physarumArrayOld}},{binding:1,resource:{buffer:s.physarumArrayCurrent}},{binding:2,resource:{buffer:s.physarumArrayNew}}]}),m=r.createBindGroup({layout:c.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:s.physarumArrayOld}},{binding:1,resource:{buffer:s.physarumArrayCurrent}},{binding:2,resource:{buffer:s.physarumArrayNew}}]});this.startRenderLoop(r,n,d,c,h,m,e)}startRenderLoop(e,t,r,n,a,i,o){function u(){const d=e.createCommandEncoder(),c=d.beginComputePass();c.setPipeline(r),c.setBindGroup(0,a),c.dispatchWorkgroups(Math.ceil(o.width/16),Math.ceil(o.height/4)),c.end();const f={colorAttachments:[{view:t.getCurrentTexture().createView(),clearValue:{r:0,g:0,b:0,a:1},loadOp:"clear",storeOp:"store"}]},s=d.beginRenderPass(f);s.setPipeline(n),s.setBindGroup(0,i),s.draw(6),s.end(),e.queue.submit([d.finish()]),requestAnimationFrame(u)}requestAnimationFrame(u)}createPhysarumArrayData(e,t,r,n){const a=Array(e*t).fill(0);for(let i=-r;i<r;i++)for(let o=-r;o<r;o++){if(i*i+o*o>r*r)continue;const u=(i+Math.floor(t/2))*e+o+e;u>=0&&u<a.length&&(a[u]=n)}return new Float32Array(a)}initPhysarumArrays(e,t,r,n){const a=()=>e.createBuffer({size:r*n*4,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC|GPUBufferUsage.COPY_DST}),i={physarumArrayOld:a(),physarumArrayCurrent:a(),physarumArrayNew:a()};return Object.values(i).forEach(o=>{e.queue.writeBuffer(o,0,t)}),i}createPhysarumComputeShader(){return`
      @group(0) @binding(0) var<storage, read_write> waveArrayOld: array<f32>;
      @group(0) @binding(1) var<storage, read_write> waveArrayCurrent: array<f32>;
      @group(0) @binding(2) var<storage, read_write> waveArrayNew: array<f32>;
      
      @compute @workgroup_size(16, 4)
      fn cs(@builtin(global_invocation_id) global_id: vec3<u32>) {
         let resolution = vec2<u32>(${window.innerWidth}, ${window.innerHeight});
         let i = global_id.x;
         let j = global_id.y;

         let index = j*resolution.x + i;

         if (i == 0 || i == resolution.x || j == 0 || j == resolution.y) {
            waveArrayNew[u32(index)] = 0.0;
         }

         let left = waveArrayCurrent[index-1];
         let right = waveArrayCurrent[index+1];
         let up = waveArrayCurrent[(index - resolution.x)];
         let down = waveArrayCurrent[(index + resolution.x)];
         let center = waveArrayCurrent[index];
         let old = waveArrayOld[index];
         waveArrayNew[index] = 0.99 * (2f * center - old + 0.25 * ( left + right + up + down - 4 * center ));

         return;
      }
   `}createFullscreenVertexShader(){return`
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
   `}createPhysarumFragmentShader(){return`
      @group(0) @binding(0) var<storage, read_write> waveArrayOld: array<f32>;
      @group(0) @binding(1) var<storage, read_write> waveArrayCurrent: array<f32>;
      @group(0) @binding(2) var<storage, read_write> waveArrayNew: array<f32>;

      @fragment
      fn fs(@builtin(position) fragCoord: vec4<f32>) -> @location(0) vec4<f32> {
         let resolution = vec2<f32>(f32(${window.innerWidth}), f32(${window.innerHeight}));
         let stepX = 1/resolution.x;
         let stepY = 1/resolution.y;

         let index = fragCoord.y*resolution.x+fragCoord.x;
         let i = u32(index);
 
         waveArrayOld[i] = waveArrayCurrent[i];
         waveArrayCurrent[i] = waveArrayNew[i];
         let current = waveArrayCurrent[i];
         let old = waveArrayOld[i];
         let positive = max(sign(current), 0) * current;
         let negative = max(sign(-current), 0) * -1*current;
         return 10*positive*vec4<f32>(0.3, 0.3, 1.0, 1.0) + 10*negative*vec4<f32>(1.0, 0.3, 0.3, 1.0);
         // return vec4<f32>(fragCoord.y/resolution.y, 0.0, 0.0, 1.0);
       }
   `}destroy(){this.animationId&&(cancelAnimationFrame(this.animationId),this.animationId=null)}}class w{currentSimulation=null;navLinks;pages;navbar;constructor(){this.navLinks=document.querySelectorAll(".nav-link"),this.pages=document.querySelectorAll(".page"),this.navbar=document.querySelector(".navbar"),this.initNavigation()}initNavigation(){this.navLinks.forEach(e=>{e.addEventListener("click",t=>{t.preventDefault();const r=e.getAttribute("data-page");console.log(r),r&&this.navigateToPage(r)})})}async navigateToPage(e){this.currentSimulation&&"destroy"in this.currentSimulation&&this.currentSimulation.destroy(),this.updateNavigation(e),await this.initSimulation(e)}updateNavigation(e){this.navLinks.forEach(t=>t.classList.remove("active")),document.querySelector(`[data-page="${e}"]`)?.classList.add("active"),this.pages.forEach(t=>t.classList.remove("active")),document.getElementById(e)?.classList.add("active"),this.navbar?.classList.remove("show")}async initSimulation(e){try{switch(e){case"home":this.currentSimulation=new g,await this.currentSimulation.init();break;case"physarum":this.currentSimulation=new p,await this.currentSimulation.init();break;case"waves":this.currentSimulation=new y,await this.currentSimulation.init();break}}catch(t){console.error(`Failed to initialize ${e} simulation:`,t)}}}document.addEventListener("DOMContentLoaded",()=>{console.log("works"),new w});
