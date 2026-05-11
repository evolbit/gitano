import React, { useEffect, useState } from "react";
import { useStageAndCommit } from "../../hooks/useStageAndCommit";

const FloatingCommitBar: React.FC<{
  expanded: boolean;
  onExpand: () => void;
  onCollapse: () => void;
  repoPath: string;
  onCommit?: (msg: string, push: boolean, amend: boolean) => void;
  loading?: boolean;
}> = ({ expanded, onExpand, onCollapse, repoPath, onCommit, loading }) => {
  const [message, setMessage] = useState("");
  const [push, setPush] = useState(true);
  const [amend, setAmend] = useState(false);
  const {
    commitStagedChanges,
    loading: commitLoading,
    error: commitError,
  } = useStageAndCommit();
  const [localLoading, setLocalLoading] = useState(false);
  const isLoading = loading || commitLoading || localLoading;

  // Close on Escape when expanded
  useEffect(() => {
    if (!expanded) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onCollapse();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [expanded, onCollapse]);

  const handleCommit = async () => {
    setLocalLoading(true);
    try {
      await commitStagedChanges(repoPath, message, { push, amend });
      setMessage("");
      setAmend(false);
      setPush(true);
      onCollapse();
      if (onCommit) onCommit(message, push, amend);
    } catch (e) {
      // The error is shown below
    } finally {
      setLocalLoading(false);
    }
  };

  return (
    <div
      className="absolute left-1/2 bottom-6 z-50 flex justify-center w-full pointer-events-none select-none"
      style={{ transform: "translateX(-50%)" }}>
      <div
        className={`group transition-all duration-300 pointer-events-auto shadow-2xl border-t border-border flex flex-col items-center w-[600px] max-w-full mb-0 ${
          expanded ? "rounded-t-xl" : "rounded-full"
        }`}
        style={{ minWidth: 320 }}>
        {!expanded ? (
          <div className="w-full h-full bg-background-emphasis/80 group-hover:bg-background-emphasis/100 rounded-full transition-colors duration-200 flex flex-col items-center justify-center">
            <button
              className="w-full h-14 flex items-center justify-center text-lg font-bold text-white bg-zinc-900/80 hover:bg-zinc-900/95 border border-zinc-700 rounded-full transition-colors"
              onClick={onExpand}
              style={{ pointerEvents: "auto" }}>
              Commit
            </button>
          </div>
        ) : (
          <div className="w-full h-full bg-background-emphasis/80 group-hover:bg-background-emphasis/100 rounded-t-xl transition-colors duration-200 flex flex-col items-center justify-center p-0">
            <div className="w-full flex flex-col p-4 gap-3">
              <div className="flex items-center justify-between mb-2 w-full">
                <span className="font-semibold text-base text-white truncate">
                  Commit changes
                </span>
                <button
                  className="text-xs text-zinc-400 hover:text-zinc-200 px-2 py-1 rounded"
                  onClick={onCollapse}
                  style={{ pointerEvents: "auto" }}>
                  Collapse
                </button>
              </div>
              <textarea
                className="w-full h-16 rounded bg-zinc-900 border border-zinc-700 text-white p-2 resize-none"
                placeholder="Commit message..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                disabled={isLoading}
              />
              <div className="flex flex-wrap items-center gap-4 mt-2 w-full">
                <label className="flex items-center gap-2 text-sm text-zinc-300">
                  <input
                    type="checkbox"
                    checked={push}
                    onChange={(e) => setPush(e.target.checked)}
                    disabled={isLoading}
                  />
                  Push changes immediately to origin/main
                </label>
                <label className="flex items-center gap-2 text-sm text-zinc-300">
                  <input
                    type="checkbox"
                    checked={amend}
                    onChange={(e) => setAmend(e.target.checked)}
                    disabled={isLoading}
                  />
                  Amend last commit
                </label>
              </div>
              <div className="flex justify-end gap-2 mt-2 w-full">
                <button
                  className="px-4 py-1 rounded bg-zinc-700 text-zinc-200 hover:bg-zinc-600"
                  onClick={onCollapse}
                  disabled={isLoading}>
                  Cancel
                </button>
                <button
                  className="px-4 py-1 rounded bg-zinc-900/80 text-white font-bold hover:bg-zinc-900/95 border border-zinc-700 disabled:opacity-50"
                  onClick={handleCommit}
                  disabled={isLoading || !message.trim()}>
                  Commit
                </button>
              </div>
              {commitError && (
                <div className="text-red-500 text-center p-2">
                  {commitError}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default FloatingCommitBar;
