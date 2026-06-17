import type { MediaLibraryItem } from '@opensource/sidebar';

export interface AddMediaFromFileOptions {
  /** When true, also inserts the uploaded media on the timeline at the playhead. */
  addToCanvas?: boolean;
  startTime?: number;
}

/** Wired by {@link bindMediaLibrary}; not part of the public event surface. */
export interface MediaLibraryHandlers {
  onUpload?: (file: File, options: AddMediaFromFileOptions) => void | Promise<void>;
  onSelect?: (item: MediaLibraryItem, startTime?: number) => void;
}

export interface MediaLibraryEventMap {
  'added': { item: MediaLibraryItem };
  'removed': { id: string };
  'changed': Record<string, never>;
}

export type MediaLibraryEventName = keyof MediaLibraryEventMap;

export type MediaLibraryEventHandler<T extends MediaLibraryEventName> = (
  payload: MediaLibraryEventMap[T],
) => void;
