import { VideoEditor } from '@opensource/core';

const DEMO_VIDEO_URL = '/demo.mp4';

const timelineEl = document.getElementById('timeline');
const canvasEl = document.getElementById('canvas');
const sidebarEl = document.getElementById('sidebar');

if (!timelineEl || !canvasEl || !sidebarEl) {
  throw new Error('Demo layout is missing #timeline, #canvas, or #sidebar');
}

const editor = new VideoEditor(
  {
    timelineContainer: timelineEl,
    canvasContainer: canvasEl,
    sidebarContainer: sidebarEl,
  },
  {
    transcription: { mockTranscription: false },
    project: {
      onStatus: (status) => {
        console.debug('[project]', status);
      },
    },
    sidebar: {
      initialPanel: 'media',
    },
  },
);

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
  editor.canvas.selectElement(null);
  editor.sidebar?.setActivePanel('media');
}

void seedDemo();

document.getElementById('new-project')?.addEventListener('click', () => {
  void editor.projectPersistence?.createProject('Untitled project');
});

document.getElementById('open-project')?.addEventListener('click', () => {
  void editor.projectPersistence?.openProject();
});

document.getElementById('import-media')?.addEventListener('click', () => {
  void editor.projectPersistence?.importMedia();
});

editor.sidebar?.on('property:changed', (payload) => {
  console.debug('[sidebar] property:changed', {
    key: payload.key,
    value: payload.value,
    element: payload.element.name,
  });
});

window.addEventListener('beforeunload', () => {
  editor.destroy();
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
