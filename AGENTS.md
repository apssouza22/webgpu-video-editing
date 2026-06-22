# Agent guide — GPU Video Editor

This document explains how the assembly repository, git submodules, and npm workspaces fit together. Read it before making changes anywhere in the monorepo.

## What this repo is

`gpu-video-editor` is an **assembly root**: it wires independent packages into one editor without merging their git histories. Two packages live in separate repositories as submodules; integration code lives here.

```
gpu-video-editor/                 ← this repo (assembly)
├── package.json                  ← npm workspaces root
├── .gitmodules                   ← submodule registry
├── AGENTS.md                     ← you are here
└── packages/
    ├── timeline/                 ← git submodule → apssouza22/video-timeline
    ├── video-preview/             ← git submodule → apssouza22/video-preview
    ├── core/                     ← lives in this repo (@opensource/core)
    └── gpu-video-encode/         ← lives in this repo (@opensource/gpu-video-encode)
```

| Package | Scope | Repository |
|---------|-------|------------|
| `@opensource/timeline` | Submodule | [apssouza22/video-timeline](https://github.com/apssouza22/video-timeline) |
| `@opensource/video-preview` | Submodule | [apssouza22/video-canvas](https://github.com/apssouza22/video-canvas) |
| `@opensource/core` | Assembly repo | [apssouza22/webgpu-video-editing](https://github.com/apssouza22/webgpu-video-editing) |
| `@opensource/gpu-video-encode` | Assembly repo | same — WebGPU export pipeline (WebCodecs + MediaBunny); library in `src/`, preview player in `demo/` |

Package-specific notes live in `packages/timeline/AGENTS.md` and `packages/video-preview/AGENTS.md`.

## npm workspaces

The root `package.json` declares:

```json
"workspaces": ["packages/*"]
```

Effects:

- A single `npm install` at the repo root links all packages under `node_modules/@opensource/*`.
- Workspace packages reference each other with `"*"` versions (e.g. core depends on `@opensource/timeline` and `@opensource/video-preview`).
- Root scripts fan out to workspaces: `build`, `test`, and `typecheck` run in every package; `dev` targets `@opensource/core`.

Run a command in one workspace:

```bash
npm run build -w @opensource/timeline
npm run test -w @opensource/video-preview
```

Always install from the **assembly root**, not inside individual packages, unless you are working on a submodule standalone outside this monorepo.

## How packages connect

`@opensource/core` is the integration layer. It imports `Timeline` and `CompositionPreview`, binds playhead changes to canvas rendering, and re-exports both APIs.

Dependency direction:

```
@opensource/timeline  ──┐
                        ├──► @opensource/core
@opensource/video-preview ┘
```

- **Timeline / video-preview changes** → edit inside the submodule, commit and push in that repo, then pin the new commit in the assembly repo.
- **Wiring, demo, or cross-package behavior** → edit `packages/core/`.

## Dev vs build resolution

During **development**, Vite aliases in `packages/core/vite.config.ts` resolve submodule imports to **source files** (not `dist/`). Edits in `packages/timeline` or `packages/video-preview` are picked up immediately when running `npm run dev`.

During **library builds**, core externalizes `@opensource/timeline` and `@opensource/video-preview` so consumers install them as peer-like dependencies. Submodule packages must be built (`npm run build -w @opensource/timeline`, etc.) before publishing or consuming their `dist/` output.

`@opensource/video-preview` exposes TypeScript source in its `exports` field so workspaces can consume it without a pre-build step during dev.

## Git submodules

Submodules are separate git repositories checked out at fixed paths. The assembly repo records **which commit** of each submodule is pinned.

### Clone

```bash
git clone --recurse-submodules git@github.com:apssouza22/webgpu-video-editing.git gpu-video-editor
cd gpu-video-editor
npm install
```

If submodules are missing after clone:

```bash
git submodule update --init --recursive
npm install
```

### Change code in a submodule

1. `cd packages/timeline` (or `packages/video-preview`).
2. Create a branch, make changes, commit, and push to the submodule's remote.
3. Return to the assembly root and record the new submodule commit:

```bash
cd ../..
git add packages/timeline
git commit -m "Pin timeline submodule"
```

Never commit submodule changes only inside the assembly repo without pushing from the submodule first — other clones will reference a commit that does not exist on the remote.

### Pull latest submodule commits

```bash
git submodule update --remote packages/timeline
git submodule update --remote packages/video-preview
```

Review and test before pinning updated submodule SHAs in the assembly repo.

### Detached HEAD in submodules

After `git submodule update`, submodules are often on a detached HEAD. Before committing inside a submodule, create or checkout a branch:

```bash
cd packages/timeline
git checkout -b my-feature
```

## Commands

| Command | What it does |
|---------|----------------|
| `npm install` | Install and link all workspaces (run at repo root) |
| `npm run dev` | Core demo — timeline + canvas integrated preview (port 5551) |
| `npm run dev:timeline` | Timeline package demo (port 5553) |
| `npm run dev:video-preview` | Video preview demo (port 5554) |
| `npm run dev:gpu-video-encode` | GPU video encode/export demo (port 5555) |
| `npm run build` | Build all packages |
| `npm run test` | Test all packages |
| `npm run typecheck` | Typecheck all packages |

## Boundaries

### Always

- Run `npm install` from the assembly root.
- Put timeline-only logic in `packages/timeline`, preview-only logic in `packages/video-preview`, integration in `packages/core`.
- When touching a submodule, commit and push in the submodule repo, then pin the SHA in the assembly repo.
- Build submodule packages before relying on their `dist/` artifacts.
- Organize code by domain package, not by technical layer
- Write domain tests in the tests folder outside the src folder
- Tests should cover domain logic, not implementation details
- Prefer object oriented patterns over functional patterns
- Assume that webgpu is available
- Highly decoupled components by using events and commands
- Ensure strong boundaries between packages
- The intersection between packages should be small and well defined
- The crossing points between packages should be well defined and not leak implementation details
- Create a component subscriber class for each component in the core subscribers package. Ex TimelineSubscriber
- Create a service class for each component to facilitate communication between the component and the outside world
- Only services and data objects should be available outside of the packages
- Avoid object deconstruction in the public API of the packages. `This is Bad {timeline, preview, leftNav, timelinePreviewSync}: PreviewOptions`


## Component subscribers
The component subscribers are responsible for subscribing to component events and react accordingly. 
Example: The timeline subscriber is responsible for subscribing to the timeline events and react accordingly. 
It can react by calling a service, emitting an event or updating the component state.



### Ask first

- Adding dependencies to any `package.json`.
- Changing submodule URLs or adding new submodules.
- Changing public exports or package names (`@opensource/*`).

### Never

- Edit `node_modules/` or committed `dist/` output by hand.
- Commit secrets, API keys, or credentials.
- Change assembly-repo files when the work belongs in a submodule (and vice versa).
- Skip submodule init and assume `packages/timeline` or `packages/video-preview` are ordinary directories.

## Tech stack (shared)

- TypeScript, Vite, Tailwind CSS v4
- Vitest in timeline and video-preview
- Framework-agnostic packages (no React in the public APIs)


# Task execution plan
Important: Always plan the task step by step before writing code. Ask for permission to proceed with the plan.
Important: Before proceed with the plan, create a new file named `.agents/plans/name-of-the-task.md`.
Based on the approved plan, list all necessary implementation steps as GitHub-style checkboxes (`- [ ] Step Description`). Use sub-bullets for granular details within each main step.


- Plans should be detailed enough to execute without ambiguity
- Each task in the plan must include at least one validation test to verify it works. Preferably an integration test.
- Assess complexity and single-pass feasibility - can an agent realistically complete this in one go?
- Include a complexity indicator at the top of each plan:
  ✅ Simple - Single-pass executable, low risk
  ⚠️ Medium - May need iteration, some complexity
  🔴 Complex - Break into sub-plans before executing

**CRITICAL: After you successfully complete each step, you MUST update the `.agents/plans/name-of-the-task.md` file by changing the corresponding checkbox from `- [ ]` to `- [x]`.**
Only proceed to the *next* unchecked item after confirming the previous one is checked off in the file. Announce which step you are starting.
