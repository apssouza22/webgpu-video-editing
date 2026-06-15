import { defineConfig } from 'vite';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolve } from 'path';
import dts from 'vite-plugin-dts';
import tailwindcss from '@tailwindcss/vite';

const projectRoot = dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ command }) => {
  if (command === 'serve') {
    return {
      root: 'demo',
      plugins: [tailwindcss()],
      resolve: {
        alias: {
          '@opensource/core': resolve(projectRoot, 'src/index.ts'),
          '@opensource/sidebar/style.css': resolve(projectRoot, '../sidebar/src/index.css'),
          '@opensource/sidebar': resolve(projectRoot, '../sidebar/src/index.ts'),
          '@opensource/timeline/style.css': resolve(projectRoot, '../timeline/src/view/timeline.css'),
          '@opensource/timeline': resolve(projectRoot, '../timeline/src/common/index.ts'),
          '@opensource/video-canvas/style.css': resolve(projectRoot, '../video-canvas/src/index.css'),
          '@opensource/video-canvas': resolve(projectRoot, '../video-canvas/src/index.ts'),
          '@opensource/gpu-video-encode': resolve(projectRoot, '../gpu-video-encode/src/index.ts'),
        },
      },
      worker: {
        format: 'es',
      },
      optimizeDeps: {
        exclude: ['@huggingface/transformers'],
      },
    };
  }

  return {
    plugins: [
      tailwindcss(),
      dts({ include: ['src'], rollupTypes: true }),
    ],
    build: {
      lib: {
        entry: resolve(projectRoot, 'src/index.ts'),
        name: 'GpuVideoEditorCore',
        formats: ['es'],
        fileName: 'core',
      },
      rollupOptions: {
        external: [
          '@huggingface/transformers',
          '@opensource/gpu-video-encode',
          '@opensource/sidebar',
          '@opensource/timeline',
          '@opensource/video-canvas',
          'mediabunny',
        ],
        output: {
          assetFileNames: 'core.[ext]',
        },
      },
      cssCodeSplit: false,
    },
  };
});
