import { VideoEditor } from '@opensource/core';

const DEMO_VIDEO_URL = '/demo.mp4';

const timelineEl = document.getElementById('timeline');
const canvasEl = document.getElementById('canvas');
const leftNavEl = document.getElementById('leftnav');

if (!timelineEl || !canvasEl || !leftNavEl) {
  throw new Error('Demo layout is missing #timeline, #canvas, or #leftnav');
}

const editor = new VideoEditor(
  {
    timelineContainer: timelineEl,
    previewContainer: canvasEl,
    leftNavContainer: leftNavEl,
  },
  {
    transcription: { mockTranscription: true },
    leftNav: {
      initialPanel: 'media',
    },
  },
);

void seedDemo();

async function seedDemo(): Promise<void> {
  const duration = await probeUrlDuration(DEMO_VIDEO_URL);
  editor.timeline.addClip({
    type: 'video',
    name: 'demo.mp4',
    duration,
    url: DEMO_VIDEO_URL,
    hasAudio: true,
    startTime: 0,
  });
  editor.preview.selectElement(null);
  editor.leftNav?.setActivePanel('media');
}

editor.leftNav?.on('property:changed', (payload) => {
  console.debug('[leftnav] property:changed', {
    key: payload.key,
    value: payload.value,
    element: payload.element.name,
  });
});

function probeUrlDuration(url: string): Promise<number> {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.onloadedmetadata = () => {
      resolve(Number.isFinite(video.duration) ? video.duration : 5);
    };
    video.onerror = () => resolve(5);
    video.src = url;
  });
}
