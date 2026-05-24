# AGENTS.md

## Project Context

Gitano is a Tauri + React + TypeScript desktop Git client.

Frontend stack:

- React 18
- Vite
- TypeScript strict mode
- Vitest + Testing Library
- Mantine, Tailwind, Zustand

Backend stack:

- Tauri 2
- Rust
- git2/libgit2

## Core Rules

- Follow existing code structure before inventing new patterns.
- Keep changes scoped to the requested feature or fix.
- Prefer simple, typed, readable code over clever abstractions.
- Do not refactor unrelated code while implementing a feature.
- Preserve user changes. Never reset or revert unrelated files.

## Architecture

- `src/app` is for bootstrap, providers, shell composition, startup effects, and global orchestration.
- `src/features/<feature>` owns user-facing Git workflows, including components, hooks, stores, utils, types, constants, API files, and tests.
- `src/shared` is for feature-independent UI, platform adapters, pure utilities, config, and cross-feature types.
- Dependency direction is `app -> features -> shared`.
- `src/shared` must not import from `src/features` or `src/app`.
- Features must not import from other feature folders. If two features need the same code, move that code upward to `src/shared` in the appropriate domain folder.
- Feature `index.ts` files are public boundaries for app composition and external callers, not a way for one feature to depend on another feature.
- Cross-layer imports should use aliases: `@/app`, `@/features`, `@/shared`.
- Same-feature imports may use relative paths.

## Tauri and Platform Boundaries

- React components must not call raw Tauri commands directly.
- Frontend Git/Tauri calls must go through typed adapters in `src/shared/api` or `src/shared/platform`.
- Command names and payload shapes should be centralized in adapters.
- Platform calls must be mockable in tests.

## File Organization

- TypeScript and TSX filenames must be kebab-case.
- Components live in their own folder.
- Component implementation files should use the component name, such as `branch-name.tsx`, not `index.tsx`.
- Component folders may use `index.ts` as the public export boundary so consumers import from the folder path instead of `component-name/component-name`.
- Component tests live next to the component as `.test.tsx`.
- Pure utility tests live next to the utility as `.test.ts`.
- Feature hooks must live in `src/features/<feature>/hooks`. Shared reusable hooks must live under `src/shared`, in a documented hooks location if one exists.
- Keep types close to the code that owns them. Prefer file-local types for single-file use, component-folder `types.ts` for component-specific shared types, and feature-level `types/<domain>.ts` files for types reused across a feature.
- Cross-feature shared types belong in `src/shared/types/<domain>.ts`. Do not create broad catch-all type files; split shared types by domain such as Git, diff, repository, platform, or AI.
- API request/response types should stay near the typed adapter unless multiple features need the same contract; then promote them to `src/shared/types`.
- Keep files focused and small.
- Split files when rendering, data loading, mutation logic, parsing, or complex state orchestration are mixed together.
- Treat roughly 250-350 lines as a review signal, not a hard rule. When a file grows past that range, either split cohesive pieces into nearby files or keep it together and be able to explain why splitting would make the code harder to understand.
- Use local `types.ts` and `utils.ts` files when they keep the primary component readable. Avoid local component `hooks.ts` files unless the logic is truly private to that component folder; otherwise place hooks in the owning `hooks/` folder.
- Do not add new shared UI to a top-level `src/components` folder. Shared generic UI belongs under `src/shared`.

## Testing

- Code changes require tests.
- Add or update colocated Vitest tests for frontend changes.
- Add or update Rust unit tests when backend logic changes.
- Test pure utilities, adapters, hooks, stores, edge cases, and meaningful component interactions.
- Mock Tauri/platform behavior at the adapter boundary.
- Do not skip tests or weaken assertions to make a run pass.
- If a change truly cannot be tested, explain why in the final response.

## Verification

Before finishing, run the narrowest relevant checks:

- Frontend changes: `pnpm run lint`, `pnpm test`, `pnpm run build`
- Rust/Tauri changes: `cargo test` from `src-tauri`
- Packaging changes: `pnpm verify:macos-bundle-deps` after building the macOS app bundle

If a command cannot be run, state exactly which command and why.

## UI Guidelines

- Match existing Mantine/Tailwind patterns.
- Keep Git workflow screens dense, task-focused, and app-like.
- Avoid decorative landing-page patterns for product workflow screens.
- Reuse existing icons from the project's icon libraries.
- Verify changed UI at narrow and desktop widths when layout risk exists.
- Text must not overlap or overflow its container.

## OpenSpec

- For non-trivial features or behavior changes, create or update an OpenSpec change before implementation.
- Keep implementation aligned with `proposal.md`, `design.md`, and `tasks.md`.
- Update tasks as work is completed.
- Archive or sync specs only after implementation and verification.

## Final Response

Summarize:

- What changed
- Which files were touched
- Which checks were run
- Any checks not run and why
