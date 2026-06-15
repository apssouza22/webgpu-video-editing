import { env } from '@huggingface/transformers';

const ONNX_RUNTIME_VERSION = '1.22.0-dev.20250409-89f8206ba4';

/**
 * Configures Transformers.js for browser/worker usage with Vite.
 * Disables poisoned `/models/` cache entries that Vite serves as index.html.
 */
export function configureTranscriptionEnv(): void {
  env.allowLocalModels = false;
  env.allowRemoteModels = true;
  env.remoteHost = 'https://huggingface.co/';

  const isDev = import.meta.env.DEV;

  if (isDev) {
    env.useBrowserCache = false;
  }

  const onnxBackend = env.backends.onnx as {
    wasm?: Record<string, unknown>;
  };

  onnxBackend.wasm = {
    ...onnxBackend.wasm,
    wasmPaths: `https://cdn.jsdelivr.net/npm/onnxruntime-web@${ONNX_RUNTIME_VERSION}/dist/`,
  };
}
