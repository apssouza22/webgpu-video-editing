export async function pickProjectDirectory(): Promise<FileSystemDirectoryHandle> {
  if (!window.showDirectoryPicker) {
    throw new Error('File System Access API is not available in this browser.');
  }

  return window.showDirectoryPicker({ mode: 'readwrite' });
}

export async function pickMediaFiles(
  accept?: Record<string, string[]>,
): Promise<FileSystemFileHandle[]> {
  if (!window.showOpenFilePicker) {
    throw new Error('File System Access API is not available in this browser.');
  }

  return window.showOpenFilePicker({
    multiple: true,
    types: accept
      ? [
          {
            description: 'Media files',
            accept,
          },
        ]
      : undefined,
  });
}

export async function ensureDirectoryPermission(
  handle: FileSystemDirectoryHandle,
  mode: FileSystemPermissionMode = 'readwrite',
): Promise<boolean> {
  const options = { mode };
  if ((await handle.queryPermission(options)) === 'granted') {
    return true;
  }

  return (await handle.requestPermission(options)) === 'granted';
}

export async function ensureFilePermission(
  handle: FileSystemFileHandle,
  mode: FileSystemPermissionMode = 'read',
): Promise<boolean> {
  const options = { mode };
  if ((await handle.queryPermission(options)) === 'granted') {
    return true;
  }

  return (await handle.requestPermission(options)) === 'granted';
}

export function sanitizeFileName(name: string): string {
  const trimmed = name.trim() || 'file';
  return trimmed.replace(/[^a-zA-Z0-9._-]/g, '_');
}

export function mediaTypeFromMime(mimeType: string): 'video' | 'image' | 'audio' {
  if (mimeType.startsWith('video/')) {
    return 'video';
  }
  if (mimeType.startsWith('audio/')) {
    return 'audio';
  }
  return 'image';
}
