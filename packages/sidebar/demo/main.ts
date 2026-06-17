import '@opensource/sidebar/style.css';
import '@opensource/video-preview/style.css';

import { CompositionPreview } from '@opensource/video-preview';
import { Timeline } from '@opensource/timeline';
import { bindMediaLibraryTimeline, MediaLibraryPanel, MediaLibraryService } from '@opensource/core';
import { Sidebar, mountSidebar } from '@opensource/sidebar';

const app = document.getElementById('app');
if (!app) {
  throw new Error('Missing #app');
}

app.className =
  'grid grid-cols-[320px_minmax(0,1fr)_280px] h-screen overflow-hidden bg-es-bg text-es-text font-sans max-[960px]:grid-cols-1';

const sidebarEl = document.createElement('aside');
sidebarEl.className = 'min-h-0 border-r border-es-border overflow-hidden';

const main = document.createElement('main');
main.className = 'min-w-0 min-h-0';

const timelineEl = document.createElement('div');
timelineEl.className = 'min-h-0 border-t border-es-border';

app.append(sidebarEl, main, timelineEl);

const preview = new CompositionPreview(main);
const timeline = new Timeline(timelineEl);
const mediaLibrary = new MediaLibraryService();
const sidebar = new Sidebar(preview, {
  panelFactories: {
    media: () => new MediaLibraryPanel(mediaLibrary).element,
  },
});
const { dispose: unmountMediaLibrary } = bindMediaLibraryTimeline({ timeline, preview, mediaLibrary });
const unmountSidebar = mountSidebar(sidebarEl, sidebar);

window.addEventListener('beforeunload', () => {
  unmountSidebar();
  unmountMediaLibrary();
  sidebar.destroy();
  mediaLibrary.destroy();
  timeline.destroy();
  preview.destroy();
});
