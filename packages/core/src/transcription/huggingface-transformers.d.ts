declare module '@huggingface/transformers' {
  export interface TransformersEnvironment {
    allowLocalModels: boolean;
    allowRemoteModels: boolean;
    remoteHost: string;
    useBrowserCache: boolean;
    backends: Record<string, unknown>;
  }

  export const env: TransformersEnvironment;

  export interface PretrainedModelOptions {
    progress_callback?: (data: unknown) => void;
    dtype?: unknown;
    device?: string;
    revision?: string;
  }

  export function pipeline(
    task: string,
    model: string,
    options?: PretrainedModelOptions,
  ): Promise<unknown>;
}
