import { VideoEditor } from '@opensource/core';

const timelineEl = document.getElementById('timeline');
const canvasEl = document.getElementById('canvas');

if (!timelineEl || !canvasEl) {
  throw new Error('Demo layout is missing #timeline or #canvas');
}

const editor = new VideoEditor({
  timelineContainer: timelineEl,
  canvasContainer: canvasEl,
});

editor.timeline.addClip({
  type: 'text',
  name: 'Title',
  duration: 5,
  textContent: 'GPU Video Editor',
});

window.addEventListener('beforeunload', () => {
  editor.destroy();
});
