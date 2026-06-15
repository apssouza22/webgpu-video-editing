import '@opensource/sidebar/style.css';
import '@opensource/video-canvas/style.css';

import { CompositionCanvas } from '@opensource/video-canvas';
import { bindSidebarMediaLibrary, MediaLibrary } from '@opensource/core';
import { Sidebar, mountSidebar } from '@opensource/sidebar';

const app = document.getElementById('app');
if (!app) {
  throw new Error('Missing #app');
}

app.className =
  'grid grid-cols-[320px_minmax(0,1fr)] h-screen overflow-hidden bg-es-bg text-es-text font-sans max-[960px]:grid-cols-1';

const sidebarEl = document.createElement('aside');
sidebarEl.className = 'min-h-0 border-r border-es-border overflow-hidden';

const main = document.createElement('main');
main.className = 'min-w-0 min-h-0';

app.append(sidebarEl, main);

const canvas = new CompositionCanvas(main);
const mediaLibrary = new MediaLibrary();
const sidebar = new Sidebar(canvas, { mediaLibrary });
const unmountMediaLibrary = bindSidebarMediaLibrary({ sidebar, canvas, mediaLibrary });
const unmountSidebar = mountSidebar(sidebarEl, sidebar);

window.addEventListener('beforeunload', () => {
  unmountSidebar();
  unmountMediaLibrary();
  sidebar.destroy();
  mediaLibrary.destroy();
  canvas.destroy();
});
