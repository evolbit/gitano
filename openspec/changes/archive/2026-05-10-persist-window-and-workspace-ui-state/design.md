## Context

The app already uses Zustand persistence through Tauri store for repo tabs and recent repositories. That persistence is currently too narrow: most workspace UI state still lives in local `useState` inside components such as `RepoTabLayout`, `BranchList`, `ChangesExplorer`, and `ChangesPanel`. Window sizing is also reapplied from static defaults on startup, which overwrites user resizing.

## Goals / Non-Goals

**Goals:**
- Restore window bounds on launch while respecting configured minimum size constraints.
- Persist durable per-repo workspace UI state keyed by `repoPath`.
- Persist pane widths, left sidebar open sections, branch/changes explorer preferences, and independent current/commit view modes.
- Continue persisting repo tabs and active repo selection.

**Non-Goals:**
- Persist ephemeral UI state such as search queries, loading flags, context menus, or currently open modals.
- Persist temporary modal tree expansion state.
- Change Git data fetching behavior.
- Solve stale selected-commit rehydration beyond the existing behavior unless required by implementation.

## Decisions

### Split persistence into session/repo state and workspace UI state
The existing repo store is already responsible for session-like repo state. Instead of overloading it with every UI preference, introduce a dedicated persisted workspace/UI store for:

```text
window
repoStateByPath
```

This keeps durable layout/preferences separate from tab/session data.

### Key per-repo UI state by repo path
Workspace preferences should follow the repository, not a tab instance. If the same repo is reopened later, the user should get the same sidebar/layout preferences.

### Persist only durable preferences
Use this boundary:

```text
Persist:
- window bounds
- pane widths
- left sidebar accordion open sections
- branch tree expanded groups
- main changes explorer expanded groups
- working changes view mode
- commit changes view mode

Do not persist:
- search terms
- context menu state
- hover/open transient state
- temporary modal expansion/search state
- loading/error state
```

### Restore window bounds safely
Startup should load persisted bounds before applying the initial window size. Persisted bounds must still be clamped to the configured minimums. If maximized/fullscreen state is eventually persisted, restoration must respect that instead of forcing a base size.

## Proposed Store Shape

```ts
type ViewMode = "flat" | "tree";

type WindowState = {
  width: number;
  height: number;
  x?: number;
  y?: number;
};

type RepoWorkspaceState = {
  leftAccordionOpen: string[];
  branchTreeExpanded: Record<string, boolean>;
  mainChangesExpanded: Record<string, boolean>;
  workingChangesViewMode: ViewMode;
  commitChangesViewMode: ViewMode;
  leftPaneWidth?: number;
  commitDetailsWidth?: number;
};

type WorkspaceStore = {
  window: WindowState;
  repoStateByPath: Record<string, RepoWorkspaceState>;
};
```

## Architecture Sketch

```text
Tauri Store
├─ repo-tabs-storage
│  ├─ tabs
│  ├─ activeTabId
│  ├─ recentRepos
│  └─ favoriteRepos
└─ workspace-ui-storage
   ├─ window
   └─ repoStateByPath
      ├─ /repos/foo
      │  ├─ accordionOpen
      │  ├─ branchTreeExpanded
      │  ├─ mainChangesExpanded
      │  ├─ workingChangesViewMode
      │  ├─ commitChangesViewMode
      │  ├─ leftPaneWidth
      │  └─ commitDetailsWidth
      └─ /repos/bar
```

## Risks / Trade-offs

- **[Risk] Persistence schema grows quickly** → Mitigation: keep one dedicated workspace store with a narrow, durable-state-only contract.
- **[Risk] Window restore can fight min constraints** → Mitigation: clamp restored size to configured layout minimums before applying.
- **[Risk] Per-repo state grows stale for removed repos** → Mitigation: optionally prune on explicit repo removal later; not required for this change.
- **[Risk] Too much UI state becomes sticky** → Mitigation: explicitly keep searches, modals, and other transient states out of persistence.
