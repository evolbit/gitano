import {
  startTransition,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  getWorkingDirectorySummary,
  getWorkingFileDetail,
} from "@/shared/api/git/staging";
import { getMergeConflicts } from "@/shared/api/git/conflicts";
import { useStagedLinesStore } from "@/features/working-changes/stores/staging-store";
import type {
  StagedFileSelectionState,
  WorkingFileDetailResponse,
} from "@/shared/types/git";
import { buildWorkingChangesStagedSnapshotSignature } from "../utils/working-changes-snapshot";
import {
  mergeWorkingChangeSummaries,
  type WorkingChangeSummaryFile,
} from "../utils/working-conflict-summary";

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

export type WorkingFileDetailLoadState =
  | {
      status: "idle";
    }
  | {
      status: "loading";
    }
  | {
      status: "ready";
      detail: WorkingFileDetailResponse;
    }
  | {
      status: "error";
      error: string;
    };

type WorkingFileDetailByPath = Record<string, WorkingFileDetailLoadState>;

type WorkingDirectorySummaryState = {
  changes: WorkingChangeSummaryFile[];
  staged_state_by_file: Record<string, StagedFileSelectionState>;
};

function buildSummarySnapshotSignature(files: WorkingChangeSummaryFile[]) {
  return files
    .map((file) =>
      [
        file.path,
        file.status,
        file.insertions,
        file.deletions,
        file.isUntracked ? 1 : 0,
        file.fileSignature,
      ].join("|"),
    )
    .join("||");
}

function mergeSummariesPreservingIdentity(
  previous: WorkingChangeSummaryFile[],
  next: WorkingChangeSummaryFile[],
) {
  if (previous.length === 0) return next;

  const previousByPath = new Map(
    previous.map((file) => [file.path, file] as const),
  );
  const previousSignatureByPath = new Map(
    previous.map((file) => [file.path, file.fileSignature]),
  );

  const merged = next.map((file) => {
    const previousSignature = previousSignatureByPath.get(file.path);
    if (!previousSignature || previousSignature !== file.fileSignature) {
      return file;
    }

    return previousByPath.get(file.path) ?? file;
  });

  const unchanged =
    previous.length === merged.length &&
    previous.every((file, index) => file === merged[index]);

  return unchanged ? previous : merged;
}

function stagedStateToStoreEntry(stagedState: StagedFileSelectionState) {
  const next: StagedLinesStoreState[string] = {};

  if (stagedState.isNewFile) {
    next.isNewFile = true;
  }

  if (stagedState.isWholeFileStaged) {
    next.isWholeFileStaged = true;
  }

  if (stagedState.isPartiallyStaged) {
    next.isPartiallyStaged = true;
  }

  Object.entries(stagedState.hunks).forEach(([hunkIdx, lineIdxs]) => {
    next[Number(hunkIdx)] = new Set(lineIdxs);
  });

  return next;
}

function stagedStateByFileToStoreState(
  stagedStateByFile: Record<string, StagedFileSelectionState>,
) {
  return Object.fromEntries(
    Object.entries(stagedStateByFile).map(([filePath, stagedState]) => [
      filePath,
      stagedStateToStoreEntry(stagedState),
    ]),
  ) as StagedLinesStoreState;
}

export const useWorkingDirectoryChanges = (
  repoPath: string | undefined,
  options: UseWorkingDirectoryChangesOptions = {},
) => {
  const { pollInterval = 0, enabled = true } = options;

  const [changes, setChanges] = useState<WorkingChangeSummaryFile[]>([]);
  const [fileDetails, setFileDetails] = useState<WorkingFileDetailByPath>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isMountedRef = useRef(true);
  const lastFileSnapshotSignatureRef = useRef<string | null>(null);
  const lastStagedSnapshotSignatureRef = useRef<string | null>(null);
  const lastChangesRef = useRef<WorkingChangeSummaryFile[]>([]);
  const hasLoadedOnceRef = useRef(false);
  const summaryInFlightRef = useRef<Promise<void> | null>(null);
  const summaryRerunRequestedRef = useRef(false);
  const summaryRequestIdRef = useRef(0);
  const detailRequestIdByPathRef = useRef<Record<string, number>>({});

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

  // Function to apply lightweight summary results.
  const applySummaryResponse = useCallback((response: WorkingDirectorySummaryState) => {
    const { changes: result } = response;

    const nextFileSnapshotSignature = buildSummarySnapshotSignature(result);

    const nextStagedSnapshotSignature =
      buildWorkingChangesStagedSnapshotSignature(response.staged_state_by_file);

    const fileSnapshotChanged =
      nextFileSnapshotSignature !== lastFileSnapshotSignatureRef.current;

    const stagedSnapshotChanged =
      nextStagedSnapshotSignature !== lastStagedSnapshotSignatureRef.current;

    if (fileSnapshotChanged) {
      const mergedChanges = mergeSummariesPreservingIdentity(
        lastChangesRef.current,
        result,
      );
      const signaturesByPath = new Map(
        mergedChanges.map((file) => [file.path, file.fileSignature] as const),
      );

      lastFileSnapshotSignatureRef.current = nextFileSnapshotSignature;
      lastChangesRef.current = mergedChanges;
      startTransition(() => {
        setChanges(mergedChanges);
        setFileDetails((currentDetails) => {
          const nextDetails: WorkingFileDetailByPath = {};

          Object.entries(currentDetails).forEach(([filePath, detailState]) => {
            if (detailState.status !== "ready") {
              nextDetails[filePath] = detailState;
              return;
            }

            if (
              detailState.detail.fileSignature === signaturesByPath.get(filePath)
            ) {
              nextDetails[filePath] = detailState;
            }
          });

          return nextDetails;
        });
      });
    }

    if (fileSnapshotChanged || stagedSnapshotChanged) {
      lastStagedSnapshotSignatureRef.current = nextStagedSnapshotSignature;
      const nextStagedState = stagedStateByFileToStoreState(
        response.staged_state_by_file,
      );

      startTransition(() => {
        useStagedLinesStore.getState().replaceStagedLines(nextStagedState);
      });
    }

    hasLoadedOnceRef.current = true;
    setHasLoadedOnce(true);
  }, []);

  const fetchChanges = useCallback(async () => {
    if (!repoPath) return;

    if (summaryInFlightRef.current) {
      summaryRerunRequestedRef.current = true;
      return summaryInFlightRef.current;
    }

    const runSummaryRefresh = async (): Promise<void> => {
      do {
        summaryRerunRequestedRef.current = false;
        const shouldToggleLoading = !hasLoadedOnceRef.current;
        const requestId = summaryRequestIdRef.current + 1;
        summaryRequestIdRef.current = requestId;

        if (shouldToggleLoading) {
          setLoading(true);
        }
        setError(null);

        try {
          const [workingSummary, conflicts] = await Promise.all([
            getWorkingDirectorySummary(repoPath),
            getMergeConflicts(repoPath),
          ]);

          if (!isMountedRef.current || requestId !== summaryRequestIdRef.current) {
            continue;
          }

          applySummaryResponse({
            ...workingSummary,
            changes: mergeWorkingChangeSummaries(
              workingSummary.changes,
              conflicts,
            ),
          });
        } catch (err) {
          if (isMountedRef.current && requestId === summaryRequestIdRef.current) {
            setError(String(err));
            setChanges([]);
            setFileDetails({});
            lastChangesRef.current = [];
            lastFileSnapshotSignatureRef.current = null;
            lastStagedSnapshotSignatureRef.current = null;
            hasLoadedOnceRef.current = false;
            setHasLoadedOnce(true);
          }
        } finally {
          if (
            isMountedRef.current &&
            requestId === summaryRequestIdRef.current &&
            shouldToggleLoading
          ) {
            setLoading(false);
          }
        }
      } while (isMountedRef.current && summaryRerunRequestedRef.current);
    };

    const inFlight = runSummaryRefresh().finally(() => {
      if (summaryInFlightRef.current === inFlight) {
        summaryInFlightRef.current = null;
      }
    });

    summaryInFlightRef.current = inFlight;
    return inFlight;
  }, [applySummaryResponse, repoPath]);

  const loadFileDetail = useCallback(
    async (filePath: string) => {
      if (!repoPath) return null;

      const requestId = (detailRequestIdByPathRef.current[filePath] ?? 0) + 1;
      detailRequestIdByPathRef.current[filePath] = requestId;

      setFileDetails((currentDetails) => ({
        ...currentDetails,
        [filePath]: { status: "loading" },
      }));

      try {
        const detail = await getWorkingFileDetail(repoPath, filePath);

        if (
          !isMountedRef.current ||
          detailRequestIdByPathRef.current[filePath] !== requestId
        ) {
          return null;
        }

        setFileDetails((currentDetails) => ({
          ...currentDetails,
          [filePath]: { status: "ready", detail },
        }));

        const stagedStore = useStagedLinesStore.getState();
        if (detail.stagedState) {
          useStagedLinesStore.setState((state) => ({
            stagedLines: {
              ...state.stagedLines,
              [filePath]: stagedStateToStoreEntry(detail.stagedState!),
            },
          }));
        } else {
          stagedStore.clearStagedLinesForFile(filePath);
        }

        return detail;
      } catch (err) {
        const errorMessage = String(err);
        if (
          isMountedRef.current &&
          detailRequestIdByPathRef.current[filePath] === requestId
        ) {
          setFileDetails((currentDetails) => ({
            ...currentDetails,
            [filePath]: { status: "error", error: errorMessage },
          }));
        }
        return null;
      }
    },
    [repoPath],
  );

  // Automatic polling
  useEffect(() => {
    if (!repoPath || !enabled) {
      summaryRequestIdRef.current += 1;
      detailRequestIdByPathRef.current = {};
      setChanges([]);
      setFileDetails({});
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
    fileDetails,
    loading,
    error,
    hasLoadedOnce,
    refreshChanges: fetchChanges,
    loadFileDetail,
  };
};
