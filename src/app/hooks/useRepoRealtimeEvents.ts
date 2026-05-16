import { useEffect, useMemo, useRef } from "react";
import {
  RepoChangeKind,
  RepoChangedEventPayload,
  syncRepoWatchers,
} from "@/shared/api/git/realtime";
import { APP_EVENTS } from "@/shared/config/events";
import { listenToEvent } from "@/shared/platform/tauri/events";
import { useRepoStore } from "@/features/repository-workspace/stores/repoStore";

const DEDUPE_WINDOW_MS = 150;

function dispatchEvent(name: string) {
  window.dispatchEvent(new CustomEvent(name));
}

export function useRepoRealtimeEvents() {
  const tabs = useRepoStore((state) => state.tabs);

  const repoPaths = useMemo(() => {
    const unique = new Set(
      tabs
        .map((tab) => tab.repoPath)
        .filter((repoPath) => repoPath && repoPath.length > 0),
    );
    return Array.from(unique).sort();
  }, [tabs]);

  const repoPathsRef = useRef<Set<string>>(new Set(repoPaths));
  const dedupeRef = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    repoPathsRef.current = new Set(repoPaths);
  }, [repoPaths]);

  useEffect(() => {
    let isCancelled = false;

    const syncWatchers = async () => {
      try {
        await syncRepoWatchers(repoPaths);
      } catch (error) {
        if (!isCancelled) {
          console.error("Failed to sync repository watchers", error);
        }
      }
    };

    void syncWatchers();

    return () => {
      isCancelled = true;
    };
  }, [repoPaths]);

  useEffect(() => {
    const unlistenPromise = listenToEvent<RepoChangedEventPayload>(
      APP_EVENTS.repoChanged,
      ({ payload }) => {
        const { repoPath, kinds } = payload;

        if (!repoPathsRef.current.has(repoPath)) {
          return;
        }

        const now = Date.now();
        const acceptedKinds = new Set<RepoChangeKind>();

        for (const kind of kinds) {
          const dedupeKey = `${repoPath}:${kind}`;
          const previousTimestamp = dedupeRef.current.get(dedupeKey) ?? 0;
          if (now - previousTimestamp < DEDUPE_WINDOW_MS) {
            continue;
          }

          dedupeRef.current.set(dedupeKey, now);
          acceptedKinds.add(kind);
        }

        if (acceptedKinds.size === 0) {
          return;
        }

        if (acceptedKinds.has("working-tree") || acceptedKinds.has("index")) {
          dispatchEvent(APP_EVENTS.workingChangesRefresh);
        }

        if (acceptedKinds.has("stashes")) {
          dispatchEvent(APP_EVENTS.stashesRefresh);
        }

        if (acceptedKinds.has("head") || acceptedKinds.has("branches")) {
          dispatchEvent(APP_EVENTS.commitsRefresh);
        }

        if (
          acceptedKinds.has("head") ||
          acceptedKinds.has("branches") ||
          acceptedKinds.has("tags") ||
          acceptedKinds.has("remote-refs") ||
          acceptedKinds.has("config")
        ) {
          dispatchEvent(APP_EVENTS.repoRefsRefresh);
        }
      },
    );

    return () => {
      unlistenPromise
        .then((unlisten) => unlisten())
        .catch((error) => {
          console.error("Failed to remove repo-changed listener", error);
        });
    };
  }, []);
}
