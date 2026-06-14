import { defineConfig } from 'vite';
import { resolve } from 'path';
import dts from 'vite-plugin-dts';

export default defineConfig(({ command, mode }) => {
  if (command === 'serve' || mode === 'demo') {
    return {
      root: 'demo',
      publicDir: 'public',
      base: mode === 'demo' ? '/webgpu-video-encoding/' : '/',
      build: mode === 'demo'
        ? {
            outDir: '../docs',
            emptyOutDir: true,
          }
        : undefined,
      server: {
        port: 5180,
      },
      resolve: {
        alias: {
          '@opensource/gpu-video-encode': resolve(__dirname, 'src/index.ts'),
        },
      },
    };
  }

  return {
    plugins: [
      dts({ include: ['src'], rollupTypes: true }),
    ],
    build: {
      lib: {
        entry: resolve(__dirname, 'src/index.ts'),
        name: 'GpuVideoEncode',
        formats: ['es'],
        fileName: 'gpu-video-encode',
      },
      rollupOptions: {
        external: ['mediabunny'],
      },
    },
  };
});
