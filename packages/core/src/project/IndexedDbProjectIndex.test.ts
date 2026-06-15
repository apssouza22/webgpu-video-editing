import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  IDB_DATABASE_NAME,
  IDB_MEDIA_ASSETS_STORE,
  IDB_PROJECTS_STORE,
} from './types';

describe('IndexedDbProjectIndex metadata contract', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('uses dedicated stores for project metadata only', () => {
    expect(IDB_DATABASE_NAME).toBe('gpu-video-editor');
    expect(IDB_PROJECTS_STORE).toBe('projects');
    expect(IDB_MEDIA_ASSETS_STORE).toBe('mediaAssets');
  });

  it('does not persist binary payloads in project records', () => {
    const record = {
      projectId: 'project-1',
      name: 'Demo',
      directoryHandle: {} as FileSystemDirectoryHandle,
      updatedAt: 10,
      lastOpenedAt: 20,
    };

    const serialized = JSON.stringify(record);
    expect(serialized).not.toContain('blob:');
    expect(serialized).not.toContain('data:');
    expect(serialized).not.toContain('ArrayBuffer');
  });
});
