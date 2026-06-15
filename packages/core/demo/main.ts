import {
  VideoEditor,
  type ExportFormat,
  type ExportQuality,
  type ExportResolutionPreset,
} from '@opensource/core';

const timelineEl = document.getElementById('timeline');
const canvasEl = document.getElementById('canvas');
const sidebarEl = document.getElementById('sidebar');
const exportButton = document.getElementById('export-button') as HTMLButtonElement | null;
const exportStatusEl = document.getElementById('export-status');
const exportOptionsForm = document.getElementById('export-options') as HTMLFormElement | null;

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

function setExportStatus(message: string): void {
  if (exportStatusEl) {
    exportStatusEl.textContent = message;
  }
  console.log(message);
}

function readExportOptions() {
  const formData = exportOptionsForm
    ? new FormData(exportOptionsForm)
    : new FormData();

  return {
    quality: (formData.get('quality') as ExportQuality | null) ?? 'high',
    fps: Number(formData.get('fps') ?? 30),
    format: (formData.get('format') as ExportFormat | null) ?? 'mp4',
    resolution: {
      preset: (formData.get('resolution') as ExportResolutionPreset | null) ?? 'source',
    },
  };
}

function updateExportButtonState(): void {
  if (!exportButton) {
    return;
  }

  const hasVisual = editor.canvas
    .getElements()
    .some((element) => element.type !== 'audio');
  exportButton.disabled = !hasVisual;
  exportButton.title = hasVisual
    ? 'Render the composition with WebGPU and download an MP4'
    : 'Add at least one visual layer before exporting';
}

editor.canvas.on('element:added', updateExportButtonState);
editor.canvas.on('element:removed', updateExportButtonState);
updateExportButtonState();

exportButton?.addEventListener('click', async () => {
  if (!exportButton) {
    return;
  }

  const exportOptions = readExportOptions();
  exportButton.disabled = true;
  setExportStatus('Starting GPU export (WebCodecs + MediaBunny)…');

  try {
    const result = await editor.exportVideo({
      ...exportOptions,
      onProgress: (progress) => {
        setExportStatus(
          `[${progress.phase}] ${progress.percent.toFixed(1)}% — ${progress.message}`,
        );
      },
    });

    setExportStatus(
      `Export complete (${result.settings.width}×${result.settings.height} @ ${result.settings.fps}fps). Download started.`,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    setExportStatus(`Export failed: ${message}`);
    console.error(error);
  } finally {
    updateExportButtonState();
  }
});

window.addEventListener('beforeunload', () => {
  editor.destroy();
});
