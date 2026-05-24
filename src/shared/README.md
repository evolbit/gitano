# Shared Layer

Reusable UI primitives, generic hooks, platform adapters, constants, cross-feature types, and pure utilities live here.

Shared modules must stay independent from `src/features`.

Shared UI belongs in `src/shared/components`, not in a top-level
`src/components` folder. Each shared component has its own folder and adjacent
component test.
