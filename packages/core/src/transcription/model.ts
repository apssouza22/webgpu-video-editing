import { env, pipeline, type PretrainedModelOptions } from '@huggingface/transformers';

import { configureTranscriptionEnv } from './configureEnv';
import { getExecDevice } from './device';
import type {
  ModelParams,
  Pipeline,
  ProgressCallback,
  TranscriptionError,
  TranscriptionResult,
} from './types';

configureTranscriptionEnv();
env.allowLocalModels = false;

const modelParams: ModelParams = {
  chunk_length_s: 30,
  stride_length_s: 5,
  return_timestamps: 'word',
  language: 'en',
};

export class PipelineFactory {
  static readonly task = 'automatic-speech-recognition';
  static readonly model = 'onnx-community/whisper-base_timestamped';
  static instance: Promise<Pipeline> | null = null;

  static async getInstance(progressCallback: ProgressCallback | null = null): Promise<Pipeline> {
    if (this.instance === null) {
      const options: PretrainedModelOptions = {
        progress_callback: progressCallback
          ? (data) => progressCallback(data as import('./types').TranscriptionProgress)
          : undefined,
        dtype:
          getExecDevice() === 'wasm'
            ? 'q8'
            : {
                encoder_model: 'fp32',
                decoder_model_merged: 'q4',
              },
        device: getExecDevice(),
      };

      this.instance = pipeline(
        PipelineFactory.task,
        PipelineFactory.model,
        options,
      ) as Promise<Pipeline>;
    }

    return this.instance;
  }
}

export async function transcribe(
  audio: Float32Array,
  sourceId: string,
  language = 'en',
): Promise<TranscriptionResult | null> {
  const modelInference = await PipelineFactory.getInstance((data) => {
    if (typeof self !== 'undefined') {
      self.postMessage(data);
    }
  });

  const params: ModelParams = {
    ...modelParams,
    language,
  };

  const start = performance.now();

  try {
    const output = await modelInference(audio, params);
    const end = performance.now();

    console.log(`Time taken to transcribe: ${(end - start) / 1000} seconds`);
    output.sourceId = sourceId;

    return output;
  } catch (error) {
    return onModelInferenceError(error as TranscriptionError);
  }
}

export function onModelInferenceError(error: TranscriptionError): null {
  console.error(error);

  if (typeof self !== 'undefined') {
    self.postMessage({
      status: 'error',
      task: PipelineFactory.task,
      data: error,
    });
  }

  return null;
}
