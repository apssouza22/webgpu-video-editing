import {
  PROJECT_JSON_FILENAME,
  PROJECT_MEDIA_DIR,
  type ProjectDocument,
} from './types';
import { ensureDirectoryPermission, sanitizeFileName } from './fileSystemAccess';

export class FileSystemProjectStore {
  constructor(private directoryHandle: FileSystemDirectoryHandle) {}

  getDirectoryHandle(): FileSystemDirectoryHandle {
    return this.directoryHandle;
  }

  async ensureAccess(): Promise<void> {
    const granted = await ensureDirectoryPermission(this.directoryHandle, 'readwrite');
    if (!granted) {
      throw new Error('Project directory permission was denied.');
    }
  }

  async readDocument(): Promise<ProjectDocument | null> {
    await this.ensureAccess();

    try {
      const fileHandle = await this.directoryHandle.getFileHandle(PROJECT_JSON_FILENAME);
      const file = await fileHandle.getFile();
      const text = await file.text();
      return JSON.parse(text) as ProjectDocument;
    } catch (error) {
      if (error instanceof DOMException && error.name === 'NotFoundError') {
        return null;
      }
      throw error;
    }
  }

  async writeDocument(document: ProjectDocument): Promise<void> {
    await this.ensureAccess();
    await this.ensureMediaDirectory();

    const fileHandle = await this.directoryHandle.getFileHandle(PROJECT_JSON_FILENAME, {
      create: true,
    });
    const writable = await fileHandle.createWritable();
    await writable.write(JSON.stringify(document, null, 2));
    await writable.close();
  }

  async ensureMediaDirectory(): Promise<FileSystemDirectoryHandle> {
    return this.directoryHandle.getDirectoryHandle(PROJECT_MEDIA_DIR, { create: true });
  }

  buildMediaRelativePath(assetId: string, fileName: string): string {
    return `${PROJECT_MEDIA_DIR}/${assetId}-${sanitizeFileName(fileName)}`;
  }

  async getMediaFileHandle(relativePath: string): Promise<FileSystemFileHandle> {
    const segments = relativePath.split('/').filter(Boolean);
    if (segments.length < 2 || segments[0] !== PROJECT_MEDIA_DIR) {
      throw new Error(`Invalid media relative path: ${relativePath}`);
    }

    const mediaDir = await this.ensureMediaDirectory();
    return mediaDir.getFileHandle(segments.slice(1).join('/'));
  }

  async writeMediaFile(relativePath: string, file: File | Blob): Promise<void> {
    await this.ensureAccess();
    const segments = relativePath.split('/').filter(Boolean);
    const fileName = segments.at(-1);
    if (!fileName) {
      throw new Error(`Invalid media relative path: ${relativePath}`);
    }

    const mediaDir = await this.ensureMediaDirectory();
    const fileHandle = await mediaDir.getFileHandle(fileName, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(file);
    await writable.close();
  }
}
