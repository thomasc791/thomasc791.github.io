import { WebGPUContext } from '../types/webgpu';

export class WebGPUUtils {
   private static device: GPUDevice | null = null;

   static async checkWebGPUSupport(): Promise<boolean> {
      const supportDiv = document.getElementById('webgpu-support');

      if (!navigator.gpu) {
         this.showError(supportDiv, 'WebGPU is not supported in this browser.');
         return false;
      }

      try {
         const adapter = await navigator.gpu.requestAdapter();
         if (!adapter) {
            this.showError(supportDiv, 'Failed to get WebGPU adapter.');
            return false;
         }

         this.device = await adapter.requestDevice();
         return true;
      } catch (error) {
         this.showError(supportDiv, `WebGPU error: ${error instanceof Error ? error.message : 'Unknown error'}`);
         return false;
      }
   }

   static async initWebGPU(canvasId: string): Promise<WebGPUContext | null> {
      const canvas = document.getElementById(canvasId) as HTMLCanvasElement;
      if (!canvas) return null;

      if (!this.device) {
         const supported = await this.checkWebGPUSupport();
         if (!supported) return null;
      }

      const context = canvas.getContext('webgpu');
      if (!context) return null;

      const canvasFormat = navigator.gpu.getPreferredCanvasFormat();

      context.configure({
         device: this.device!,
         format: canvasFormat,
      });

      return {
         device: this.device!,
         context,
         canvasFormat,
      };
   }

   private static showError(element: HTMLElement | null, message: string): void {
      if (element) {
         element.style.display = 'block';
         element.textContent = message;
      }
   }

   static createShaderModule(device: GPUDevice, code: string, label?: string): GPUShaderModule {
      return device.createShaderModule({
         code,
         ...(label && { label })
      });
   }
}
