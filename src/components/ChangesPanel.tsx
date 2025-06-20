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
  const [editingMessage, setEditingMessage] = useState("");

  useEffect(() => {
    if (selectedCommit) {
      setEditingMessage(selectedCommit.message);
      if (repoPath) {
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
      }
    } else {
      setDiff(null);
      setEditingMessage("");
    }
  }, [selectedCommit, repoPath]);

  if (!selectedCommit) {
    return (
      <div className="p-4 text-center text-zinc-500">
        Selecciona un commit para ver los cambios
      </div>
    );
  }

  const handleUpdateMessage = async () => {
    if (!repoPath || !selectedCommit) return;
    setLoading(true);
    setError(null);
    try {
      await core.invoke("amend_commit_message", {
        path: repoPath,
        sha: selectedCommit.sha,
        newMessage: editingMessage,
      });
      // Optionally, refresh data or show success message
      alert("Commit message updated successfully!");
    } catch (err) {
      setError(String(err));
      alert(`Error updating commit message: ${String(err)}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4">
      <h2 className="text-lg font-bold mb-2">
        Commit: {selectedCommit.sha.substring(0, 7)}
      </h2>
      <textarea
        value={editingMessage}
        onChange={(e) => setEditingMessage(e.target.value)}
        className="w-full bg-zinc-800 border border-zinc-600 rounded-md p-2 mb-2 text-white"
        rows={4}
      />
      <div className="flex gap-2 mb-4">
        <button
          onClick={handleUpdateMessage}
          className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded">
          Update Message
        </button>
        <button
          onClick={() => setEditingMessage(selectedCommit.message)}
          className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded">
          Cancel Amend
        </button>
      </div>

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
