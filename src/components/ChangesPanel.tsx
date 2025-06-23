import { Split } from "@gfazioli/mantine-split-pane";
import { core } from "@tauri-apps/api";
import React, { useEffect, useRef, useState } from "react";
import { useRepoStore } from "../store/repo";
import { CommitDiff, CommitListItem } from "../types/git";
import FileListItem from "./FileListItem";
import TextArea from "./form/TextArea";

type ChangesPanelProps = {
  selectedCommit: CommitListItem | null;
};

const ChangesPanel: React.FC<ChangesPanelProps> = ({ selectedCommit }) => {
  const repoPath = useRepoStore((s) => s.currentRepo);
  const [diff, setDiff] = useState<CommitDiff | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [isAmending, setIsAmending] = useState(false);
  const [message, setMessage] = useState("");
  const textAreaRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (selectedCommit) {
      setMessage(selectedCommit.message);
    } else {
      setMessage("");
    }
    // When commit changes, exit amending mode
    setIsAmending(false);
  }, [selectedCommit]);

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

  const handleCancelAmend = () => {
    setIsAmending(false);
    if (selectedCommit) {
      setMessage(selectedCommit.message);
    }
    if (textAreaRef.current) {
      textAreaRef.current.blur();
    }
  };

  const handleStartAmend = () => {
    setIsAmending(true);
  };

  useEffect(() => {
    if (isAmending) {
      textAreaRef.current?.focus();
      textAreaRef.current?.select();
    }
  }, [isAmending]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        handleCancelAmend();
      }
    };

    if (isAmending) {
      document.addEventListener("mousedown", handleClickOutside);
    } else {
      document.removeEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isAmending]);

  const handleUpdateMessage = async () => {
    if (!repoPath || !selectedCommit) return;
    // Potentially show a loader inside the button
    try {
      await core.invoke("amend_commit_message", {
        path: repoPath,
        sha: selectedCommit.sha,
        newMessage: message,
      });
      // Refresh commit list after amending
      // This part depends on how you fetch commits.
      // For now, just exit amending mode.
      setIsAmending(false);
      // You might want to update the selectedCommit message in the parent component
    } catch (err) {
      console.error(err);
      // Show error to user
    }
  };

  if (!selectedCommit) {
    return (
      <div className="p-4 text-center text-muted-foreground h-full flex items-center justify-center">
        Selecciona un commit para ver los cambios
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="bg-background h-full flex flex-col text-sm">
      <Split
        orientation="horizontal"
        className="h-full w-full border-none">
        <Split.Pane initialWidth="50%">
          <div className="p-4 h-full w-full flex flex-col">
            <div className="mb-4">
              <p>
                Commit:{" "}
                <span className="font-mono text-blue-400">
                  {selectedCommit.sha.substring(0, 7)}
                </span>
              </p>
            </div>

            <div className="flex-grow flex flex-col">
              <TextArea
                ref={textAreaRef}
                className={`flex-grow mb-2 ${
                  isAmending
                    ? "cursor-text"
                    : "border-transparent cursor-default"
                }`}
                value={message}
                onFocus={handleStartAmend}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                  setMessage(e.target.value)
                }
                readOnly={!isAmending}
                rows={4}
              />
              {isAmending && (
                <div className="flex justify-start space-x-2">
                  <button
                    onClick={handleUpdateMessage}
                    className="bg-green-600 hover:bg-green-700 text-primary-foreground font-bold py-1 px-3 rounded text-sm">
                    Update Message
                  </button>
                  <button
                    onClick={handleCancelAmend}
                    className="bg-red-600 hover:bg-red-700 text-primary-foreground font-bold py-1 px-3 rounded text-sm">
                    Cancel Amend
                  </button>
                </div>
              )}
            </div>
          </div>
        </Split.Pane>
        <Split.Resizer className="!bg-border hover:!bg-primary [--split-resizer-size:1px]" />
        <Split.Pane grow>
          <div className="p-4 h-full w-full overflow-auto">
            {loading && <p>Cargando cambios...</p>}
            {error && <p className="text-red-500">Error: {error}</p>}

            {diff && (
              <div>
                <h3 className="font-bold mb-2">
                  Archivos cambiados ({diff.changes.length})
                </h3>
                <ul className="text-sm">
                  {diff.changes.map((file) => (
                    <FileListItem
                      key={file.path}
                      file={file}
                    />
                  ))}
                </ul>
              </div>
            )}
          </div>
        </Split.Pane>
      </Split>
    </div>
  );
};

export default ChangesPanel;
