import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
   root: 'public',
   build: {
      outDir: '../dist',
      emptyOutDir: true,
      rollupOptions: {
         input: {
            main: resolve(__dirname, 'public/index.html')
         }
      }
   },
   resolve: {
      alias: {
         '@': resolve(__dirname, 'src'),
      },
   },
   server: {
      port: 3000,
      open: true,
      host: true, // Allow external connections for testing on mobile devices
   },
   // Enable top-level await and other modern features
   esbuild: {
      target: 'es2022'
   },

   assetsInclude: ['**/*.wgsl'],
});
