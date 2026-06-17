import { onModelInferenceError, PipelineFactory, transcribe } from './model';
import type {
  LoadModelMessage,
  TranscribeMessage,
  TranscriptionError,
  WorkerMessage,
  WorkerResponseMessage,
} from './types';

function isLoadModelMessage(message: WorkerMessage): message is LoadModelMessage {
  return message.task === 'load-model';
}

function isTranscribeMessage(message: WorkerMessage): message is TranscribeMessage {
  return message.audio !== undefined;
}

self.addEventListener('message', async (event: MessageEvent<WorkerMessage>) => {
  const message = event.data;

  if (!message) {
    return;
  }

  if (isLoadModelMessage(message)) {
    console.log('Loading transcription model...');
    try {
      await PipelineFactory.getInstance((data) => {
        self.postMessage(data);
      });
    } catch (error) {
      onModelInferenceError(error as TranscriptionError);
    }
    return;
  }

  if (isTranscribeMessage(message)) {
    const transcript = await transcribe(message.audio, message.sourceId);
    if (transcript === null) {
      return;
    }

    const responseMessage: WorkerResponseMessage = {
      status: 'complete',
      task: 'automatic-speech-recognition',
      data: transcript,
    };

    self.postMessage(responseMessage);
    return;
  }

  console.warn('Unknown message received in worker:', message);
});
