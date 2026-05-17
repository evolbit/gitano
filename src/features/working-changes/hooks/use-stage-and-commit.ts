import { useCallback, useState } from "react";
import {
  commitStagedChanges as commitStagedChangesApi,
  hasStagedChanges,
  pushRepository,
} from "@/shared/api/git/staging";
import { useStagedLinesStore } from "@/features/working-changes/stores/staging-store";

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
        const hasChangesToCommit = await hasStagedChanges(repoPath);

        if (!hasChangesToCommit) {
          throw new Error("There are no staged changes to commit.");
        }

        await commitStagedChangesApi(repoPath, message, !!options.amend);

        if (options.push) {
          await pushRepository(repoPath);
        }

        clearAllStagedLines();
      } catch (e: any) {
        setError(e.toString());
        throw e;
      } finally {
        setLoading(false);
      }
    },
    [clearAllStagedLines],
  );

  return { commitStagedChanges, loading, error };
}
