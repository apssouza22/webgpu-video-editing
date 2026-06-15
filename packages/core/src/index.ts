export { VideoEditor, type VideoEditorMount, type VideoEditorOptions } from './VideoEditor';

export { Timeline } from '@opensource/timeline';
export type { TimelineOptions, TimelineState } from '@opensource/timeline';
export { CompositionCanvas } from '@opensource/video-canvas';
export type { CompositionCanvasOptions } from '@opensource/video-canvas';
export {
  bindClipCanvasSync,
  ClipCanvasSync,
  canvasElementToAddClipInput,
  getTimelineClipZIndex,
  timelineClipToCompositionClip,
} from './clipCanvasSync';
export type { ClipCanvasSyncOptions } from './clipCanvasSync';
export {
  AnimationFrameLoop,
  type AnimationFrameLoopOptions,
  type FrameCallback,
  type FrameContext,
} from './animationFrameLoop';
export {
  bindEditorPlayback,
  EditorPlayback,
  type EditorPlaybackOptions,
} from './editorPlayback';
export {
  bindSidebarExport,
  canvasElementsToComposition,
  downloadBlob,
  exportVideoFromCanvas,
  rasterizeTextElement,
  DEFAULT_EXPORT_FORMAT,
  DEFAULT_EXPORT_FPS,
  DEFAULT_EXPORT_QUALITY,
  EXPORT_FPS_OPTIONS,
  EXPORT_QUALITY_BITRATES,
  resolveExportDimensions,
  resolveExportSettings,
  resolveOutputFilename,
  type BindSidebarExportOptions,
  type CanvasToCompositionOptions,
  type CanvasToCompositionResult,
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
  bindProjectPersistence,
  captureProjectDocument,
  createEmptyProjectDocument,
  FileSystemProjectStore,
  IndexedDbProjectIndex,
  MediaAssetService,
  pickMediaFiles,
  pickProjectDirectory,
  ProjectSession,
  resolveProjectDocument,
  PROJECT_DOCUMENT_VERSION,
  PROJECT_JSON_FILENAME,
  PROJECT_MEDIA_DIR,
  type BindProjectPersistenceOptions,
  type ImportMediaResult,
  type PersistedMediaAsset,
  type ProjectDocument,
  type ProjectMetadata,
  type ProjectPersistenceApi,
  type ProjectPersistenceOptions,
  type ProjectPersistenceStatus,
} from './project';
export {
  bindSidebarTranscription,
  configureTranscriptionEnv,
  TranscriptionService,
  TranscriptionEventEmitter,
  PipelineFactory,
  transcribe,
  audioBufferToFloat32Array,
  extractAudioFromMediaUrl,
  createMockTranscriptionResult,
  getExecDevice,
  type BindSidebarTranscriptionOptions,
  type TranscriptionChunk,
  type TranscriptionEventHandler,
  type TranscriptionEventMap,
  type TranscriptionEventName,
  type TranscriptionOptions,
  type TranscriptionProgress,
  type TranscriptionResult,
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
  ExportSettings,
  MediaLibraryItem,
  ResolvedMediaInput,
  SidebarPanelId,
} from '@opensource/sidebar';
