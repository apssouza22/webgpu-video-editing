import type { Clip, TimelineState } from '@opensource/timeline';
import type { CanvasElement, CanvasState } from '@opensource/video-canvas';
import type { MediaLibraryItem } from '@opensource/sidebar';

import type { MediaAssetService } from './MediaAssetService';
import {
  PROJECT_DOCUMENT_VERSION,
  type PersistedCanvasElement,
  type PersistedMediaAsset,
  type PersistedMediaLibraryEntry,
  type ProjectDocument,
  type ProjectMetadata,
} from './types';

type PersistedTimelineState = Omit<TimelineState, 'isPlaying'>;

function toPersistedTimeline(timeline: TimelineState, clips: Clip[]): PersistedTimelineState {
  const { isPlaying: _isPlaying, ...rest } = timeline;
  return {
    ...rest,
    clips,
  };
}

export interface CaptureEditorStateInput {
  meta: ProjectMetadata;
  timeline: TimelineState;
  canvas: CanvasState;
  mediaLibrary: MediaLibraryItem[];
  mediaAssets: MediaAssetService;
  transcription?: ProjectDocument['transcription'];
}

export interface ResolvedEditorState {
  timeline: TimelineState;
  canvas: CanvasState;
  mediaLibrary: MediaLibraryItem[];
}

function isProjectMediaUrl(url: string | undefined, mediaAssets: MediaAssetService): boolean {
  if (!url) {
    return false;
  }
  return url.startsWith('blob:') || Boolean(mediaAssets.findAssetIdByUrl(url));
}

function resolveAssetId(url: string | undefined, mediaAssets: MediaAssetService): string | undefined {
  if (!url) {
    return undefined;
  }
  return mediaAssets.findAssetIdByUrl(url);
}

function resolveUrl(
  assetId: string | undefined,
  fallbackUrl: string | undefined,
  mediaAssets: MediaAssetService,
): string | undefined {
  if (assetId) {
    return mediaAssets.resolveUrl(assetId) ?? fallbackUrl;
  }
  return fallbackUrl;
}

export function captureProjectDocument(input: CaptureEditorStateInput): ProjectDocument {
  const { meta, timeline, canvas, mediaLibrary, mediaAssets } = input;
  const mediaMap = new Map<string, PersistedMediaAsset>();

  for (const asset of mediaAssets.listAssets()) {
    mediaMap.set(asset.id, asset);
  }

  const clips = timeline.clips.map((clip) => serializeClip(clip, mediaAssets));
  const elements = canvas.elements.map((element) => serializeCanvasElement(element, mediaAssets));
  const libraryEntries = mediaLibrary
    .filter((item) => item.source !== 'stock' && item.assetId)
    .map((item) => serializeMediaLibraryEntry(item, mediaAssets));

  return {
    version: PROJECT_DOCUMENT_VERSION,
    meta: {
      ...meta,
      updatedAt: Date.now(),
    },
    media: [...mediaMap.values()],
    timeline: toPersistedTimeline(timeline, clips),
    canvas: {
      aspectRatio: canvas.aspectRatio,
      playerSize: canvas.playerSize,
      elements,
      selectedId: canvas.selectedId,
    },
    mediaLibrary: libraryEntries,
    transcription: input.transcription,
  };
}

export function resolveProjectDocument(
  document: ProjectDocument,
  mediaAssets: MediaAssetService,
): ResolvedEditorState {
  const timeline: TimelineState = {
    ...document.timeline,
    isPlaying: false,
    clips: document.timeline.clips.map((clip) => deserializeClip(clip, mediaAssets)),
  };

  const canvas: CanvasState = {
    aspectRatio: document.canvas.aspectRatio,
    playerSize: document.canvas.playerSize,
    selectedId: document.canvas.selectedId,
    elements: document.canvas.elements.map((element) =>
      deserializeCanvasElement(element, mediaAssets),
    ),
  };

  const mediaLibrary = document.mediaLibrary
    .map((entry) => mediaAssets.toMediaLibraryItem(entry))
    .filter((item): item is MediaLibraryItem => item !== null);

  return {
    timeline,
    canvas,
    mediaLibrary,
  };
}

function serializeClip(clip: Clip, mediaAssets: MediaAssetService): Clip {
  const assetId = resolveAssetId(clip.url, mediaAssets);
  const thumbnailAssetId = resolveAssetId(clip.thumbnailUrl, mediaAssets);

  if (!assetId && !isProjectMediaUrl(clip.url, mediaAssets)) {
    return { ...clip };
  }

  return {
    ...clip,
    url: assetId ? undefined : clip.url,
    thumbnailUrl: thumbnailAssetId ? undefined : clip.thumbnailUrl,
    ...(assetId ? { assetId } : {}),
    ...(thumbnailAssetId ? { thumbnailAssetId } : {}),
  } as Clip & { assetId?: string; thumbnailAssetId?: string };
}

function deserializeClip(
  clip: Clip & { assetId?: string; thumbnailAssetId?: string },
  mediaAssets: MediaAssetService,
): Clip {
  const url = resolveUrl(clip.assetId, clip.url, mediaAssets);
  const thumbnailUrl = resolveUrl(clip.thumbnailAssetId, clip.thumbnailUrl, mediaAssets);
  const { assetId: _assetId, thumbnailAssetId: _thumbnailAssetId, ...rest } = clip;
  return {
    ...rest,
    url,
    thumbnailUrl,
  };
}

function serializeCanvasElement(
  element: CanvasElement,
  mediaAssets: MediaAssetService,
): PersistedCanvasElement {
  if (element.type === 'text') {
    return element;
  }

  const assetId = resolveAssetId(element.src, mediaAssets);
  if (!assetId && !isProjectMediaUrl(element.src, mediaAssets)) {
    return element;
  }

  const { src: _src, ...rest } = element;
  return {
    ...rest,
    ...(assetId ? { assetId } : { src: element.src }),
  } as PersistedCanvasElement;
}

function deserializeCanvasElement(
  element: PersistedCanvasElement,
  mediaAssets: MediaAssetService,
): CanvasElement {
  if (element.type === 'text') {
    return element;
  }

  const assetId = 'assetId' in element ? element.assetId : undefined;
  const src = resolveUrl(assetId, element.src, mediaAssets) ?? '';
  const { assetId: _assetId, ...rest } = element as PersistedCanvasElement & { assetId?: string };
  return {
    ...rest,
    src,
  } as CanvasElement;
}

function serializeMediaLibraryEntry(
  item: MediaLibraryItem,
  mediaAssets: MediaAssetService,
): PersistedMediaLibraryEntry {
  if (!item.assetId) {
    throw new Error(`Media library item "${item.id}" is missing assetId.`);
  }

  const thumbnailAssetId = item.thumbnail
    ? mediaAssets.findAssetIdByUrl(item.thumbnail)
    : undefined;

  return {
    id: item.id,
    assetId: item.assetId,
    type: item.type,
    name: item.name,
    source: 'library',
    createdAt: item.createdAt,
    thumbnailAssetId,
  };
}

export function createEmptyProjectDocument(name: string, timeline: TimelineState, canvas: CanvasState): ProjectDocument {
  const now = Date.now();

  return {
    version: PROJECT_DOCUMENT_VERSION,
    meta: {
      id: `project-${crypto.randomUUID()}`,
      name,
      createdAt: now,
      updatedAt: now,
    },
    media: [],
    timeline: toPersistedTimeline(timeline, []),
    canvas: {
      aspectRatio: canvas.aspectRatio,
      playerSize: canvas.playerSize,
      elements: [],
      selectedId: null,
    },
    mediaLibrary: [],
  };
}
