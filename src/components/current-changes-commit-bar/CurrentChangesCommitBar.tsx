import { useState } from "react";
import { core } from "@tauri-apps/api";
import { useStageAndCommit } from "../../hooks/useStageAndCommit";
import { IconChevronDown } from "../icons";
import { useRemoteActionsStore } from "../../store/remoteActions";
import { useRepoStore } from "../../store/repo";
import { APP_EVENTS } from "../../constants/events";

type CurrentChangesCommitBarProps = {
  repoPath: string;
  onCommitted?: () => void;
};

export default function CurrentChangesCommitBar({
  repoPath,
  onCommitted,
}: CurrentChangesCommitBarProps) {
  const [message, setMessage] = useState("");
  const [push, setPush] = useState(false);
  const [amend, setAmend] = useState(false);
  const [showCommitMenu, setShowCommitMenu] = useState(false);
  const { commitStagedChanges, loading, error } = useStageAndCommit();
  const setRemoteActionPending = useRemoteActionsStore((s) => s.setPending);
  const setRemoteNotice = useRemoteActionsStore((s) => s.setNotice);
  const activeTabId = useRepoStore((s) => s.activeTabId);
  const selectedBranch = useRepoStore((s) =>
    s.tabs.find((t) => t.id === activeTabId)?.selectedBranch ?? null,
  );

  const notifyCommitRefresh = () => {
    window.dispatchEvent(new CustomEvent(APP_EVENTS.commitsRefresh));
  };

  const handlePushSuccess = () => {
    setRemoteNotice({
      kind: "success",
      title: "git push succeeded",
      details: selectedBranch
        ? `Pushed the current branch to origin/${selectedBranch}.`
        : "Pushed the current branch successfully.",
      expanded: false,
    });
  };

  const handlePushError = (pushError: unknown) => {
    const details =
      pushError instanceof Error
        ? pushError.message
        : String(pushError || "Unknown error");

    setRemoteNotice({
      kind: "error",
      title: "git push failed",
      details,
      expanded: false,
    });
  };

  const handleCommit = async (pushOverride?: boolean) => {
    if (!message.trim() || loading) return;

    try {
      await commitStagedChanges(repoPath, message, {
        push: false,
        amend,
      });
      notifyCommitRefresh();

      if (pushOverride ?? push) {
        setRemoteActionPending("push");
        await new Promise<void>((resolve) => {
          requestAnimationFrame(() => {
            requestAnimationFrame(() => resolve());
          });
        });
        try {
          await core.invoke("git_push", { path: repoPath });
          handlePushSuccess();
          notifyCommitRefresh();
        } catch (pushError) {
          handlePushError(pushError);
        } finally {
          setRemoteActionPending(null);
        }
      }

      setMessage("");
      setShowCommitMenu(false);
      onCommitted?.();
    } catch {
      // Error is surfaced by useStageAndCommit.
    }
  };

  return (
    <div className="border-t border-border bg-background-emphasis px-2 pb-2 pt-1.5">
      <div className="flex flex-col gap-1.5">
        <textarea
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          placeholder="Enter commit message"
          className="h-20 w-full resize-none rounded border border-border bg-background px-2 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
          disabled={loading}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              if (event.shiftKey) {
                void handleCommit(true);
                return;
              }
              void handleCommit();
            }
          }}
        />
        <div className="flex h-8 items-center justify-between gap-2">
          <div className="flex h-8 items-center gap-3 text-xs text-zinc-300">
            <label className="inline-flex h-8 items-center gap-1.5">
              <input
                type="checkbox"
                checked={push}
                onChange={(event) => setPush(event.target.checked)}
                disabled={loading}
              />
              Push
            </label>
          </div>
          <div className="relative inline-flex h-8 items-center">
            <button
              type="button"
              onClick={() => {
                void handleCommit();
              }}
              disabled={loading || !message.trim()}
              className="h-8 rounded-l border border-r-0 border-border bg-zinc-800 px-3 text-xs font-semibold text-zinc-100 transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {amend ? "Amend" : "Commit"}
            </button>
            <button
              type="button"
              onClick={() => setShowCommitMenu((prev) => !prev)}
              disabled={loading}
              className="h-8 rounded-r border border-border bg-zinc-800 px-2 text-xs font-semibold text-zinc-100 transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50"
              aria-label="Commit options"
            >
              <IconChevronDown size={14} />
            </button>
            {showCommitMenu ? (
              <div className="absolute bottom-9 right-0 z-[10020] min-w-[120px] rounded border border-zinc-700 bg-zinc-900 text-xs text-zinc-100 shadow-lg">
                <button
                  type="button"
                  className="block w-full px-3 py-2 text-left hover:bg-zinc-800"
                  onClick={() => {
                    setAmend(false);
                    setShowCommitMenu(false);
                  }}
                >
                  Commit
                </button>
                <button
                  type="button"
                  className="block w-full px-3 py-2 text-left hover:bg-zinc-800"
                  onClick={() => {
                    setAmend(true);
                    setShowCommitMenu(false);
                  }}
                >
                  Amend
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>
      {error ? <div className="mt-1 text-xs text-red-400">{error}</div> : null}
    </div>
  );
}
