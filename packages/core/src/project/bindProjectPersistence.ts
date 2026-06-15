import type { VideoEditor } from '../VideoEditor';
import { ProjectSession } from './ProjectSession';
import { pickProjectDirectory } from './fileSystemAccess';
import type { BindProjectPersistenceOptions } from './types';

export function bindProjectPersistence({
  editor,
  clipCanvasSync,
  autoSave = true,
  debounceMs = 1000,
  onStatus,
  onError,
}: BindProjectPersistenceOptions): () => void {
  const session = new ProjectSession({ onStatus, onError, debounceMs });
  session.setSaveContext({
    timeline: editor.timeline,
    canvas: editor.canvas,
    sidebar: editor.sidebar,
    mediaLibrary: editor.mediaLibrary,
  });
  const disposables: Array<() => void> = [];

  const scheduleSave = (): void => {
    if (!autoSave || !session.isOpen()) {
      return;
    }
    session.scheduleSave();
  };

  disposables.push(
    editor.timeline.on('state:change', scheduleSave),
    editor.canvas.on('state:changed', scheduleSave),
  );

  if (editor.sidebar) {
    disposables.push(
      editor.sidebar.on('media:added', scheduleSave),
      editor.sidebar.on('media:removed', scheduleSave),
    );
  }

  const flush = (): void => {
    void session.flushSave(editor.timeline, editor.canvas, editor.sidebar, editor.mediaLibrary);
  };

  const beforeUnload = (): void => {
    flush();
  };
  window.addEventListener('beforeunload', beforeUnload);
  disposables.push(() => window.removeEventListener('beforeunload', beforeUnload));

  const persistenceApi = {
    session,
    async createProject(name: string, directoryHandle?: FileSystemDirectoryHandle) {
      const handle = directoryHandle ?? (await pickProjectDirectory());
      return session.createProject(name, handle, editor.timeline, editor.canvas);
    },
    async openProject(directoryHandle?: FileSystemDirectoryHandle) {
      const document = await session.openProject(directoryHandle);
      await session.hydrate(
        editor.timeline,
        editor.canvas,
        editor.sidebar,
        editor.mediaLibrary,
        clipCanvasSync,
      );
      return document;
    },
    importMedia() {
      return session.pickAndImportMedia(editor.mediaLibrary, editor.sidebar);
    },
    save() {
      return session.flushSave(
        editor.timeline,
        editor.canvas,
        editor.sidebar,
        editor.mediaLibrary,
      );
    },
  };

  editor.projectPersistence = persistenceApi;

  return () => {
    flush();
    for (const dispose of disposables) {
      dispose();
    }
    session.destroy();
    if ('projectPersistence' in editor) {
      delete (editor as VideoEditor & { projectPersistence?: unknown }).projectPersistence;
    }
  };
}

export type ProjectPersistenceApi = {
  session: ProjectSession;
  createProject: (name: string, directoryHandle?: FileSystemDirectoryHandle) => Promise<unknown>;
  openProject: (directoryHandle?: FileSystemDirectoryHandle) => Promise<unknown>;
  importMedia: () => Promise<void>;
  save: () => Promise<void>;
};
