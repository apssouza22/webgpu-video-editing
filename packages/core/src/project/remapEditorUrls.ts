import type { TimelineState } from '@opensource/timeline';
import type { CanvasState } from '@opensource/video-canvas';

export function remapTimelineStateUrls(
  state: TimelineState,
  urlMap: Map<string, string>,
): TimelineState {
  if (urlMap.size === 0) {
    return state;
  }

  return {
    ...state,
    clips: state.clips.map((clip) => ({
      ...clip,
      url: clip.url && urlMap.has(clip.url) ? urlMap.get(clip.url) : clip.url,
      thumbnailUrl:
        clip.thumbnailUrl && urlMap.has(clip.thumbnailUrl)
          ? urlMap.get(clip.thumbnailUrl)
          : clip.thumbnailUrl,
    })),
  };
}

export function remapCanvasStateUrls(
  state: CanvasState,
  urlMap: Map<string, string>,
): CanvasState {
  if (urlMap.size === 0) {
    return state;
  }

  return {
    ...state,
    elements: state.elements.map((element) => {
      if (element.type === 'text') {
        return element;
      }

      const src = urlMap.has(element.src) ? urlMap.get(element.src)! : element.src;
      return { ...element, src };
    }),
  };
}
