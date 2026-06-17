import type { MediaLibraryItem } from '@opensource/sidebar';

export interface AddMediaFromFileOptions {
  /** When true, also inserts the uploaded media on the timeline at the playhead. */
  addToCanvas?: boolean;
  startTime?: number;
}

export interface MediaLibraryEventMap {
  'added': { item: MediaLibraryItem };
  'removed': { id: string };
  'changed': Record<string, never>;
  'selected': { item: MediaLibraryItem; startTime?: number };
  'upload:requested': { file: File } & AddMediaFromFileOptions;
  'remove:requested': { id: string };
}

export type MediaLibraryEventName = keyof MediaLibraryEventMap;

export type MediaLibraryEventHandler<T extends MediaLibraryEventName> = (
  payload: MediaLibraryEventMap[T],
) => void;
