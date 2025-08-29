// The @webgpu/types package provides the main WebGPU types
// This file extends them with custom application types

// Custom types for your application
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
   physarumArrayCurrent: GPUBuffer;
   physarumArrayNew: GPUBuffer;
}

// Extend global Window interface if needed
declare global {
   interface Window {
      webgpuDevice?: GPUDevice;
   }
}
