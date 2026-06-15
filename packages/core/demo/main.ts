import { VideoEditor } from '@opensource/core';

const timelineEl = document.getElementById('timeline');
const canvasEl = document.getElementById('canvas');
const sidebarEl = document.getElementById('sidebar');

if (!timelineEl || !canvasEl || !sidebarEl) {
  throw new Error('Demo layout is missing #timeline, #canvas, or #sidebar');
}

const editor = new VideoEditor({
  timelineContainer: timelineEl,
  canvasContainer: canvasEl,
  sidebarContainer: sidebarEl,
});

editor.timeline.addClip({
  type: 'text',
  name: 'Title',
  duration: 5,
  textContent: 'GPU Video Editor',
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
