export { bindProjectPersistence } from './bindProjectPersistence';
export { bindSidebarProject } from './bindSidebarProject';
export type { ProjectPersistenceApi } from './bindProjectPersistence';
export { FileSystemProjectStore } from './FileSystemProjectStore';
export { IndexedDbProjectIndex } from './IndexedDbProjectIndex';
export { MediaAssetService } from './MediaAssetService';
export { ProjectSession } from './ProjectSession';
export {
  captureProjectDocument,
  createEmptyProjectDocument,
  resolveProjectDocument,
} from './ProjectSerializer';
export {
  ensureDirectoryPermission,
  ensureFilePermission,
  mediaTypeFromMime,
  pickMediaFiles,
  pickProjectDirectory,
  sanitizeFileName,
} from './fileSystemAccess';
export type {
  BindProjectPersistenceOptions,
  ImportMediaResult,
  IndexedDbMediaAssetRecord,
  IndexedDbProjectRecord,
  PersistedMediaAsset,
  PersistedMediaLibraryEntry,
  ProjectDocument,
  ProjectMetadata,
  ProjectPersistenceOptions,
  ProjectPersistenceStatus,
  ResolvedMediaAsset,
} from './types';
export {
  IDB_DATABASE_NAME,
  IDB_MEDIA_ASSETS_STORE,
  IDB_PROJECTS_STORE,
  PROJECT_DOCUMENT_VERSION,
  PROJECT_JSON_FILENAME,
  PROJECT_MEDIA_DIR,
} from './types';
