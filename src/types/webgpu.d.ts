export interface WebGPUContext {
   device: GPUDevice;
   context: GPUCanvasContext;
   canvasFormat: GPUTextureFormat;
}

export interface SimulationState {
   isRunning: boolean;
   frameCount: number;
}

export interface WaveBuffers {
   waveArrayOld: GPUBuffer;
   waveArrayCurrent: GPUBuffer;
   waveArrayNew: GPUBuffer;
}

export interface DiffusionBuffers {
   diffusionArrayCurrent: GPUBuffer;
   diffusionArrayNew: GPUBuffer;
}

export interface PhysarumBuffers {
   particlePositionData: GPUBuffer;
   particleDirectionData: GPUBuffer;
}

export interface SettingsBuffers {
   settings: GPUBuffer;
   time: GPUBuffer;
}

declare global {
   interface Window {
      webgpuDevice?: GPUDevice;
   }
}
