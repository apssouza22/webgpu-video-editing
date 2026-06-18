# Remove project module from core workspace

**Complexity:** ✅ Simple — Single-pass executable, low risk

## Goal

Remove `packages/core/src/project/` from `@opensource/core`. Project persistence is documented in `.agents/specs/project-session.md` for future re-implementation as a separate package. Core should no longer export or wire project session APIs.

## Steps

- [x] Delete `packages/core/src/project/` (all source and tests)
- [x] Remove project exports from `packages/core/src/index.ts`
- [x] Update `VideoEditor.ts`:
  - Remove `project` option, `projectPersistence`, and `bindProjectPersistence` wiring
  - Simplify media upload to use `MediaLibraryService.addFromFile` only (drop project routing)
- [x] Update `packages/core/demo/main.ts` to seed demo media without project restore flow
- [x] Run `npm run typecheck -w @opensource/core` and `npm run test -w @opensource/core` to validate

## Validation

- Typecheck passes with no project imports remaining in core
- Core unit tests pass (project-specific tests removed with the module)
- Demo still loads and seeds demo clip without project option
