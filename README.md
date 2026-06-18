# GPU Video Editor

Multi-package npm workspace that assembles independent video editing modules into a single editor.

> **Contributors & AI agents:** see [AGENTS.md](./AGENTS.md) for submodule workflow, workspace layout, and where to make changes.

## Structure

```
gpu-video-editor/              ← assembly root (this repo)
├── package.json               ← npm workspaces root
├── .gitmodules
├── AGENTS.md
└── packages/
    ├── timeline/              ← submodule → apssouza22/video-timeline
    ├── video-preview/          ← submodule → apssouza22/video-preview
    └── core/                  ← lives in this repo (@opensource/core)
```

| Repository | GitHub |
|------------|--------|
| Assembly | [apssouza22/webgpu-video-editing](https://github.com/apssouza22/webgpu-video-editing) |
| Timeline | [apssouza22/video-timeline](https://github.com/apssouza22/video-timeline) |
| Video preview | [apssouza22/video-canvas](https://github.com/apssouza22/video-canvas) |

`timeline` and `video-preview` are [git submodules](https://git-scm.com/book/en/v2/Git-Tools-Submodules). Each keeps its own history and can be developed independently. The assembly root tracks which commit of each submodule is pinned.

## Architecture

```
@opensource/timeline  ──┐
                        ├──► @opensource/core  ──► VideoEditor (integration + demo)
@opensource/video-preview ┘
```

- **Timeline** — framework-agnostic, event-driven video timeline editor.
- **Video preview** — composition preview for layering and previewing video, image, audio, and text elements.
- **Core** — wires timeline transport to the composition preview; exports `VideoEditor`.

## Prerequisites

- Node.js 20+
- npm 10+ (workspaces)
- Git with submodule support

## Getting started

### Fresh clone

```bash
git clone --recurse-submodules git@github.com:apssouza22/webgpu-video-editing.git gpu-video-editor
cd gpu-video-editor
npm install
```

### Existing clone (submodules missing or empty)

```bash
git submodule update --init --recursive
npm install
```

Always run `npm install` from the **repo root** so workspaces link correctly under `node_modules/@opensource/*`.

## Development

| Command | Description |
|---------|-------------|
| `npm run dev` | Core demo — integrated timeline + canvas preview (http://localhost:5551) |
| `npm run dev:timeline` | Timeline package demo (http://localhost:5553) |
| `npm run dev:video-preview` | Video preview package demo (http://localhost:5554) |
| `npm run dev:gpu-video-encode` | GPU video encode demo (http://localhost:5555) |
| `npm run build` | Build all packages |
| `npm run test` | Run tests in all packages |
| `npm run typecheck` | Typecheck all packages |

Target a single workspace:

```bash
npm run build -w @opensource/timeline
npm run test -w @opensource/video-preview
```

### Where to edit

| Change | Location |
|--------|----------|
| Timeline behavior, UI, or API | `packages/timeline/` (submodule repo) |
| Preview rendering or composition API | `packages/video-preview/` (submodule repo) |
| Integration, `VideoEditor`, core demo | `packages/core/` (this repo) |

When running `npm run dev`, core's Vite config resolves submodule imports to **source files**, so changes in `packages/timeline` and `packages/video-preview` hot-reload without rebuilding those packages.

For production builds or publishing, build submodules first so `dist/` is up to date:

```bash
npm run build -w @opensource/timeline
npm run build -w @opensource/video-preview
npm run build -w @opensource/core
```

## Packages

### `@opensource/timeline` (submodule)

Framework-agnostic, event-driven video timeline editor.

### `@opensource/video-preview` (submodule)

Composition preview for layering video, image, audio, and text elements. Exposes TypeScript source in `exports` so npm workspaces can consume it during development without a pre-build.

### `@opensource/core` (assembly repo)

Integrates timeline transport with the composition preview. Exports `VideoEditor`, which syncs playhead changes to preview rendering.

```typescript
import { VideoEditor } from '@opensource/core';
import '@opensource/core/style.css';

const editor = new VideoEditor({
  timelineContainer: document.getElementById('timeline')!,
  previewContainer: document.getElementById('canvas')!,
});

editor.timeline.addClip({
  type: 'text',
  name: 'Title',
  duration: 5,
  textContent: 'Hello',
});
```

## Working with submodules

### Submodule is empty after clone

```bash
git submodule update --init --recursive
```

### Pull latest submodule changes

```bash
git submodule update --remote packages/timeline
git submodule update --remote packages/video-preview
```

Test locally, then commit the updated submodule SHAs in the assembly repo.

### Commit changes inside a submodule

Submodules are separate git repos. Push from the submodule first, then pin the commit in the assembly repo:

```bash
cd packages/timeline
git checkout -b my-feature    # submodules often start detached; use a branch
git add .
git commit -m "Your change"
git push -u origin my-feature

cd ../..
git add packages/timeline
git commit -m "Pin timeline submodule"
```

Open PRs in the submodule repository for package changes, and in the assembly repository when only updating pinned SHAs or changing `packages/core`.

### Common pitfalls

| Symptom | Fix |
|---------|-----|
| `packages/timeline` or `packages/video-preview` is empty | `git submodule update --init --recursive` |
| `@opensource/timeline` not found after install | Run `npm install` from repo root, not inside a package |
| Submodule changes not visible in `npm run dev` | Confirm you edited files under `packages/<name>/`, not `node_modules/` |
| Detached HEAD when committing in submodule | `git checkout -b <branch>` before committing |
