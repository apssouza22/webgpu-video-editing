# Project Session — Re-implementation Spec

**Source:** `packages/core/src/project/` in `@opensource/core`  
**Purpose:** Persist and restore a video editor workspace (timeline, canvas, media library, media files) to a local folder on disk, with IndexedDB used only for project discovery and handle retention.

This document is sufficient to re-implement the project session stack in a new codebase without reading the original source.

---

## 1. Problem statement

The editor runs entirely in the browser. Users need to:

1. **Create** a project in a folder they choose on disk.
2. **Open** an existing project folder.
3. **Auto-restore** the last opened project on reload (when permission is still granted).
4. **Import media** into the project folder and reference it by stable asset IDs (not ephemeral blob URLs).
5. **Auto-save** editor state (timeline, canvas, library metadata) with debouncing.
6. **Hydrate** runtime state from disk on open/restore without breaking timeline ↔ canvas sync.

The orchestrator for all of this is **`ProjectSession`**. It is typically wired into the app via **`bindProjectPersistence`** and optionally **`bindSidebarProject`**.

---

## 2. Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         Application (VideoEditor)                      │
│  Timeline │ CompositionPreview │ MediaLibraryService │ Sidebar (opt.)   │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │
                    bindProjectPersistence()
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                           ProjectSession                                 │
│  create / open / restore / hydrate / import / scheduleSave / flushSave  │
└───────┬─────────────────┬──────────────────────┬──────────────────────┘
        │                 │                      │
        ▼                 ▼                      ▼
 FileSystemProjectStore  MediaAssetService   IndexedDbProjectIndex
        │                 │                      │
        ▼                 ▼                      ▼
  project.json         media/ files         IndexedDB handles
  (on disk)            (on disk)            + asset index
```

### Supporting modules

| Module | Responsibility |
|--------|----------------|
| `ProjectSession` | Lifecycle orchestration, debounced save, status reporting |
| `FileSystemProjectStore` | Read/write `project.json` and files under `media/` |
| `MediaAssetService` | Import media to disk, create blob URLs, asset ID ↔ URL maps |
| `IndexedDbProjectIndex` | Remember project folders (`FileSystemDirectoryHandle`) and media asset metadata |
| `ProjectSerializer` | Capture editor state → `ProjectDocument`; resolve document → runtime state |
| `remapEditorUrls` | Rewrite blob/external URLs after media is copied into the project |
| `fileSystemAccess` | Browser picker helpers, permission checks, filename sanitization |
| `bindProjectPersistence` | Auto-save subscriptions, `beforeunload` flush, `ProjectPersistenceApi` |
| `bindSidebarProject` | Wire sidebar create/open UI events to persistence API |

---

## 3. Platform requirements

### Browser APIs (required)

- [File System Access API](https://developer.mozilla.org/en-US/docs/Web/API/File_System_Access_API)
  - `window.showDirectoryPicker({ mode: 'readwrite' })`
  - `window.showOpenFilePicker({ multiple: true, types })`
  - `FileSystemDirectoryHandle` / `FileSystemFileHandle`
  - `queryPermission` / `requestPermission`
  - `getFileHandle`, `getDirectoryHandle`, `createWritable`
- `indexedDB` — store serializable handles and asset metadata
- `URL.createObjectURL` / `URL.revokeObjectURL`
- `crypto.randomUUID()`
- `fetch` — used when copying in-memory blob URLs into the project on create

### Feature detection

Project management UI should be gated on `'showDirectoryPicker' in window`. When unavailable, `bindSidebarProject` calls `sidebar.setProjectAvailability(false)`.

### Security / permissions

- Directory handles require **readwrite** permission for create/save/import.
- On restore, if permission is denied, return `null` and emit status `idle` with a message — do not throw.
- `openProject` throws if `project.json` is missing.

---

## 4. On-disk layout

```
<user-selected-project-folder>/
├── project.json          # canonical serialized editor state
└── media/
    ├── asset-<uuid>-<sanitized-filename>.mp4
    ├── asset-<uuid>-<sanitized-filename>.png
    └── ...
```

### Constants

```ts
PROJECT_DOCUMENT_VERSION = 1
PROJECT_JSON_FILENAME = 'project.json'
PROJECT_MEDIA_DIR = 'media'
```

### Media file naming

Relative path: `media/{assetId}-{sanitizedFileName}`

`sanitizeFileName(name)`:
- Trim; default to `'file'` if empty
- Replace any character not in `[a-zA-Z0-9._-]` with `_`

---

## 5. IndexedDB schema

```ts
IDB_DATABASE_NAME = 'gpu-video-editor'
DB_VERSION = 1
```

### Store: `projects` (keyPath: `projectId`)

```ts
interface IndexedDbProjectRecord {
  projectId: string
  name: string
  directoryHandle: FileSystemDirectoryHandle  // persisted by browser
  updatedAt: number
  lastOpenedAt: number
}
```

### Store: `mediaAssets` (keyPath: `assetId`, index: `projectId`)

```ts
interface IndexedDbMediaAssetRecord {
  assetId: string
  projectId: string
  relativePath: string
  name: string
  mimeType: string
  size: number
  lastModified: number
}
```

### Index operations

| Method | Behavior |
|--------|----------|
| `upsertProject(record)` | `put` by `projectId` |
| `getProject(projectId)` | `get` by key |
| `listProjects()` | `getAll` |
| `getLastOpenedProject()` | `listProjects()` then max by `lastOpenedAt` |
| `upsertMediaAsset(record)` | `put` by `assetId` |
| `listMediaAssets(projectId)` | index `projectId` → `getAll` |
| `deleteMediaAssetsForProject(projectId)` | list then delete each (not used by session today, but exists) |

---

## 6. Data model: `ProjectDocument`

Versioned JSON written to `project.json`.

```ts
interface ProjectMetadata {
  id: string           // `project-${crypto.randomUUID()}`
  name: string
  createdAt: number    // epoch ms
  updatedAt: number    // epoch ms; bumped on every capture
}

interface PersistedMediaAsset {
  id: string           // `asset-${crypto.randomUUID()}`
  relativePath: string
  name: string
  mimeType: string
  size: number
  lastModified: number
}

interface PersistedMediaLibraryEntry {
  id: string
  assetId: string
  type: 'video' | 'image' | 'audio'
  name: string
  source: 'library'   // always 'library' when persisted
  createdAt: number
  thumbnailAssetId?: string
}

interface ProjectDocument {
  version: 1
  meta: ProjectMetadata
  media: PersistedMediaAsset[]
  timeline: Omit<TimelineState, 'isPlaying'>
  canvas: {
    aspectRatio: AspectRatioId
    playerSize: CanvasSize
    elements: PersistedCanvasElement[]
    selectedId: string | null
  }
  mediaLibrary: PersistedMediaLibraryEntry[]
  transcription?: TranscriptionResult[]  // preserved across saves, not mutated by session
}
```

### Persisted canvas elements

Media elements (`video`, `image`, `audio`) are stored with **`assetId`** instead of runtime `src` when the URL belongs to the project. Text elements are stored as-is.

```ts
type PersistedCanvasElement =
  | (Omit<VideoElement, 'src'> & { src?: string; assetId?: string })
  | (Omit<ImageElement, 'src'> & { src?: string; assetId?: string })
  | (Omit<AudioElement, 'src'> & { src?: string; assetId?: string })
  | TextElement
```

### Persisted timeline clips

Clips may carry `assetId` / `thumbnailAssetId` instead of `url` / `thumbnailUrl` when those URLs are project media.

---

## 7. External contracts (dependencies)

Re-implementers must provide types compatible with these interfaces. The session does not own these services; it calls them.

### Timeline (`@opensource/timeline`)

Required methods used by session:

```ts
getState(): TimelineState
loadState(state: TimelineState): void
on('state:change', handler): () => void  // used by bindProjectPersistence
```

`TimelineState` includes at minimum: `tracks`, `clips`, `playheadPosition`, `duration`, `zoom`, `scrollX`, `snappingEnabled`, `isPlaying`, `playbackRate`, `toolMode`, `selectedClipIds`, `primarySelectedClipId`.

**Persistence rule:** `isPlaying` is **never** persisted; always restored as `false`.

### CompositionPreview (`@opensource/video-preview`)

```ts
getState(): CanvasState
loadState(state: CanvasState): void
getCurrentTime(): number
render(time: number, options: { playing: boolean }): void
on('state:changed', handler): () => void  // note: past tense
```

### MediaLibraryService

```ts
list(): MediaLibraryItem[]
getPersistedItems(): MediaLibraryItem[]  // items where source === 'library' && assetId
loadPersistedItems(items: MediaLibraryItem[]): void
addFromResolvedMedia(input: ResolvedMediaInput): MediaLibraryItem
on('added' | 'removed' | 'changed', handler): () => void
```

```ts
interface MediaLibraryItem {
  id: string
  type: 'video' | 'image' | 'audio'
  name: string
  src: string
  thumbnail?: string
  duration?: number
  createdAt: number
  source: 'upload' | 'library'
  assetId?: string
}
```

**Important:** Only `source: 'library'` items with `assetId` are serialized. Ephemeral `upload` items are excluded unless promoted during project create.

### ClipPreviewSyncService (optional but required for correct hydrate/create)

```ts
pause(): void
resume(): void
rebuildMappings(): void
```

Must be paused during `loadState` calls to avoid sync fighting hydration, then `rebuildMappings()` called before `preview.render(...)`.

### Sidebar (optional)

Events consumed by `bindSidebarProject`:

```ts
on('project:create:requested', ({ name }) => void)
on('project:open:requested', () => void)
setProjectStatus(message, { busy?, projectName?, isOpen? })
setProjectAvailability(canManage: boolean)
```

---

## 8. Core classes

### 8.1 `FileSystemProjectStore`

Wraps a `FileSystemDirectoryHandle`.

| Method | Behavior |
|--------|----------|
| `ensureAccess()` | `ensureDirectoryPermission(handle, 'readwrite')`; throw if denied |
| `readDocument()` | Read `project.json`; return `null` on `NotFoundError` |
| `writeDocument(doc)` | Ensure `media/` exists; write pretty-printed JSON (`null, 2`) |
| `ensureMediaDirectory()` | `getDirectoryHandle('media', { create: true })` |
| `buildMediaRelativePath(assetId, fileName)` | `media/{assetId}-{sanitize(fileName)}` |
| `getMediaFileHandle(relativePath)` | Navigate into `media/`, return file handle |
| `writeMediaFile(relativePath, file)` | Write blob/file to path under `media/` |

### 8.2 `MediaAssetService`

Per-project instance. Maintains in-memory maps:

- `urlByAssetId: Map<string, string>`
- `assetIdByUrl: Map<string, string>`
- `objectUrls: Set<string>` — blob URLs to revoke on `destroy()`
- `assets: Map<string, PersistedMediaAsset>`

| Method | Behavior |
|--------|----------|
| `importFromFile(file, fileName?)` | Write to disk, create blob URL from project copy, register maps, upsert IndexedDB asset record |
| `importFromHandle(handle)` | `getFile()` then `importFromFile` |
| `hydrate(assets[])` | For each persisted asset, read file from disk, create blob URL, register |
| `resolveUrl(assetId)` | Runtime blob URL |
| `findAssetIdByUrl(url)` | Reverse lookup |
| `listAssets()` | All registered `PersistedMediaAsset` |
| `toMediaLibraryItem(entry)` | Resolve entry to `MediaLibraryItem` or `null` if URL missing |
| `destroy()` | Revoke all tracked blob URLs, clear maps |

Asset ID format: `asset-${crypto.randomUUID()}`

MIME → media type: `video/*` → `video`, `audio/*` → `audio`, else `image`.

### 8.3 `ProjectSerializer`

#### `captureProjectDocument(input)`

Input:

```ts
{
  meta: ProjectMetadata
  timeline: TimelineState
  canvas: CanvasState
  mediaLibrary: MediaLibraryItem[]
  mediaAssets: MediaAssetService
  transcription?: TranscriptionResult[]
}
```

Output: `ProjectDocument` with `meta.updatedAt = Date.now()`.

Serialization rules:

1. **Media array:** union of all assets from `mediaAssets.listAssets()`.
2. **Clips:** If `clip.url` maps to a project asset → store `assetId`, clear `url`. Same for `thumbnailUrl` → `thumbnailAssetId`. External URLs (not blob, not in asset map) are kept as `url`.
3. **Canvas elements:** Text unchanged. Media elements: store `assetId` when `src` is project media; otherwise keep `src`.
4. **Media library:** Only items with `assetId`; store `thumbnailAssetId` when thumbnail URL resolves to a project asset.
5. **Timeline:** Strip `isPlaying`; persist remaining fields + serialized clips.

#### `resolveProjectDocument(document, mediaAssets)`

Inverse of capture:

- Set `isPlaying: false` on timeline
- Resolve `assetId` → blob URL for clips and canvas elements
- Build `mediaLibrary` items via `mediaAssets.toMediaLibraryItem`

#### `createEmptyProjectDocument(name, timeline, canvas)`

Factory for empty projects (exported utility; not used directly by `ProjectSession.createProject`).

### 8.4 `remapEditorUrls`

Used during **project create** when copying pre-existing library media into the project folder.

```ts
remapTimelineStateUrls(state, urlMap: Map<oldUrl, newUrl>)
remapCanvasStateUrls(state, urlMap)
```

Replaces `clip.url`, `clip.thumbnailUrl`, and media element `src` when keys exist in `urlMap`. No-op when map is empty.

---

## 9. `ProjectSession` — public API

### Constructor options

```ts
interface ProjectSessionOptions {
  debounceMs?: number      // default 1000
  onStatus?: (status: ProjectPersistenceStatus) => void
  onError?: (error: Error) => void
}
```

### Status type

```ts
interface ProjectPersistenceStatus {
  phase: 'idle' | 'saving' | 'loading' | 'importing' | 'ready' | 'error'
  message?: string
  projectId?: string
  projectName?: string
}
```

### Methods

| Method | Description |
|--------|-------------|
| `setSaveContext({ timeline, preview, sidebar, mediaLibrary })` | Default editor refs for debounced `flushSave` |
| `getDocument()` | Current `ProjectDocument` or `null` |
| `getMediaAssets()` | Current `MediaAssetService` or `null` |
| `isOpen()` | `document && store && mediaAssets` all non-null |
| `isBusy()` | phase is `loading`, `saving`, or `importing` |
| `createProject(...)` | See flow §10.1 |
| `openProject(directoryHandle?)` | Pick folder if omitted; read document; `openWithDocument` only (no hydrate) |
| `restoreLastProject(...)` | See flow §10.3 |
| `hydrate(...)` | See flow §10.4 |
| `importUploadedFile(file, mediaLibrary, sidebar)` | Requires open project |
| `pickAndImportMedia(mediaLibrary, sidebar)` | File picker → import each handle |
| `scheduleSave()` | Debounced save; sets `pendingSave = true` |
| `flushSave(timeline?, preview?, sidebar?, mediaLibrary?)` | Immediate save if pending |
| `destroy()` | Clear timer, destroy media assets, null refs |

### Internal state

```ts
index: IndexedDbProjectIndex           // always instantiated
store: FileSystemProjectStore | null
mediaAssets: MediaAssetService | null
document: ProjectDocument | null
saveTimer: ReturnType<typeof setTimeout> | null
pendingSave: boolean
phase: ProjectPersistenceStatus['phase']
debounceMs: number
saveContext: { timeline, preview, sidebar, mediaLibrary } | null
```

---

## 10. Lifecycle flows

### 10.1 Create project

```
createProject(name, directoryHandle, timeline, preview, mediaLibrary, sidebar, clipPreviewSync?)
```

1. Emit `{ phase: 'loading', message: 'Creating project…' }`
2. `new FileSystemProjectStore(handle)` → `ensureAccess()`
3. Generate metadata: `id = project-${uuid}`, `createdAt/updatedAt = now`
4. Destroy previous `mediaAssets` if any
5. `new MediaAssetService(store, index, meta.id)`
6. **`importCurrentMediaLibrary`:** For each item in `mediaLibrary.list()`:
   - `fetch(item.src)` → `File` (copies blob/external URLs into project)
   - `mediaAssets.importFromFile`
   - If thumbnail differs from src, import thumbnail too
   - Build `urlMap: oldUrl → newUrl`
   - Replace library with updated items (`source: 'library'`, `assetId` set)
7. `clipPreviewSync?.pause()`
8. `timeline.loadState(remapTimelineStateUrls(timeline.getState(), urlMap))`
9. `preview.loadState(remapCanvasStateUrls(preview.getState(), urlMap))`
10. `clipPreviewSync?.rebuildMappings()`
11. `preview.render(preview.getCurrentTime(), { playing: false })`
12. `clipPreviewSync?.resume()` (in `finally`)
13. `captureProjectDocument(...)` → `store.writeDocument`
14. Set `this.document`
15. `index.upsertProject` with handle and `lastOpenedAt = now`
16. Emit `{ phase: 'ready', message: 'Project created.', projectId, projectName }`

### 10.2 Open project

```
openProject(directoryHandle?)
```

1. Emit loading
2. Pick directory if not provided
3. Read `project.json`; throw if missing
4. **`openWithDocument(store, document)`:**
   - Destroy old media assets
   - Set `store`, `document`
   - `new MediaAssetService(store, index, document.meta.id)`
   - `index.upsertProject` (touch `lastOpenedAt`)
5. Emit ready

**Note:** `openProject` does **not** hydrate the editor. Callers must call `hydrate` separately (as `bindProjectPersistence.openProject` does).

### 10.3 Restore last project

```
restoreLastProject(timeline, preview, sidebar, mediaLibrary, clipPreviewSync)
```

1. `index.getLastOpenedProject()` → `null` if none
2. Emit loading
3. `ensureDirectoryPermission(record.directoryHandle, 'readwrite')`
   - If denied: emit idle + message, return `null`
4. Read document from store; if missing: emit idle + message, return `null`
5. `openWithDocument`
6. `await hydrate(...)`
7. Return document
8. On error: `handleError`, return `null`

### 10.4 Hydrate editor from document

```
hydrate(timeline, preview, sidebar, mediaLibrary, clipPreviewSync)
```

1. No-op if `!document || !mediaAssets`
2. Emit loading
3. `clipPreviewSync.pause()`
4. Snapshot `inFlightLibraryItems = mediaLibrary.getPersistedItems()` (preserves items added before hydrate completes)
5. `await mediaAssets.hydrate(document.media)` — creates blob URLs for all assets
6. `resolveProjectDocument(document, mediaAssets)`
7. **Merge media library:** resolved items + in-flight items whose `id` is not in resolved set
8. `timeline.loadState(resolved.timeline)`
9. `preview.loadState(resolved.canvas)`
10. `mediaLibrary.loadPersistedItems(merged)`
11. `clipPreviewSync.rebuildMappings()`
12. `preview.render(..., { playing: false })`
13. `clipPreviewSync.resume()` (in `finally`)
14. Emit ready

### 10.5 Import uploaded file

Requires `isOpen()`.

1. Emit `importing`
2. `mediaAssets.importFromFile(file)`
3. `mediaLibrary.addFromResolvedMedia({ assetId, type, name, src: url })`
4. `scheduleSave()`
5. Emit ready

Throws: `'Open a project before uploading media.'`

### 10.6 Pick and import media

Requires `isOpen()`. Uses `pickMediaFiles` with accept map:

```ts
{
  'video/*': ['.mp4', '.mov', '.webm', '.mkv'],
  'image/*': ['.png', '.jpg', '.jpeg', '.webp', '.gif'],
  'audio/*': ['.mp3', '.wav', '.aac', '.m4a', '.ogg'],
}
```

For each handle: import + add to library. Then `scheduleSave()`.

### 10.7 Debounced save

```
scheduleSave()
  pendingSave = true
  reset timer(debounceMs) → flushSave()

flushSave(timeline?, preview?, sidebar?, mediaLibrary?)
```

Guard: return early if `!pendingSave || !store || !mediaAssets || !document`

Resolve editor refs from args or `saveContext`.

1. `pendingSave = false`
2. Emit `saving`
3. `captureProjectDocument` — **preserve** `this.document.transcription`
4. `store.writeDocument`
5. `index.upsertProject` (update `updatedAt`, `lastOpenedAt`)
6. Emit `ready`

On error: set `pendingSave = true` again, `handleError`, rethrow.

---

## 11. Integration: `bindProjectPersistence`

Factory that connects `ProjectSession` to `VideoEditor`.

### Options

```ts
interface BindProjectPersistenceOptions {
  editor: VideoEditor
  clipPreviewSync: ClipPreviewSyncService
  autoSave?: boolean        // default true
  autoRestore?: boolean     // default true
  debounceMs?: number       // default 1000
  onStatus?: (status) => void
  onError?: (error: Error) => void
  onReady?: (restored: boolean) => void
}
```

### Behavior

1. Create `ProjectSession` with status callback that also updates `editor.sidebar?.setProjectStatus(message, { busy, projectName, isOpen })`.
2. `session.setSaveContext` from editor refs.
3. If `autoSave`, subscribe:
   - `timeline.on('state:change', scheduleSave)`
   - `preview.on('state:changed', scheduleSave)`
   - `mediaLibrary.on('added' | 'removed' | 'changed', scheduleSave)`
   - `scheduleSave` no-ops when `!autoSave || !session.isOpen()`
4. `window.beforeunload` → `flushSave()`
5. Expose `editor.projectPersistence`:

```ts
interface ProjectPersistenceApi {
  session: ProjectSession
  createProject(name, directoryHandle?): Promise<ProjectDocument>
  openProject(directoryHandle?): Promise<ProjectDocument>  // includes hydrate
  restoreLastProject(): Promise<ProjectDocument | null>
  importUploadedFile(file: File): Promise<MediaLibraryItem>
  importMedia(): Promise<void>
  save(): Promise<void>
}
```

6. If `autoRestore`: call `restoreLastProject()` on init; `onReady(restored)`; catch errors → sidebar status + `onReady(false)`.
7. If sidebar present: `bindSidebarProject({ sidebar, persistence })`.
8. Dispose: flush, unsubscribe all, `session.destroy()`, delete `editor.projectPersistence`.

### VideoEditor integration point

```ts
// VideoEditorOptions
project?: ProjectPersistenceOptions

// Constructor
if (options.project) {
  bindProjectPersistence({ editor: this, clipPreviewSync: this.clipPreviewSync, ...options.project })
}

// Media library upload routing (requires open, non-busy project)
importUploadedFile: async (file) => {
  if (!persistence?.session.isOpen() || persistence.session.isBusy()) return null
  return persistence.importUploadedFile(file)
}
```

Enable persistence by passing any truthy `project` option (even `{}`).

---

## 12. Integration: `bindSidebarProject`

```ts
bindSidebarProject({ sidebar, persistence })
```

1. `sidebar.setProjectAvailability('showDirectoryPicker' in window)`
2. On `project:create:requested`: `persistence.createProject(name)` + status updates
3. On `project:open:requested`: `persistence.openProject()` + status updates
4. Errors → `setProjectStatus('Create/Open failed: …')` + `console.error`

Returns dispose function for event unsubscribes.

---

## 13. Error handling

| Scenario | Behavior |
|----------|----------|
| Directory permission denied (create/open) | Throw `Error('Project directory permission was denied.')` |
| Missing `project.json` on open | Throw `Error('No project.json found in the selected directory.')` |
| Import without open project | Throw |
| Restore permission denied | Return `null`, status `idle` with user message |
| Restore missing document | Return `null`, status `idle` with user message |
| Save failure | `phase: 'error'`, `onError`, `pendingSave` restored |
| Generic errors in restore | `handleError`, return `null` |

`handleError` normalizes unknown values to `Error`, emits error status, calls `onError`.

---

## 14. Concurrency and consistency rules

1. **Never persist `isPlaying`.** Always hydrate with `isPlaying: false`.
2. **Pause clip-preview sync** during any `loadState` on timeline or preview.
3. **Always `rebuildMappings` + `render`** after loading state.
4. **Merge in-flight library items** on hydrate to avoid losing concurrent uploads.
5. **Transcription** is passed through saves unchanged (`this.document.transcription`); session does not edit it.
6. **Only `library` source items with `assetId`** enter `project.json` mediaLibrary.
7. **Blob URL lifecycle:** `MediaAssetService.destroy()` and `MediaLibraryService.destroy()` must revoke URLs.
8. **`isBusy()`** blocks media upload routing in VideoEditor (`importUploadedFile` returns `null`).

---

## 15. Example `project.json` (minimal)

```json
{
  "version": 1,
  "meta": {
    "id": "project-a1b2c3d4-...",
    "name": "My Edit",
    "createdAt": 1718640000000,
    "updatedAt": 1718643600000
  },
  "media": [
    {
      "id": "asset-e5f6...",
      "relativePath": "media/asset-e5f6...-clip.mp4",
      "name": "clip.mp4",
      "mimeType": "video/mp4",
      "size": 1048576,
      "lastModified": 1718640000000
    }
  ],
  "timeline": {
    "tracks": [],
    "clips": [
      {
        "id": "clip-1",
        "trackId": "track-1",
        "type": "video",
        "name": "clip.mp4",
        "startTime": 0,
        "duration": 5,
        "inPoint": 0,
        "outPoint": 5,
        "assetId": "asset-e5f6..."
      }
    ],
    "playheadPosition": 0,
    "duration": 10,
    "zoom": 50,
    "scrollX": 0,
    "snappingEnabled": true,
    "playbackRate": 1,
    "toolMode": "select",
    "selectedClipIds": [],
    "primarySelectedClipId": null
  },
  "canvas": {
    "aspectRatio": "16:9",
    "playerSize": { "width": 1920, "height": 1080 },
    "elements": [
      {
        "id": "element-1",
        "type": "video",
        "name": "clip.mp4",
        "assetId": "asset-e5f6...",
        "x": 0,
        "y": 0,
        "width": 1920,
        "height": 1080,
        "rotation": 0,
        "zIndex": 0,
        "startTime": 0,
        "duration": 5,
        "opacity": 1,
        "muted": false,
        "loop": false
      }
    ],
    "selectedId": null
  },
  "mediaLibrary": [
    {
      "id": "media-1",
      "assetId": "asset-e5f6...",
      "type": "video",
      "name": "clip.mp4",
      "source": "library",
      "createdAt": 1718640000000
    }
  ]
}
```

---

## 16. File map (reference implementation)

```
packages/core/src/project/
├── ProjectSession.ts           # orchestrator
├── ProjectSession.test.ts
├── bindProjectPersistence.ts   # editor wiring + ProjectPersistenceApi
├── bindSidebarProject.ts       # sidebar event wiring
├── FileSystemProjectStore.ts
├── IndexedDbProjectIndex.ts
├── IndexedDbProjectIndex.test.ts
├── MediaAssetService.ts
├── MediaAssetService.test.ts
├── ProjectSerializer.ts
├── ProjectSerializer.test.ts
├── remapEditorUrls.ts
├── fileSystemAccess.ts
├── types.ts
└── index.ts                    # public exports
```

### Public exports from `@opensource/core`

`ProjectSession`, `bindProjectPersistence`, `FileSystemProjectStore`, `IndexedDbProjectIndex`, `MediaAssetService`, `captureProjectDocument`, `createEmptyProjectDocument`, `resolveProjectDocument`, `pickProjectDirectory`, `pickMediaFiles`, and all types/constants listed in `types.ts`.

---

## 17. Testing requirements

Re-implementation should include tests for:

### `ProjectSession`

- Create project → import uploaded file → flush save → document and disk contain asset + library entry with matching `assetId`.

### `ProjectSerializer`

- Round-trip: runtime URLs → `assetId` in document → resolve back to same blob URLs.
- External (non-project) URLs remain as `url`/`src` in document.

### `MediaAssetService`

- Import writes file under `media/`, returns blob URL, registers IndexedDB record.

### `IndexedDbProjectIndex`

- `getLastOpenedProject` returns highest `lastOpenedAt`.

### Mock strategy

Mock `FileSystemDirectoryHandle` with in-memory `Map`s for root files and `media/` files. Mock IndexedDB or inject a fake index. Use Vitest.

---

## 18. Implementation checklist

- [ ] Define `ProjectDocument` types and constants
- [ ] Implement `fileSystemAccess` helpers
- [ ] Implement `FileSystemProjectStore`
- [ ] Implement `IndexedDbProjectIndex` with schema v1
- [ ] Implement `MediaAssetService` with URL map and revoke on destroy
- [ ] Implement `ProjectSerializer` capture/resolve
- [ ] Implement `remapEditorUrls`
- [ ] Implement `ProjectSession` with all lifecycle methods
- [ ] Implement `bindProjectPersistence` (auto-save, restore, API)
- [ ] Implement `bindSidebarProject` (optional UI)
- [ ] Wire upload path to require open project
- [ ] Gate UI on `showDirectoryPicker` availability
- [ ] Add unit tests per §17
- [ ] Manual test: create → edit → reload → restore last project

---

## 19. Known limitations (current behavior)

- No explicit **close project** or **delete project** API.
- No migration path for `PROJECT_DOCUMENT_VERSION > 1`.
- IndexedDB media asset records are written but not cleaned up on project close.
- `sidebar` parameter is accepted in several methods but unused (reserved for future UI hooks).
- Requires Chromium-based browsers with File System Access API for full functionality.
- `fetchMediaAsFile` on create assumes `item.src` is fetchable (blob or http); CORS may block remote URLs.

---

## 20. Minimal standalone usage (without VideoEditor)

```ts
import { ProjectSession } from './project/ProjectSession'

const session = new ProjectSession({
  debounceMs: 1000,
  onStatus: (s) => console.log(s.phase, s.message),
  onError: (e) => console.error(e),
})

session.setSaveContext({ timeline, preview, sidebar: null, mediaLibrary })

// Create
const handle = await pickProjectDirectory()
await session.createProject('My Project', handle, timeline, preview, mediaLibrary, null, clipPreviewSync)

// Edit → auto-save
session.scheduleSave()
await session.flushSave()

// Open later
await session.openProject(handle)
await session.hydrate(timeline, preview, null, mediaLibrary, clipPreviewSync)

session.destroy()
```

This is the smallest integration surface for porting to a new project.
