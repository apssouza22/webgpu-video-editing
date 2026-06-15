import { defineConfig } from 'vite';
import { resolve } from 'path';
import dts from 'vite-plugin-dts';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ command }) => {
  if (command === 'serve') {
    return {
      root: 'demo',
      plugins: [tailwindcss()],
      resolve: {
        alias: {
          '@opensource/core': resolve(__dirname, 'src/index.ts'),
          '@opensource/sidebar/style.css': resolve(__dirname, '../sidebar/src/index.css'),
          '@opensource/sidebar': resolve(__dirname, '../sidebar/src/index.ts'),
          '@opensource/timeline/style.css': resolve(__dirname, '../timeline/src/view/timeline.css'),
          '@opensource/timeline': resolve(__dirname, '../timeline/src/common/index.ts'),
          '@opensource/video-canvas/style.css': resolve(__dirname, '../video-canvas/src/index.css'),
          '@opensource/video-canvas': resolve(__dirname, '../video-canvas/src/index.ts'),
          '@opensource/gpu-video-encode': resolve(__dirname, '../gpu-video-encode/src/index.ts'),
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
        entry: resolve(__dirname, 'src/index.ts'),
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
