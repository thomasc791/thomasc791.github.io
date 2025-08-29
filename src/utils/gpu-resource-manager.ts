import { GPUMemoryMonitor } from './gpu-memory-monitor';

export class GPUResourceManager {
   private resources: Map<GPUBuffer | GPUTexture | GPUQuerySet, { size: number; label: string }> = new Map();
   private pipelines: Set<GPURenderPipeline | GPUComputePipeline> = new Set();
   private bindGroups: Set<GPUBindGroup> = new Set();
   private memoryMonitor = GPUMemoryMonitor.getInstance();

   registerBuffer(buffer: GPUBuffer, label?: string): GPUBuffer {
      const size = buffer.size;
      const bufferLabel = label || 'unnamed-buffer';

      this.resources.set(buffer, { size, label: bufferLabel });
      this.memoryMonitor.logBufferCreation(bufferLabel, size);
      return buffer;
   }

   registerTexture(texture: GPUTexture, label?: string): GPUTexture {
      // Estimate texture size: width * height * depth * bytesPerPixel * mipLevels
      const size = texture.width * texture.height * texture.depthOrArrayLayers * 4; // Rough estimate
      const textureLabel = label || 'unnamed-texture';

      this.resources.set(texture, { size, label: textureLabel });
      this.memoryMonitor.logBufferCreation(textureLabel, size);
      return texture;
   }

   registerPipeline(pipeline: GPURenderPipeline | GPUComputePipeline): typeof pipeline {
      this.pipelines.add(pipeline);
      return pipeline;
   }

   registerBindGroup(bindGroup: GPUBindGroup): GPUBindGroup {
      this.bindGroups.add(bindGroup);
      return bindGroup;
   }

   destroy(): void {
      console.log(`🗑️  Destroying ${this.resources.size} GPU resources...`);

      // Destroy buffers and textures with memory tracking
      for (const [resource, info] of this.resources) {
         try {
            if ('destroy' in resource) {
               resource.destroy();
               this.memoryMonitor.logBufferDestruction(info.label, info.size);
            }
         } catch (error) {
            console.warn(`Failed to destroy resource ${info.label}:`, error);
         }
      }

      // Clear all collections
      this.resources.clear();
      this.pipelines.clear();
      this.bindGroups.clear();

      console.log('✅ GPU resource cleanup complete');
   }

   getResourceCount(): { buffers: number; textures: number; pipelines: number; bindGroups: number; totalMemoryMB: number } {
      let buffers = 0;
      let textures = 0;
      let totalMemory = 0;

      for (const [resource, info] of this.resources) {
         totalMemory += info.size;
         if ('usage' in resource && 'size' in resource) {
            buffers++;
         } else if ('width' in resource && 'height' in resource) {
            textures++;
         }
      }

      return {
         buffers,
         textures,
         pipelines: this.pipelines.size,
         bindGroups: this.bindGroups.size,
         totalMemoryMB: totalMemory / 1024 / 1024
      };
   }
}
