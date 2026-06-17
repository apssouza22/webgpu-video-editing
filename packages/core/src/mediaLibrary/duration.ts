export function formatMediaDuration(seconds: number): string {
  const total = Math.max(0, seconds);
  const minutes = Math.floor(total / 60);
  const secs = Math.floor(total % 60);
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

export function probeMediaDuration(
  src: string,
  kind: 'video' | 'audio',
): Promise<number | undefined> {
  if (typeof document === 'undefined') {
    return Promise.resolve(undefined);
  }

  return new Promise((resolve) => {
    const media = document.createElement(kind);
    media.preload = 'metadata';

    const finish = (duration: number | undefined): void => {
      media.removeAttribute('src');
      media.load();
      media.remove();
      resolve(duration);
    };

    media.onloadedmetadata = () => {
      finish(Number.isFinite(media.duration) ? media.duration : undefined);
    };
    media.onerror = () => finish(undefined);
    media.src = src;
  });
}
