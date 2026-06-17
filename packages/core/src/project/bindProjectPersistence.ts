import type { VideoEditor } from '../VideoEditor';
import { ProjectSession } from './ProjectSession';
import { bindSidebarProject } from './bindSidebarProject';
import { pickProjectDirectory } from './fileSystemAccess';
import type { BindProjectPersistenceOptions, ProjectPersistenceStatus } from './types';

function isBusyPhase(phase: ProjectPersistenceStatus['phase']): boolean {
  return phase === 'loading' || phase === 'saving' || phase === 'importing';
}

export function bindProjectPersistence({
  editor,
  clipPreviewSync,
  autoSave = true,
  autoRestore = true,
  debounceMs = 1000,
  onStatus,
  onError,
  onReady,
}: BindProjectPersistenceOptions): () => void {
  const session = new ProjectSession({
    onStatus: (status) => {
      onStatus?.(status);
      editor.sidebar?.setProjectStatus(status.message ?? '', {
        busy: isBusyPhase(status.phase),
        projectName: status.projectName,
        isOpen: session.isOpen(),
      });
    },
    onError,
    debounceMs,
  });
  session.setSaveContext({
    timeline: editor.timeline,
    preview: editor.preview,
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
    editor.preview.on('state:changed', scheduleSave),
    editor.mediaLibrary.on('added', scheduleSave),
    editor.mediaLibrary.on('removed', scheduleSave),
    editor.mediaLibrary.on('changed', scheduleSave),
  );

  const flush = (): void => {
    void session.flushSave(editor.timeline, editor.preview, editor.sidebar, editor.mediaLibrary);
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
      return session.createProject(
        name,
        handle,
        editor.timeline,
        editor.preview,
        editor.mediaLibrary,
        editor.sidebar,
        clipPreviewSync,
      );
    },
    async openProject(directoryHandle?: FileSystemDirectoryHandle) {
      const document = await session.openProject(directoryHandle);
      await session.hydrate(
        editor.timeline,
        editor.preview,
        editor.sidebar,
        editor.mediaLibrary,
        clipPreviewSync,
      );
      return document;
    },
    async restoreLastProject() {
      return session.restoreLastProject(
        editor.timeline,
        editor.preview,
        editor.sidebar,
        editor.mediaLibrary,
        clipPreviewSync,
      );
    },
    importUploadedFile(file: File) {
      return session.importUploadedFile(file, editor.mediaLibrary, editor.sidebar);
    },
    importMedia() {
      return session.pickAndImportMedia(editor.mediaLibrary, editor.sidebar);
    },
    save() {
      return session.flushSave(
        editor.timeline,
        editor.preview,
        editor.sidebar,
        editor.mediaLibrary,
      );
    },
  };

  editor.projectPersistence = persistenceApi;

  if (autoRestore) {
    void persistenceApi.restoreLastProject().then((document) => {
      onReady?.(document !== null);
    }).catch((error) => {
      editor.sidebar?.setProjectStatus('Failed to restore project.', { busy: false });
      onReady?.(false);
      onError?.(error instanceof Error ? error : new Error(String(error)));
    });
  } else {
    onReady?.(false);
  }

  if (editor.sidebar) {
    disposables.push(
      bindSidebarProject({
        sidebar: editor.sidebar,
        persistence: persistenceApi,
      }),
    );
  }

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
  restoreLastProject: () => Promise<unknown>;
  importUploadedFile: (file: File) => Promise<import('@opensource/sidebar').MediaLibraryItem>;
  importMedia: () => Promise<void>;
  save: () => Promise<void>;
};
