import { describe, expect, it } from 'vitest';

import { formatMediaDuration } from '../../src/mediaLibrary/duration';

describe('formatMediaDuration', () => {
  it('formats seconds as m:ss', () => {
    expect(formatMediaDuration(0)).toBe('0:00');
    expect(formatMediaDuration(5)).toBe('0:05');
    expect(formatMediaDuration(65)).toBe('1:05');
    expect(formatMediaDuration(3723)).toBe('62:03');
  });
});
