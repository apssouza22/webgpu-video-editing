import { describe, expect, it, vi } from 'vitest';

import { MediaLibrary } from './MediaLibrary';

describe('MediaLibrary', () => {
  it('lists stock media by default', () => {
    const library = new MediaLibrary();
    expect(library.list()).toHaveLength(2);
    expect(library.list('video')).toHaveLength(1);
  });

  it('adds uploaded files and revokes blob URLs on remove', () => {
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', {
      createObjectURL: () => 'blob:upload-1',
      revokeObjectURL,
    });

    const library = new MediaLibrary([]);
    const file = new File(['video'], 'clip.mp4', { type: 'video/mp4' });
    const item = library.addFromFile(file);

    expect(item.source).toBe('upload');
    expect(item.src).toBe('blob:upload-1');
    expect(library.list('video')).toHaveLength(1);

    library.remove(item.id);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:upload-1');
    expect(library.get(item.id)).toBeUndefined();

    vi.unstubAllGlobals();
  });

  it('returns only persisted library items', () => {
    const library = new MediaLibrary([
      {
        id: 'stock-1',
        type: 'video',
        name: 'Stock',
        src: '/stock.mp4',
        createdAt: 1,
        source: 'stock',
      },
    ]);

    library.addFromResolvedMedia({
      assetId: 'asset-1',
      type: 'image',
      name: 'Imported',
      src: 'blob:asset-1',
    });

    library.addFromFile(new File(['x'], 'upload.png', { type: 'image/png' }));

    expect(library.getPersistedItems()).toEqual([
      expect.objectContaining({
        assetId: 'asset-1',
        source: 'library',
        name: 'Imported',
      }),
    ]);
  });

  it('replaces persisted items when loading a project', () => {
    const library = new MediaLibrary([]);
    library.addFromFile(new File(['x'], 'old.png', { type: 'image/png' }));

    library.loadPersistedItems([
      {
        id: 'lib-1',
        assetId: 'asset-1',
        type: 'audio',
        name: 'Restored',
        src: 'blob:restored',
        createdAt: 10,
        source: 'library',
      },
    ]);

    expect(library.list()).toHaveLength(1);
    expect(library.get('lib-1')?.name).toBe('Restored');
  });
});
