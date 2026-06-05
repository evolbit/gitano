import {
  IconChevronDown,
  IconChevronUp,
  IconRefresh,
  IconX,
} from "@/shared/components/icons/icons";
import { LocalAiSetupModal } from "@/features/local-ai";
import {
  GIT_CONFLICT_CONTENT_KIND,
  GIT_CONFLICT_SIZE_CLASS,
} from "@/shared/types/git-conflicts";
import { useEffect, useState } from "react";
import { useConflictAiFix } from "../../hooks/use-conflict-ai-fix";
import { useConflictFileDetail } from "../../hooks/use-conflict-file-detail";
import { useConflictNavigation } from "../../hooks/use-conflict-navigation";
import { useConflictResultState } from "../../hooks/use-conflict-result-state";
import { ConflictAiPanel } from "./components/conflict-ai-panel";
import { ConflictMetadataBar } from "./components/conflict-metadata-bar";
import { ConflictReadOnlyPane } from "./components/conflict-read-only-pane";
import { ConflictResultEditor } from "./components/conflict-result-editor";
import type { ConflictResolutionSurfaceProps } from "./types";
import { inferConflictEditorLanguage } from "./utils/conflict-language";

function toolbarButtonClass(disabled = false) {
  return `inline-flex h-8 w-8 items-center justify-center rounded border border-border transition-colors ${
    disabled
      ? "cursor-not-allowed text-zinc-600"
      : "text-zinc-300 hover:bg-background-emphasis hover:text-zinc-100"
  }`;
}

export function ConflictResolutionSurface({
  repoPath,
  filePath,
  fileSignature,
  conflicts,
  onSelectConflictPath,
  onClose,
  onResolved,
}: ConflictResolutionSurfaceProps) {
  const [activeRegionIndex, setActiveRegionIndex] = useState(0);
  const [conflictScrollTop, setConflictScrollTop] = useState<number | null>(null);
  const detailState = useConflictFileDetail({
    repoPath,
    filePath,
    fileSignature,
  });
  const resultState = useConflictResultState({
    repoPath,
    filePath,
    detail: detailState.detail,
    activeRegionIndex,
    onResolved,
  });
  const navigation = useConflictNavigation({
    conflicts,
    selectedPath: filePath,
    onSelectPath: onSelectConflictPath,
  });
  const activePosition =
    navigation.activeIndex >= 0 ? navigation.activeIndex + 1 : 0;
  const detail = resultState.detail;
  const detailSignature = detail?.signatures.indexSignature ?? null;
  useEffect(() => {
    setActiveRegionIndex(0);
    setConflictScrollTop(null);
  }, [detail?.path, detailSignature]);

  const activeRegion = detail?.regions[activeRegionIndex] ?? null;
  const goPreviousRegion = () => {
    setActiveRegionIndex((current) => Math.max(0, current - 1));
  };
  const goNextRegion = () => {
    setActiveRegionIndex((current) => {
      const regionCount = detail?.regions.length ?? 0;
      if (regionCount === 0) return 0;

      return Math.min(regionCount - 1, current + 1);
    });
  };
  const conflictAi = useConflictAiFix({
    repoPath,
    filePath,
    detail,
    activeRegion,
    resultRegions: resultState.resultRegions,
    onApplyFileContent: resultState.setResultContent,
    onApplyRegionContent: resultState.applyRegionReplacement,
  });
  const resultUnsupportedReason =
    detail?.result.contentKind !== GIT_CONFLICT_CONTENT_KIND.Text
      ? "Open this conflict in an external editor for non-text content."
      : detail.result.size.sizeClass === GIT_CONFLICT_SIZE_CLASS.VeryLarge
        ? "Open this conflict in an external editor for very large result files."
        : detail.result.text === null
          ? "Result content is not available."
          : null;
  const editorLanguage = inferConflictEditorLanguage(filePath);

  return (
    <section className="flex h-full min-h-0 flex-col bg-background text-foreground">
      <header className="flex min-h-12 items-center gap-3 border-b border-border bg-background-emphasis px-3">
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-medium uppercase text-amber-300">
            Conflict {activePosition} of {navigation.totalCount}
          </div>
          <h2 className="truncate text-sm font-semibold">{filePath}</h2>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            className={toolbarButtonClass(!navigation.canGoPrevious)}
            disabled={!navigation.canGoPrevious}
            onClick={navigation.goPrevious}
            aria-label="Previous conflict"
            title="Previous conflict"
          >
            <IconChevronUp size={16} />
          </button>
          <button
            type="button"
            className={toolbarButtonClass(!navigation.canGoNext)}
            disabled={!navigation.canGoNext}
            onClick={navigation.goNext}
            aria-label="Next conflict"
            title="Next conflict"
          >
            <IconChevronDown size={16} />
          </button>
          <button
            type="button"
            className={toolbarButtonClass()}
            onClick={() => {
              void detailState.refresh();
            }}
            aria-label="Refresh conflict detail"
            title="Refresh conflict detail"
          >
            <IconRefresh size={16} />
          </button>
          <button
            type="button"
            className={toolbarButtonClass()}
            onClick={onClose}
            aria-label="Close conflict resolution"
            title="Close conflict resolution"
          >
            <IconX size={16} />
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col overflow-auto">
        {detailState.isLoading ? (
          <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
            Loading conflict
          </div>
        ) : detailState.error ? (
          <div className="border-b border-rose-900/40 bg-rose-950/30 px-3 py-2 text-sm text-rose-300">
            {detailState.error}
          </div>
        ) : detail ? (
          <div className="flex min-h-0 flex-1 flex-col">
            <ConflictMetadataBar
              detail={detail}
              activeRegionIndex={activeRegionIndex}
              onPreviousRegion={goPreviousRegion}
              onNextRegion={goNextRegion}
            />
            <div className="grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)_auto_minmax(220px,42%)]">
              <div className="grid min-h-0 grid-cols-2">
                <ConflictReadOnlyPane
                  repoPath={repoPath}
                  filePath={filePath}
                  title="Incoming"
                  version={detail.incoming}
                  language={editorLanguage}
                  regions={detail.regions}
                  activeRegion={activeRegion}
                  acceptedRegionLabel={resultState.acceptedRegionLabel}
                  onAcceptRegion={resultState.acceptIncomingRegion}
                  onAcceptCombination={
                    resultState.acceptIncomingFirstCombination
                  }
                  onIgnoreRegion={goNextRegion}
                  syncedScrollTop={conflictScrollTop}
                  onScrollTopChange={setConflictScrollTop}
                />
                <ConflictReadOnlyPane
                  repoPath={repoPath}
                  filePath={filePath}
                  title="Current"
                  version={detail.current}
                  language={editorLanguage}
                  regions={detail.regions}
                  activeRegion={activeRegion}
                  acceptedRegionLabel={resultState.acceptedRegionLabel}
                  onAcceptRegion={resultState.acceptCurrentRegion}
                  onAcceptCombination={resultState.acceptCurrentFirstCombination}
                  onIgnoreRegion={goNextRegion}
                  syncedScrollTop={conflictScrollTop}
                  onScrollTopChange={setConflictScrollTop}
                />
              </div>
              <ConflictAiPanel
                candidate={conflictAi.candidate}
                candidateSummary={conflictAi.candidateSummary}
                loading={conflictAi.loading}
                error={conflictAi.error}
                canRunRegion={conflictAi.canRunRegion}
                canRunFile={conflictAi.canRunFile}
                onRunRegion={() => {
                  void conflictAi.runRegionFix();
                }}
                onRunFile={() => {
                  void conflictAi.runFileFix();
                }}
                onRefreshRegion={() => {
                  void conflictAi.runRegionFix(true);
                }}
                onRefreshFile={() => {
                  void conflictAi.runFileFix(true);
                }}
                onApply={conflictAi.applyCandidate}
                onClear={conflictAi.clearCandidate}
              />
              <ConflictResultEditor
                filePath={filePath}
                content={resultState.content}
                language={editorLanguage}
                resultRegions={resultState.resultRegions}
                dirty={resultState.dirty}
                unsupportedReason={resultUnsupportedReason}
                acceptedRegionLabel={resultState.acceptedRegionLabel}
                onChange={resultState.setResultContent}
                onSave={() => {
                  void resultState.saveResult();
                }}
                onAcceptCurrentRegion={resultState.acceptCurrentRegion}
                onAcceptIncomingRegion={resultState.acceptIncomingRegion}
                onRemoveAcceptedRegionSide={resultState.removeAcceptedRegionSide}
                onAcceptCurrentFile={() => {
                  void resultState.acceptCurrentFile();
                }}
                onAcceptIncomingFile={() => {
                  void resultState.acceptIncomingFile();
                }}
                onMarkResolved={() => {
                  void resultState.markResolved();
                }}
                canAcceptRegion={resultState.canAcceptRegion}
                canAcceptFile={resultState.canAcceptFile}
                markResolvedBlockedReason={resultState.markResolvedBlockedReason}
                actionInFlight={resultState.actionInFlight}
                syncedScrollTop={conflictScrollTop}
                onScrollTopChange={setConflictScrollTop}
              />
            </div>
          </div>
        ) : (
          <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
            Select a conflict
          </div>
        )}
      </div>
      <LocalAiSetupModal
        open={conflictAi.setupOpen}
        actionKind="mergeConflictSuggestions"
        setupReason={conflictAi.setupReason}
        onClose={conflictAi.closeSetup}
        onReady={conflictAi.retryAfterSetup}
      />
    </section>
  );
}
