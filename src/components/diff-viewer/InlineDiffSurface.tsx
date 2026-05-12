import { useEffect, useState } from "react";
import DiffViewer from "./DiffViewer";
import { DiffDisplayMode, DiffSource } from "./types";
import { IconX } from "../icons";

type InlineDiffSurfaceProps = {
  repoPath: string;
  filePath: string;
  sha?: string;
  diffSource?: DiffSource;
  title: string;
  onClose: () => void;
  onWorkingTreeStageChange?: () => Promise<void> | void;
};

export default function InlineDiffSurface({
  repoPath,
  filePath,
  sha,
  diffSource,
  title,
  onClose,
  onWorkingTreeStageChange,
}: InlineDiffSurfaceProps) {
  const [displayMode, setDisplayMode] = useState<DiffDisplayMode>("unified");

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [onClose]);

  return (
    <div className="flex h-full min-h-0 w-full flex-col bg-background">
      <div className="flex h-11 min-h-11 items-center justify-between border-b border-border bg-background-emphasis px-3">
        <span className="truncate text-sm font-semibold text-foreground">
          {title}
        </span>
        <button
          type="button"
          className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-zinc-800 hover:text-foreground"
          onClick={onClose}
          aria-label="Close diff viewer"
        >
          <IconX size={16} />
        </button>
      </div>
      <div className="flex-1 min-h-0 overflow-auto p-4">
        <DiffViewer
          repoPath={repoPath}
          filePath={filePath}
          sha={sha}
          diffSource={diffSource}
          onWorkingTreeStageChange={onWorkingTreeStageChange}
          displayMode={displayMode}
          onDisplayModeChange={setDisplayMode}
        />
      </div>
    </div>
  );
}
