import {
  GIT_CONFLICT_CONTENT_KIND,
  GIT_CONFLICT_SIDE,
  GIT_CONFLICT_SIZE_CLASS,
} from "@/shared/types/git-conflicts";
import { FullTextPane } from "./full-text-pane";
import { RangeLoadedPane } from "./range-loaded-pane";
import type { ConflictReadOnlyPaneProps } from "./types";

function conflictSideLabel(side: string) {
  return side === GIT_CONFLICT_SIDE.Incoming ? "Incoming" : "Current";
}

export function ConflictReadOnlyPane({
  repoPath,
  filePath,
  title,
  version,
  language,
  regions,
  activeRegion,
  acceptedRegionLabel,
  onAcceptRegion,
  onAcceptCombination,
  onIgnoreRegion,
  syncedScrollTop,
  onScrollTopChange,
}: ConflictReadOnlyPaneProps) {
  if (!version || version.contentKind === GIT_CONFLICT_CONTENT_KIND.Missing) {
    return (
      <section className="flex min-h-0 flex-1 flex-col border-r border-border last:border-r-0">
        <div className="border-b border-border bg-background-emphasis px-3 py-1.5 text-xs font-semibold">
          {title}
        </div>
        <div className="flex flex-1 items-center justify-center px-3 text-sm text-muted-foreground">
          Not available
        </div>
      </section>
    );
  }

  if (
    version.contentKind !== GIT_CONFLICT_CONTENT_KIND.Text ||
    version.text === null
  ) {
    return (
      <section className="flex min-h-0 flex-1 flex-col border-r border-border last:border-r-0">
        <div className="border-b border-border bg-background-emphasis px-3 py-1.5 text-xs font-semibold">
          {title}
        </div>
        <div className="flex flex-1 items-center justify-center px-3 text-sm text-muted-foreground">
          {version.contentKind} content
        </div>
      </section>
    );
  }

  if (version.size.sizeClass === GIT_CONFLICT_SIZE_CLASS.VeryLarge) {
    return (
      <RangeLoadedPane
        repoPath={repoPath}
        filePath={filePath}
        title={title}
        side={version.side}
        totalLineCount={version.size.lineCount}
        signature={`${version.side}:${version.size.byteSize}:${version.size.lineCount}`}
        regions={regions}
        activeRegion={activeRegion}
        acceptedRegionLabel={acceptedRegionLabel}
        actionLabel={`Accept ${conflictSideLabel(version.side)}`}
        combinationActionLabel={`Accept Combination (${conflictSideLabel(version.side)} First)`}
        onAcceptRegion={onAcceptRegion}
        onAcceptCombination={onAcceptCombination}
        onIgnoreRegion={onIgnoreRegion}
        syncedScrollTop={syncedScrollTop}
        onScrollTopChange={onScrollTopChange}
      />
    );
  }

  return (
    <FullTextPane
      title={title}
      text={version.text}
      language={language}
      regions={regions}
      activeRegion={activeRegion}
      acceptedRegionLabel={acceptedRegionLabel}
      actionLabel={`Accept ${conflictSideLabel(version.side)}`}
      combinationActionLabel={`Accept Combination (${conflictSideLabel(version.side)} First)`}
      onAcceptRegion={onAcceptRegion}
      onAcceptCombination={onAcceptCombination}
      onIgnoreRegion={onIgnoreRegion}
      syncedScrollTop={syncedScrollTop}
      onScrollTopChange={onScrollTopChange}
    />
  );
}
