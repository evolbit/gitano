import { core } from "@tauri-apps/api";
import { useCallback, useEffect, useRef, useState } from "react";
import { FileChangeWithHunks } from "../types/git";

interface UseWorkingDirectoryChangesOptions {
  pollInterval?: number; // Polling interval in milliseconds
  enabled?: boolean; // Whether polling is enabled
  pauseOnInactive?: boolean; // (Unused)
  cacheKey?: string; // Unique key for caching results
  showNotifications?: boolean; // (Unused)
}

export const useWorkingDirectoryChanges = (
  repoPath: string | undefined,
  options: UseWorkingDirectoryChangesOptions = {}
) => {
  const { pollInterval = 2000, enabled = true } = options;

  const [changes, setChanges] = useState<FileChangeWithHunks[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isMountedRef = useRef(true);

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
    setLoading(true);
    setError(null);
    try {
      const result: FileChangeWithHunks[] = await core.invoke(
        "get_working_directory_changes",
        {
          path: repoPath,
        }
      );
      if (isMountedRef.current) {
        setChanges(result);
      }
    } catch (err) {
      if (isMountedRef.current) {
        setError(String(err));
        setChanges([]);
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [repoPath]);

  // Automatic polling
  useEffect(() => {
    if (!repoPath || !enabled) {
      setChanges([]);
      return;
    }
    fetchChanges(); // Initial load
    intervalRef.current = setInterval(fetchChanges, pollInterval);
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
  };
};
