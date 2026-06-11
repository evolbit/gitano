import {
  GIT_CONFLICT_CONTENT_KIND,
  GIT_CONFLICT_SIDE,
  GIT_CONFLICT_SIZE_CLASS,
} from "@/shared/types/git-conflicts";
import { ConflictPaneHeader } from "./conflict-pane-header";
import { FullTextPane } from "./full-text-pane";
import { RangeLoadedPane } from "./range-loaded-pane";
import type { ConflictReadOnlyPaneProps } from "./types";

type ConflictPaneFallbackProps = Pick<
  ConflictReadOnlyPaneProps,
  | "fileActionDisabled"
  | "fileActionLabel"
  | "fileActionTitle"
  | "onAcceptFile"
  | "title"
> & {
  message: string;
};

function conflictSideLabel(side: string) {
  return side === GIT_CONFLICT_SIDE.Incoming ? "Incoming" : "Current";
}

function ConflictPaneFallback({
  title,
  fileActionLabel,
  fileActionTitle,
  fileActionDisabled,
  onAcceptFile,
  message,
}: ConflictPaneFallbackProps) {
  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden border-r border-border last:border-r-0">
      <ConflictPaneHeader
        title={title}
        fileActionLabel={fileActionLabel}
        fileActionTitle={fileActionTitle}
        fileActionDisabled={fileActionDisabled}
        onAcceptFile={onAcceptFile}
      />
      <div className="flex flex-1 items-center justify-center px-3 text-sm text-muted-foreground">
        {message}
      </div>
    </section>
  );
}

export function ConflictReadOnlyPane({
  repoPath,
  filePath,
  title,
  version,
  language,
  regions,
  activeRegion,
  acceptedRegionSidesById,
  fileActionLabel,
  fileActionTitle,
  fileActionDisabled,
  onAcceptRegion,
  onAcceptCombination,
  onAcceptFile,
  onIgnoreRegion,
  syncedScrollTop,
  onScrollTopChange,
}: ConflictReadOnlyPaneProps) {
  if (!version || version.contentKind === GIT_CONFLICT_CONTENT_KIND.Missing) {
    return (
      <ConflictPaneFallback
        title={title}
        fileActionLabel={fileActionLabel}
        fileActionTitle={fileActionTitle}
        fileActionDisabled={fileActionDisabled}
        onAcceptFile={onAcceptFile}
        message="Not available"
      />
    );
  }

  if (
    version.contentKind !== GIT_CONFLICT_CONTENT_KIND.Text ||
    version.text === null
  ) {
    return (
      <ConflictPaneFallback
        title={title}
        fileActionLabel={fileActionLabel}
        fileActionTitle={fileActionTitle}
        fileActionDisabled={fileActionDisabled}
        onAcceptFile={onAcceptFile}
        message={`${version.contentKind} content`}
      />
    );
  }

  const sideLabel = conflictSideLabel(version.side);
  const actionLabel = `Accept ${sideLabel}`;
  const combinationActionLabel = `Accept Combination (${sideLabel} First)`;

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
        acceptedRegionSidesById={acceptedRegionSidesById}
        actionLabel={actionLabel}
        combinationActionLabel={combinationActionLabel}
        fileActionLabel={fileActionLabel}
        fileActionTitle={fileActionTitle}
        fileActionDisabled={fileActionDisabled}
        onAcceptRegion={onAcceptRegion}
        onAcceptCombination={onAcceptCombination}
        onAcceptFile={onAcceptFile}
        onIgnoreRegion={onIgnoreRegion}
        syncedScrollTop={syncedScrollTop}
        onScrollTopChange={onScrollTopChange}
      />
    );
  }

  return (
    <FullTextPane
      title={title}
      side={version.side}
      text={version.text}
      language={language}
      regions={regions}
      activeRegion={activeRegion}
      acceptedRegionSidesById={acceptedRegionSidesById}
      actionLabel={actionLabel}
      combinationActionLabel={combinationActionLabel}
      fileActionLabel={fileActionLabel}
      fileActionTitle={fileActionTitle}
      fileActionDisabled={fileActionDisabled}
      onAcceptRegion={onAcceptRegion}
      onAcceptCombination={onAcceptCombination}
      onAcceptFile={onAcceptFile}
      onIgnoreRegion={onIgnoreRegion}
      syncedScrollTop={syncedScrollTop}
      onScrollTopChange={onScrollTopChange}
    />
  );
}
