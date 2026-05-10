import { invoke } from "@tauri-apps/api/core";
import { useCallback, useState } from "react";
import { useStagedLinesStore } from "../store/staging";

interface CommitOptions {
  push?: boolean;
  amend?: boolean;
}

export function useStageAndCommit() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const clearAllStagedLines = useStagedLinesStore((s) => s.clearAllStagedLines);

  const commitStagedChanges = useCallback(
    async (repoPath: string, message: string, options: CommitOptions = {}) => {
      setLoading(true);
      setError(null);
      try {
        const hasStagedChanges = await invoke<boolean>("git_has_staged_changes", {
          path: repoPath,
        });

        if (!hasStagedChanges) {
          throw new Error("There are no staged changes to commit.");
        }

        await invoke("git_commit", {
          path: repoPath,
          message,
          amend: !!options.amend,
        });

        if (options.push) {
          await invoke("git_push", { path: repoPath });
        }

        clearAllStagedLines();
      } catch (e: any) {
        setError(e.toString());
        throw e;
      } finally {
        setLoading(false);
      }
    },
    [clearAllStagedLines]
  );

  return { commitStagedChanges, loading, error };
}
