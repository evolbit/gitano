import { Split } from "@gfazioli/mantine-split-pane";
import React, { useEffect, useRef, useState } from "react";
import {
  amendCommitMessage,
  getCommitDiff,
} from "@/shared/api/git/commits";
import { useRepoStore } from "@/features/repository-workspace";
import {
  DEFAULT_REPO_WORKSPACE_STATE,
  useWorkspaceUiStore,
} from "@/features/repository-workspace";
import { ChangesExplorer } from "@/features/working-changes";
import TextArea from "@/shared/components/form/text-area/text-area";
import type { CommitDiff, FileChange } from "@/shared/types/git";

type ChangesPanelProps = {
  selectedCommitDiffPath?: string | null;
  onSelectCommitFile?: (file: FileChange) => void;
};

const ChangesPanel: React.FC<ChangesPanelProps> = ({
  selectedCommitDiffPath = null,
  onSelectCommitFile,
}) => {
  const activeTabId = useRepoStore((s) => s.activeTabId);
  const tab = useRepoStore((s) => s.tabs.find((t) => t.id === activeTabId));
  const selectedCommit = tab?.selectedCommit;
  const selectedCommitSha = selectedCommit?.sha ?? null;
  const repoPath = tab?.repoPath;
  const commitChangesViewMode = useWorkspaceUiStore((s) =>
    repoPath
      ? (s.repoStateByPath[repoPath] ?? DEFAULT_REPO_WORKSPACE_STATE)
          .commitChangesViewMode
      : DEFAULT_REPO_WORKSPACE_STATE.commitChangesViewMode,
  );
  const setCommitChangesViewMode = useWorkspaceUiStore(
    (s) => s.setCommitChangesViewMode,
  );
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
    // When commit changes, exit amending mode s
    setIsAmending(false);
  }, [selectedCommit]);

  useEffect(() => {
    if (selectedCommitSha && repoPath) {
      const fetchDiff = async () => {
        setLoading(true);
        setError(null);
        try {
          const res = await getCommitDiff(repoPath, selectedCommitSha);
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
  }, [selectedCommitSha, repoPath]);

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
      await amendCommitMessage(repoPath, selectedCommit.sha, message);
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

  const handleSelectCommitFile = (file: FileChange) => {
    onSelectCommitFile?.(file);
  };

  if (!selectedCommit) {
    return (
      <div className="p-4 text-center text-muted-foreground h-full flex items-center justify-center">
        Select a commit to view its changes
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="bg-background h-full flex flex-col text-sm"
    >
      <Split orientation="horizontal" className="h-full w-full border-none">
        <Split.Pane initialWidth="50%" className="border-b border-border">
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
                    className="bg-green-600 hover:bg-green-700 text-primary-foreground font-bold py-1 px-3 rounded text-sm"
                  >
                    Update Message
                  </button>
                  <button
                    onClick={handleCancelAmend}
                    className="bg-red-600 hover:bg-red-700 text-primary-foreground font-bold py-1 px-3 rounded text-sm"
                  >
                    Cancel Amend
                  </button>
                </div>
              )}
            </div>
          </div>
        </Split.Pane>
        <Split.Resizer className="!bg-transparent hover:!bg-primary [--split-resizer-size:1px] !-mt-[2px]" />
        <Split.Pane grow className="-mt-[3px]">
          <div className="h-full w-full overflow-hidden">
            {loading && <p>Loading changes...</p>}
            {error && <p className="text-red-500">Error: {error}</p>}

            {diff && (
              <div className="h-full min-h-0">
                <ChangesExplorer
                  files={diff.changes}
                  selectedPath={
                    selectedCommitDiffPath ?? diff.changes[0]?.path ?? null
                  }
                  onSelectFile={(file) =>
                    handleSelectCommitFile(file as FileChange)
                  }
                  viewMode={commitChangesViewMode}
                  onViewModeChange={(mode) => {
                    if (!repoPath) return;
                    setCommitChangesViewMode(repoPath, mode);
                  }}
                  showFileCheckboxes={false}
                  surface="main"
                  className="border-r-0"
                  sectionMode="single"
                />
              </div>
            )}
          </div>
        </Split.Pane>
      </Split>
    </div>
  );
};

export default ChangesPanel;
