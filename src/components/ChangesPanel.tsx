import { core } from "@tauri-apps/api";
import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useRepoStore } from "../store/repo";
import { CommitDiff, CommitListItem } from "../types/git";

type ChangesPanelProps = {
  selectedCommit: CommitListItem | null;
};

const ChangesPanel: React.FC<ChangesPanelProps> = ({ selectedCommit }) => {
  const { t } = useTranslation();
  const repoPath = useRepoStore((s) => s.currentRepo);
  const [diff, setDiff] = useState<CommitDiff | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (selectedCommit && repoPath) {
      const fetchDiff = async () => {
        setLoading(true);
        setError(null);
        try {
          const res: CommitDiff = await core.invoke("get_commit_diff", {
            path: repoPath,
            sha: selectedCommit.sha,
          });
          setDiff(res);
        } catch (err) {
          setError(String(err));
        } finally {
          setLoading(false);
        }
      };
      fetchDiff();
    } else {
      setDiff(null);
    }
  }, [selectedCommit, repoPath]);

  if (!selectedCommit) {
    return (
      <div className="p-4 text-center text-zinc-500">
        Selecciona un commit para ver los cambios
      </div>
    );
  }

  return (
    <div className="p-4">
      <h2 className="text-lg font-bold mb-2">
        Commit: {selectedCommit.sha.substring(0, 7)}
      </h2>
      <p className="mb-4">{selectedCommit.message}</p>

      {loading && <p>Cargando cambios...</p>}
      {error && <p className="text-red-500">Error: {error}</p>}

      {diff && (
        <div>
          <h3 className="font-bold mb-2">
            Archivos cambiados ({diff.changes.length})
          </h3>
          <ul>
            {diff.changes.map((file, index) => (
              <li
                key={index}
                className="flex justify-between items-center p-1 hover:bg-zinc-800/50 rounded">
                <span>{file.path}</span>
                <div className="flex items-center gap-2">
                  <span className="text-green-500">+{file.insertions}</span>
                  <span className="text-red-500">-{file.deletions}</span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default ChangesPanel;
