import type { Sidebar } from '@opensource/sidebar';

import type { ExportVideoOptions } from './exportOptions';
import type { ExportVideoResult } from './exportVideo';

export interface BindSidebarExportOptions {
  sidebar: Sidebar;
  exportVideo: (options: ExportVideoOptions) => Promise<ExportVideoResult>;
}

/**
 * Wires sidebar export events to the core export pipeline.
 */
export function bindSidebarExport({
  sidebar,
  exportVideo,
}: BindSidebarExportOptions): () => void {
  return sidebar.on('export:requested', async ({ settings }) => {
    sidebar.setExportStatus('Starting GPU export (WebCodecs + MediaBunny)…', true);

    try {
      const result = await exportVideo({
        ...settings,
        onProgress: (progress) => {
          sidebar.setExportStatus(
            `[${progress.phase}] ${progress.percent.toFixed(1)}% — ${progress.message}`,
            true,
          );
        },
      });

      const speedLabel =
        result.settings.playbackRate === 1 ? '' : ` @ ${result.settings.playbackRate}x`;
      sidebar.setExportStatus(
        `Export complete (${result.settings.width}×${result.settings.height} @ ${result.settings.fps}fps${speedLabel}). Download started.`,
        false,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      sidebar.setExportStatus(`Export failed: ${message}`, false);
      console.error(error);
    }
  });
}
