import {
  startTransition,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { getWorkingDirectoryChanges } from "@/shared/api/git/staging";
import { useStagedLinesStore } from "@/features/working-changes/stores/staging-store";
import type { FileChangeWithHunks } from "@/shared/types/git";
import {
  buildWorkingChangesFileSnapshotSignature,
  buildWorkingChangesStagedSnapshotSignature,
  mergeWorkingChangesPreservingIdentity,
} from "../utils/working-changes-snapshot";

interface UseWorkingDirectoryChangesOptions {
  pollInterval?: number; // Polling interval in milliseconds
  enabled?: boolean; // Whether polling is enabled
  pauseOnInactive?: boolean; // (Unused)
  cacheKey?: string; // Unique key for caching results
  showNotifications?: boolean; // (Unused)
}

type StagedLinesStoreState = ReturnType<
  typeof useStagedLinesStore.getState
>["stagedLines"];

export const useWorkingDirectoryChanges = (
  repoPath: string | undefined,
  options: UseWorkingDirectoryChangesOptions = {},
) => {
  const { pollInterval = 0, enabled = true } = options;

  const [changes, setChanges] = useState<FileChangeWithHunks[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isMountedRef = useRef(true);
  const lastFileSnapshotSignatureRef = useRef<string | null>(null);
  const lastStagedSnapshotSignatureRef = useRef<string | null>(null);
  const lastChangesRef = useRef<FileChangeWithHunks[]>([]);
  const hasLoadedOnceRef = useRef(false);

  // Ensure isMountedRef.current is true on mount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  // Function to fetch changes and hunks
  const fetchChanges = useCallback(async () => {
    if (!repoPath) return;
    const shouldToggleLoading = !hasLoadedOnceRef.current;
    if (shouldToggleLoading) {
      setLoading(true);
    }
    setError(null);
    try {
      const response = await getWorkingDirectoryChanges(repoPath);
      const { changes: result } = response;

      const nextFileSnapshotSignature =
        buildWorkingChangesFileSnapshotSignature(result);

      const nextStagedSnapshotSignature =
        buildWorkingChangesStagedSnapshotSignature(
          response.staged_state_by_file,
        );

      const fileSnapshotChanged =
        nextFileSnapshotSignature !== lastFileSnapshotSignatureRef.current;

      const stagedSnapshotChanged =
        nextStagedSnapshotSignature !== lastStagedSnapshotSignatureRef.current;

      if (isMountedRef.current && fileSnapshotChanged) {
        const mergedChanges = mergeWorkingChangesPreservingIdentity(
          lastChangesRef.current,
          result,
        );
        lastFileSnapshotSignatureRef.current = nextFileSnapshotSignature;
        lastChangesRef.current = mergedChanges;
        startTransition(() => {
          setChanges(mergedChanges);
        });
      }

      if (
        isMountedRef.current &&
        (fileSnapshotChanged || stagedSnapshotChanged)
      ) {
        lastStagedSnapshotSignatureRef.current = nextStagedSnapshotSignature;
        const nextStagedState = Object.fromEntries(
          Object.entries(response.staged_state_by_file).map(
            ([filePath, stagedState]) => {
              const next: StagedLinesStoreState[string] = {};

              if (stagedState.isNewFile) {
                next.isNewFile = true;
              }

              if (stagedState.isWholeFileStaged) {
                next.isWholeFileStaged = true;
              }

              Object.entries(stagedState.hunks).forEach(([hunkIdx, lineIdxs]) => {
                next[Number(hunkIdx)] = new Set(lineIdxs);
              });

              return [filePath, next];
            },
          ),
        ) as StagedLinesStoreState;

        startTransition(() => {
          useStagedLinesStore.getState().replaceStagedLines(nextStagedState);
        });
      }

      if (isMountedRef.current) {
        hasLoadedOnceRef.current = true;
        setHasLoadedOnce(true);
      }
    } catch (err) {
      if (isMountedRef.current) {
        setError(String(err));
        setChanges([]);
        lastChangesRef.current = [];
        lastFileSnapshotSignatureRef.current = null;
        lastStagedSnapshotSignatureRef.current = null;
        hasLoadedOnceRef.current = false;
        setHasLoadedOnce(true);
      }
    } finally {
      if (isMountedRef.current && shouldToggleLoading) {
        setLoading(false);
      }
    }
  }, [repoPath]);

  // Automatic polling
  useEffect(() => {
    if (!repoPath || !enabled) {
      setChanges([]);
      setError(null);
      setLoading(false);
      lastChangesRef.current = [];
      lastFileSnapshotSignatureRef.current = null;
      lastStagedSnapshotSignatureRef.current = null;
      hasLoadedOnceRef.current = false;
      setHasLoadedOnce(false);
      return;
    }
    fetchChanges(); // Initial load
    if (pollInterval > 0) {
      intervalRef.current = setInterval(fetchChanges, pollInterval);
    }
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [repoPath, enabled, pollInterval, fetchChanges]);

  return {
    changes,
    loading,
    error,
    hasLoadedOnce,
    refreshChanges: fetchChanges,
  };
};
