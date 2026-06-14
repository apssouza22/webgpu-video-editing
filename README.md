# GPU Video Editor

Multi-package npm workspace that assembles independent video editing modules into a single editor.

## Structure

```
gpu-video-editor/              ← assembly root (this repo)
├── package.json
├── .gitmodules
└── packages/
    ├── timeline/              ← submodule → apssouza22/video-timeline
    ├── video-canvas/          ← submodule → apssouza22/video-canvas
    └── core/                  ← lives in this repo (@opensource/core)
```

| Repository | GitHub |
|------------|--------|
| Assembly | [apssouza22/webgpu-video-editing](https://github.com/apssouza22/webgpu-video-editing) |
| Timeline | [apssouza22/video-timeline](https://github.com/apssouza22/video-timeline) |
| Video canvas | [apssouza22/video-canvas](https://github.com/apssouza22/video-canvas) |

`timeline` and `video-canvas` are [git submodules](https://git-scm.com/book/en/v2/Git-Tools-Submodules). Each keeps its own history and can be developed independently. The assembly root tracks which commit of each submodule is pinned.

## Prerequisites

- Node.js 20+
- npm 10+ (workspaces)
- Git with submodule support

## Clone

```bash
git clone --recurse-submodules git@github.com:apssouza22/webgpu-video-editing.git gpu-video-editor
cd gpu-video-editor
npm install
```

If you already cloned without submodules:

```bash
git submodule update --init --recursive
npm install
```

## Setup (existing checkout)

```bash
npm install
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Core demo — timeline + canvas preview |
| `npm run dev:timeline` | Timeline package demo |
| `npm run dev:video-canvas` | Video canvas package demo |
| `npm run build` | Build all packages |
| `npm run test` | Run tests in all packages |
| `npm run typecheck` | Typecheck all packages |

Run a script in a single workspace:

```bash
npm run build -w @opensource/timeline
npm run test -w @opensource/video-canvas
```

## Packages

### `@opensource/timeline` (submodule)

Framework-agnostic, event-driven video timeline editor.

### `@opensource/video-canvas` (submodule)

Composition canvas for layering and previewing video, image, audio, and text elements.

### `@opensource/core` (assembly repo)

Integrates timeline transport with the composition canvas. Exports `VideoEditor`, which syncs playhead changes to canvas rendering.

```typescript
import { VideoEditor } from '@opensource/core';
import '@opensource/core/style.css';

const editor = new VideoEditor({
  timelineContainer: document.getElementById('timeline')!,
  canvasContainer: document.getElementById('canvas')!,
});

editor.timeline.addClip({
  type: 'text',
  name: 'Title',
  duration: 5,
  textContent: 'Hello',
});
```

## Working with submodules

### Pull latest submodule changes

```bash
git submodule update --remote packages/timeline
git submodule update --remote packages/video-canvas
```

### Commit changes inside a submodule

Work inside the submodule directory, commit there, then pin the new commit in the assembly repo:

```bash
cd packages/timeline
git add .
git commit -m "Your change"
git push

cd ../..
git add packages/timeline
git commit -m "Pin timeline submodule"
```

## Workspace note: video-canvas exports

The submodule copy of `video-canvas` uses `@opensource/video-canvas` with source `exports` so npm workspaces can consume it. Commit that change in the `video-canvas` repository when you are ready:

```bash
cd packages/video-canvas
git add package.json
git commit -m "Add package exports for workspace consumption"
git push
```
