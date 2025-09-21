import raysComputeShaderCode from '/shaders/rays/computeShader.wgsl?raw'
import raysVertexShaderCode from '/shaders/rays/vertexShader.wgsl?raw'
import raysFragmentShaderCode from '/shaders/rays/fragmentShader.wgsl?raw'
import wavesComputeShaderCode from '/shaders/waves/computeShader.wgsl?raw'
import wavesVertexShaderCode from '/shaders/waves/vertexShader.wgsl?raw'
import wavesFragmentShaderCode from '/shaders/waves/fragmentShader.wgsl?raw'
import physarumMovementShader from '/shaders/physarum/movementShader.wgsl?raw'
import physarumDiffusionShader from '/shaders/physarum/diffusionShader.wgsl?raw'
import physarumVertexShader from '/shaders/physarum/vertexShader.wgsl?raw'
import physarumFragmentShader from '/shaders/physarum/fragmentShader.wgsl?raw'

const shaderDict: Record<string, string> = {
   'rays/compute': raysComputeShaderCode,
   'rays/vertex': raysVertexShaderCode,
   'rays/fragment': raysFragmentShaderCode,
   'waves/compute': wavesComputeShaderCode,
   'waves/vertex': wavesVertexShaderCode,
   'waves/fragment': wavesFragmentShaderCode,
   'physarum/movement': physarumMovementShader,
   'physarum/diffuse': physarumDiffusionShader,
   'physarum/vertex': physarumVertexShader,
   'physarum/fragment': physarumFragmentShader,
};

export class ShaderLoader {
   private static shaderCache = new Map<string, string>();

   static async loadShader(shader: string, replacements: Record<string, string | number> = {}): Promise<string> {
      if (this.shaderCache.has(shader)) {
         return this.processReplacements(this.shaderCache.get(shader)!, replacements);
      }

      try {
         const shaderCode = shaderDict[shader];

         this.shaderCache.set(shader, shaderCode);
         return this.processReplacements(shaderCode, replacements);
      } catch (error) {
         console.log(`Shader ${shader} not found...`);
         throw error;
      }
   }

   private static processReplacements(shader: string, replacements: Record<string, string | number> = {}): string {
      for (const [key, value] of Object.entries(replacements)) {
         const regex = new RegExp(key, 'g');
         shader = shader.replace(regex, value.toString());
      }

      return shader;
   }

   static clearCache(): void {
      this.shaderCache.clear();
   }
}
