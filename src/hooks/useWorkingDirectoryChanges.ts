import { core } from "@tauri-apps/api";
import { useEffect, useState } from "react";
import { FileChange } from "../types/git";

export const useWorkingDirectoryChanges = (repoPath: string | undefined) => {
  const [changes, setChanges] = useState<FileChange[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!repoPath) {
      setChanges([]);
      return;
    }

    const fetchChanges = async () => {
      setLoading(true);
      setError(null);
      try {
        const result: FileChange[] = await core.invoke(
          "get_working_directory_changes",
          {
            path: repoPath,
          }
        );
        setChanges(result);
      } catch (err) {
        setError(String(err));
        setChanges([]);
      } finally {
        setLoading(false);
      }
    };

    fetchChanges();
  }, [repoPath]);

  return { changes, loading, error };
};
