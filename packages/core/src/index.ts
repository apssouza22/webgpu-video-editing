export { VideoEditor, type VideoEditorMount, type VideoEditorOptions } from './VideoEditor';

export { Timeline } from '@opensource/timeline';
export type { TimelineOptions, TimelineState } from '@opensource/timeline';
export { CompositionPreview } from '@opensource/video-preview';
export type { CompositionPreviewOptions } from '@opensource/video-preview';
export {
  bindClipPreviewSync,
  bindExport,
  bindMediaLibraryTimeline,
  bindTranscriptionTimelineCut,
  ClipPreviewSyncService,
  CompositionPreviewSubscriber,
  TimelineSubscriber,
  ExportSubscriber,
  MediaLibrarySubscriber,
  MediaLibrarySubscriber as MediaLibraryTimelineSubscriber,
  fromPreviewElementToTimelineClip,
  getTimelineClipZIndex,
  timelineClipToCanvasElement,
} from './subscribers';
export type {
  BindTranscriptionTimelineCutOptions,
  ClipPreviewSyncOptions,
  CompositionPreviewSubscriberOptions,
  ExportSubscriberOptions,
  MediaLibraryTimelineSubscriberOptions,
  TimelineSubscriberOptions,
} from './subscribers';
export {
  AnimationFrameLoop,
  bindEditorPlayback,
  EditorPlayback,
  type AnimationFrameLoopOptions,
  type EditorPlaybackOptions,
  type FrameCallback,
  type FrameContext,
} from './loop';
export {
  ExportService,
  ExportPanel,
  mountExportPanel,
  ExportEventEmitter,
  previewElementsToComposition,
  downloadBlob,
  exportVideoFromPreview,
  rasterizeTextElement,
  DEFAULT_EXPORT_FORMAT,
  DEFAULT_EXPORT_FPS,
  DEFAULT_EXPORT_QUALITY,
  EXPORT_FPS_OPTIONS,
  EXPORT_QUALITY_BITRATES,
  resolveExportDimensions,
  resolveExportSettings,
  resolveOutputFilename,
  type ExportEventHandler,
  type ExportEventMap,
  type ExportEventName,
  type ExportSettings,
  type PreviewToCompositionOptions,
  type PreviewToCompositionResult,
  type ExportFormat,
  type ExportQuality,
  type ExportResolution,
  type ExportResolutionPreset,
  type ExportVideoOptions,
  type ExportVideoResult,
  type ResolvedExportSettings,
} from './export';
export type { ExportProgress } from '@opensource/gpu-video-encode';
export {
  MediaLibraryService,
  MediaLibraryPanel,
  mountMediaLibraryPanel,
  type AddMediaFromFileOptions,
  type MediaLibraryEventHandler,
  type MediaLibraryEventMap,
  type MediaLibraryEventName,
  type MediaLibraryItem,
  type MediaLibrarySource,
  type MediaType,
  type ResolvedMediaInput,
} from './mediaLibrary';
export {
  bindTranscription,
  createTranscriptionService,
  TranscriptionView,
  configureTranscriptionEnv,
  TranscriptionService,
  TranscriptionEventEmitter,
  PipelineFactory,
  transcribe,
  extractAudioFromMediaUrl,
  createMockTranscriptionResult,
  type BindTranscriptionOptions,
  type TranscriptionChunk,
  type TranscriptionEventHandler,
  type TranscriptionEventMap,
  type TranscriptionEventName,
  type TranscriptionOptions,
  type TranscriptionProgress,
  type TranscriptionResult,
  type TranscriptionWordRemovedPayload,
} from './transcription';
export {
  Sidebar,
  mountSidebar,
  SidebarEventEmitter,
  SidebarView,
} from '@opensource/sidebar';
export type {
  SidebarOptions,
  SidebarEventMap,
  SidebarEventName,
  SidebarEventHandler,
  SidebarPanelId,
} from '@opensource/sidebar';
