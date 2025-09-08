import { Plugin } from 'vite';
import { readFileSync } from 'fs';
import { resolve } from 'path';

export function wgslPlugin(): Plugin {
   return {
      name: 'wgsl-loader',
      load(id) {
         if (id.endsWith('.wgsl')) {
            const content = readFileSync(id, 'utf-8');
            return `export default ${JSON.stringify(content)};`;
         }
      },
      resolveId(id, importer) {
         if (id.endsWith('.wgsl')) {
            return resolve(id);
         }
      }
   };
}
