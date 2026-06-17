export type MediaType = 'video' | 'image' | 'audio';

export type MediaLibrarySource = 'upload' | 'library';

export interface MediaLibraryItem {
  id: string;
  type: MediaType;
  name: string;
  src: string;
  thumbnail?: string;
  /** Duration in seconds for video and audio items. */
  duration?: number;
  createdAt: number;
  source: MediaLibrarySource;
  /** Stable reference to a persisted project media asset. */
  assetId?: string;
}

export interface ResolvedMediaInput {
  assetId: string;
  type: MediaType;
  name: string;
  src: string;
  thumbnail?: string;
  duration?: number;
  id?: string;
}

export interface AddMediaFromFileOptions {
  /** When true, also inserts the uploaded media on the timeline at the playhead. */
  addToCanvas?: boolean;
  startTime?: number;
}

export interface MediaLibraryEventMap {
  'added': { item: MediaLibraryItem };
  'removed': { id: string };
  'changed': Record<string, never>;
  'upload:requested': { file: File } & AddMediaFromFileOptions;
  'selected': { item: MediaLibraryItem; startTime?: number };
}

export type MediaLibraryEventName = keyof MediaLibraryEventMap;

export type MediaLibraryEventHandler<T extends MediaLibraryEventName> = (
  payload: MediaLibraryEventMap[T],
) => void;
