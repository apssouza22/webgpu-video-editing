import { env } from '@huggingface/transformers';

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
}
