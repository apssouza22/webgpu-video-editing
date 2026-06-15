export { Sidebar } from './common/Sidebar';
export { MediaLibrary, createStockMedia } from './common/mediaLibrary';
export type {
  AddMediaFromFileOptions,
  ExportFormat,
  ExportQuality,
  ExportResolution,
  ExportResolutionPreset,
  ExportSettings,
  MediaLibraryItem,
  MediaLibrarySource,
  MediaType,
  SidebarEventHandler,
  SidebarEventMap,
  SidebarEventName,
  SidebarOptions,
  SidebarPanelId,
  TranscriptionChunk,
  TranscriptionResult,
} from './common/types';
export { SidebarEventEmitter } from './event';
export { SidebarView, mountSidebar } from './ui/SidebarView';
