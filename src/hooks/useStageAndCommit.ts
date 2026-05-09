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
  const stagedLines = useStagedLinesStore((s) => s.stagedLines);
  const clearAllStagedLines = useStagedLinesStore((s) => s.clearAllStagedLines);

  const commitStagedChanges = useCallback(
    async (repoPath: string, message: string, options: CommitOptions = {}) => {
      setLoading(true);
      setError(null);
      try {
        // 1. Collect staged files and lines
        const filesToStage: string[] = [];
        const partialStage: {
          filePath: string;
          hunks: { [hunkIdx: number]: number[] };
        }[] = [];
        for (const filePath in stagedLines) {
          const entry = stagedLines[filePath];
          if (entry.isNewFile) {
            filesToStage.push(filePath);
          } else {
            // If there are staged lines, stage them partially
            const hunks: { [hunkIdx: number]: number[] } = {};
            for (const hunkIdx in entry) {
              if (hunkIdx === "isNewFile") continue;
              const set = entry[hunkIdx];
              if (set && set.size > 0) {
                hunks[hunkIdx] = Array.from(set);
              }
            }
            if (Object.keys(hunks).length > 0) {
              partialStage.push({ filePath, hunks });
            }
          }
        }

        // 2. Run git add for empty new files
        for (const filePath of filesToStage) {
          console.log("git_add_file", { path: repoPath, filePath });
          await invoke("git_add_file", { path: repoPath, filePath });
        }

        // console.log("partialStage", partialStage);
        // 3. Partially stage lines when applicable
        for (const { filePath, hunks } of partialStage) {
          console.log(
            "git_stage_lines",
            JSON.stringify({ path: repoPath, filePath, hunks })
          );
          await invoke("git_stage_lines", { path: repoPath, filePath, hunks });
        }

        // 4. Run the commit
        await invoke("git_commit", {
          path: repoPath,
          message,
          amend: !!options.amend,
        });

        // 5. Push if requested
        if (options.push) {
          await invoke("git_push", { path: repoPath });
        }

        // 6. Clear staged lines
        clearAllStagedLines();
      } catch (e: any) {
        setError(e.toString());
        throw e;
      } finally {
        setLoading(false);
      }
    },
    [stagedLines, clearAllStagedLines]
  );

  return { commitStagedChanges, loading, error };
}
