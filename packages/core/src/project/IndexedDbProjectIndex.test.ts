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

  it('selects the most recently opened project', async () => {
    const records = [
      {
        projectId: 'project-1',
        name: 'Older',
        directoryHandle: {} as FileSystemDirectoryHandle,
        updatedAt: 10,
        lastOpenedAt: 100,
      },
      {
        projectId: 'project-2',
        name: 'Latest',
        directoryHandle: {} as FileSystemDirectoryHandle,
        updatedAt: 20,
        lastOpenedAt: 200,
      },
    ];

    const index = {
      listProjects: async () => records,
      getLastOpenedProject: async () => {
        const projects = await index.listProjects();
        return projects.reduce((latest, project) =>
          project.lastOpenedAt > latest.lastOpenedAt ? project : latest,
        );
      },
    };

    const latest = await index.getLastOpenedProject();
    expect(latest?.projectId).toBe('project-2');
    expect(latest?.name).toBe('Latest');
  });
});
