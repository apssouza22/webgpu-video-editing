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
          '@opensource/sidebar': resolve(__dirname, 'src/index.ts'),
          '@opensource/video-preview/style.css': resolve(__dirname, '../video-preview/src/index.css'),
          '@opensource/video-preview': resolve(__dirname, '../video-preview/src/index.ts'),
        },
      },
      server: {
        port: 5552,
        strictPort: true,
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
        name: 'Sidebar',
        formats: ['es'],
        fileName: 'sidebar',
      },
      rollupOptions: {
        external: ['@opensource/video-preview'],
        output: {
          assetFileNames: 'sidebar.[ext]',
        },
      },
      cssCodeSplit: false,
    },
  };
});
