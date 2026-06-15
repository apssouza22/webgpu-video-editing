import type { TranscriptionResult } from './types';

export function createMockTranscriptionResult(sourceId: string): TranscriptionResult {
  return {
    sourceId,
    text: 'Hello, welcome to the GPU video editor transcription demo.',
    chunks: [
      { text: ' Hello,', timestamp: [0, 0.28] },
      { text: ' welcome', timestamp: [0.6, 0.92] },
      { text: ' to', timestamp: [0.92, 1.22] },
      { text: ' the', timestamp: [1.22, 1.42] },
      { text: ' GPU', timestamp: [1.42, 1.72] },
      { text: ' video', timestamp: [1.72, 2.02] },
      { text: ' editor', timestamp: [2.02, 2.38] },
      { text: ' transcription', timestamp: [2.38, 3.02] },
      { text: ' demo.', timestamp: [3.02, 3.42] },
    ],
  };
}
