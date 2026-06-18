import { describe, expect, it, vi } from 'vitest';

import { MediaLibraryService } from '../../src/mediaLibrary/MediaLibraryService';

describe('MediaLibraryService', () => {
  it('starts empty', () => {
    const library = new MediaLibraryService();
    expect(library.list()).toHaveLength(0);
  });

  it('adds uploaded files and revokes blob URLs on remove', () => {
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', {
      createObjectURL: () => 'blob:upload-1',
      revokeObjectURL,
    });

    const library = new MediaLibraryService();
    const file = new File(['video'], 'clip.mp4', { type: 'video/mp4' });
    const item = library.addFromFile(file);

    expect(item.src).toBe('blob:upload-1');
    expect(library.list('video')).toHaveLength(1);

    library.remove(item.id);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:upload-1');
    expect(library.list()).toHaveLength(0);

    vi.unstubAllGlobals();
  });
});
