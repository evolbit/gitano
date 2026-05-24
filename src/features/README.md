# Features

Feature folders own user-facing Git workflows. Each feature keeps its own
implementation details grouped by role:

- `components/` for feature UI. Each component lives in its own folder with its
  adjacent `.test.tsx` file.
- `hooks/` for feature-owned React hooks.
- `stores/` for feature-owned state containers.
- `utils/` for feature-owned pure helpers and their tests.
- `api/`, `types/`, and `constants/` for feature-local adapters and contracts.

Shared code should be promoted to `src/shared` only when multiple features need
it or when it is platform/application infrastructure.
