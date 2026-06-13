import {
  IconChevronDown,
  IconChevronUp,
  IconRefresh,
  IconX,
} from "@/shared/components/icons/icons";
import { LocalAiSetupModal } from "@/features/local-ai";
import {
  GIT_CONFLICT_CONTENT_KIND,
  GIT_CONFLICT_SIDE,
  GIT_CONFLICT_SIZE_CLASS,
  type GitConflictSide,
} from "@/shared/types/git-conflicts";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import type { ConflictScrollHandle } from "./utils/conflict-scroll-sync";
import {
  alignSidePaneRegions,
  buildSidePaneRegions,
} from "./utils/conflict-side-region-projection";

function toolbarButtonClass(disabled = false) {
  return `inline-flex h-8 w-8 items-center justify-center rounded border border-border transition-colors ${
    disabled
      ? "cursor-not-allowed text-zinc-600"
      : "text-zinc-300 hover:bg-background-emphasis hover:text-zinc-100"
  }`;
}

const CONFLICT_FILE_ACTION_TITLE = {
  AcceptCurrentFile: "Replace the entire result file with the current side.",
  AcceptIncomingFile: "Replace the entire result file with the incoming side.",
} as const;

const CONFLICT_FILE_ACTION_LABEL = {
  AcceptCurrentFile: "Accept Current File",
  AcceptIncomingFile: "Accept Incoming File",
} as const;

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
  const scrollHandlesRef = useRef(new Map<GitConflictSide, ConflictScrollHandle>());
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
  }, [detail?.path, detailSignature]);
  const registerConflictScrollHandle = useCallback(
    (side: GitConflictSide, handle: ConflictScrollHandle | null) => {
      if (handle) {
        scrollHandlesRef.current.set(side, handle);
        return;
      }

      scrollHandlesRef.current.delete(side);
    },
    [],
  );
  const publishConflictScrollTop = useCallback(
    (source: GitConflictSide, scrollTop: number) => {
      scrollHandlesRef.current.forEach((handle, side) => {
        if (side !== source) {
          handle.setScrollTop(scrollTop);
        }
      });
    },
    [],
  );

  const resultRegions = resultState.resultRegions;
  const selectRegionById = (regionId: string) => {
    const regionIndex =
      resultRegions.findIndex((region) => region.id === regionId) ?? -1;

    if (regionIndex >= 0) {
      setActiveRegionIndex(regionIndex);
    }
  };
  const goPreviousRegion = () => {
    setActiveRegionIndex((current) => Math.max(0, current - 1));
  };
  const goNextRegion = () => {
    setActiveRegionIndex((current) => {
      const regionCount = resultRegions.length;
      if (regionCount === 0) return 0;

      return Math.min(regionCount - 1, current + 1);
    });
  };
  const ignoreRegion = (regionId: string) => {
    const regionCount = resultRegions.length;
    const regionIndex =
      resultRegions.findIndex((region) => region.id === regionId);

    if (regionCount === 0 || regionIndex < 0) {
      goNextRegion();
      return;
    }

    setActiveRegionIndex(Math.min(regionCount - 1, regionIndex + 1));
  };
  const acceptIncomingRegion = (regionId: string) => {
    selectRegionById(regionId);
    resultState.acceptIncomingRegion(regionId);
  };
  const acceptCurrentRegion = (regionId: string) => {
    selectRegionById(regionId);
    resultState.acceptCurrentRegion(regionId);
  };
  const acceptIncomingFirstCombination = (regionId: string) => {
    selectRegionById(regionId);
    resultState.acceptIncomingFirstCombination(regionId);
  };
  const acceptCurrentFirstCombination = (regionId: string) => {
    selectRegionById(regionId);
    resultState.acceptCurrentFirstCombination(regionId);
  };
  const conflictAi = useConflictAiFix({
    repoPath,
    filePath,
    detail,
    onApplyFileContent: resultState.applyAiFileResult,
  });
  const aiResolutionMessage = conflictAi.error ?? conflictAi.candidateSummary;
  const aiResolutionStatus = conflictAi.error
    ? "error"
    : conflictAi.candidateSummary
      ? "info"
      : null;
  const resultUnsupportedReason =
    detail?.result.contentKind !== GIT_CONFLICT_CONTENT_KIND.Text
      ? "Open this conflict in an external editor for non-text content."
      : detail.result.size.sizeClass === GIT_CONFLICT_SIZE_CLASS.VeryLarge
        ? "Open this conflict in an external editor for very large result files."
        : detail.result.text === null
          ? "Result content is not available."
          : null;
  const editorLanguage = inferConflictEditorLanguage(filePath);
  const fileActionDisabled =
    resultState.actionInFlight || !resultState.canAcceptFile;
  const incomingPaneRegions = useMemo(
    () =>
      detail
        ? buildSidePaneRegions({
            regions: resultRegions,
            side: GIT_CONFLICT_SIDE.Incoming,
            sideText: detail.incoming?.text ?? null,
          })
        : [],
    [detail, resultRegions],
  );
  const currentPaneRegions = useMemo(
    () =>
      detail
        ? buildSidePaneRegions({
            regions: resultRegions,
            side: GIT_CONFLICT_SIDE.Current,
            sideText: detail.current?.text ?? null,
          })
        : [],
    [detail, resultRegions],
  );
  const alignedSidePaneRegions = useMemo(
    () =>
      alignSidePaneRegions({
        currentRegions: currentPaneRegions,
        incomingRegions: incomingPaneRegions,
      }),
    [currentPaneRegions, incomingPaneRegions],
  );
  const readOnlyPaneConfigs = detail
    ? [
        {
          key: GIT_CONFLICT_SIDE.Incoming,
          title: "Incoming",
          version: detail.incoming,
          regions: alignedSidePaneRegions.incomingRegions,
          fileActionLabel: CONFLICT_FILE_ACTION_LABEL.AcceptIncomingFile,
          fileActionTitle: CONFLICT_FILE_ACTION_TITLE.AcceptIncomingFile,
          onAcceptRegion: acceptIncomingRegion,
          onAcceptCombination: acceptIncomingFirstCombination,
          onAcceptFile: () => {
            void resultState.acceptIncomingFile();
          },
        },
        {
          key: GIT_CONFLICT_SIDE.Current,
          title: "Current",
          version: detail.current,
          regions: alignedSidePaneRegions.currentRegions,
          fileActionLabel: CONFLICT_FILE_ACTION_LABEL.AcceptCurrentFile,
          fileActionTitle: CONFLICT_FILE_ACTION_TITLE.AcceptCurrentFile,
          onAcceptRegion: acceptCurrentRegion,
          onAcceptCombination: acceptCurrentFirstCombination,
          onAcceptFile: () => {
            void resultState.acceptCurrentFile();
          },
        },
      ]
    : [];

  return (
    <section className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden bg-background text-foreground">
      <header className="flex min-h-12 min-w-0 items-center gap-3 border-b border-border bg-background-emphasis px-3">
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

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        {detailState.isLoading ? (
          <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
            Loading conflict
          </div>
        ) : detailState.error ? (
          <div className="border-b border-rose-900/40 bg-rose-950/30 px-3 py-2 text-sm text-rose-300">
            {detailState.error}
          </div>
        ) : detail ? (
          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
            <ConflictMetadataBar
              detail={detail}
              activeRegionIndex={activeRegionIndex}
              onPreviousRegion={goPreviousRegion}
              onNextRegion={goNextRegion}
            />
            <div className="grid min-h-0 min-w-0 flex-1 grid-rows-[minmax(0,1fr)_auto_minmax(220px,42%)] overflow-hidden">
              <div className="grid min-h-0 min-w-0 grid-cols-[minmax(0,1fr)_minmax(0,1fr)] overflow-hidden">
                {readOnlyPaneConfigs.map((pane) => (
                  <ConflictReadOnlyPane
                    key={pane.key}
                    repoPath={repoPath}
                    filePath={filePath}
                    title={pane.title}
                    side={pane.key}
                    version={pane.version}
                    language={editorLanguage}
                    regions={pane.regions}
                    activeRegion={pane.regions[activeRegionIndex] ?? null}
                    acceptedRegionSidesById={
                      resultState.acceptedRegionSidesById
                    }
                    fileActionLabel={pane.fileActionLabel}
                    fileActionTitle={pane.fileActionTitle}
                    fileActionDisabled={fileActionDisabled}
                    onAcceptRegion={pane.onAcceptRegion}
                    onAcceptCombination={pane.onAcceptCombination}
                    onAcceptFile={pane.onAcceptFile}
                    onIgnoreRegion={ignoreRegion}
                    syncedScrollTop={null}
                    onScrollTopChange={(scrollTop) =>
                      publishConflictScrollTop(pane.key, scrollTop)
                    }
                    onScrollPaneMount={(handle) =>
                      registerConflictScrollHandle(pane.key, handle)
                    }
                  />
                ))}
              </div>
              <ConflictAiPanel
                loading={conflictAi.loading}
                canRunFile={conflictAi.canRunFile}
                onRunFile={() => {
                  void conflictAi.runFileFix();
                }}
                onRefreshFile={() => {
                  void conflictAi.runFileFix(true);
                }}
              />
              <ConflictResultEditor
                filePath={filePath}
                content={resultState.content}
                language={editorLanguage}
                resultRegions={resultState.resultRegions}
                dirty={resultState.dirty}
                unsupportedReason={resultUnsupportedReason}
                aiResolutionSummary={aiResolutionMessage}
                aiResolutionDetails={
                  conflictAi.error ? null : conflictAi.candidateDetails
                }
                aiResolutionStatus={aiResolutionStatus}
                acceptedRegions={resultState.acceptedRegions}
                onChange={resultState.setResultContent}
                onSave={() => {
                  void resultState.saveResult();
                }}
                onRemoveAcceptedRegionSide={
                  resultState.removeAcceptedRegionSide
                }
                onResetResult={() => {
                  resultState.resetResult();
                  conflictAi.clearCandidate();
                }}
                onMarkResolved={() => {
                  void resultState.markResolved();
                }}
                markResolvedBlockedReason={resultState.markResolvedBlockedReason}
                actionInFlight={resultState.actionInFlight}
                syncedScrollTop={null}
                onScrollTopChange={(scrollTop) =>
                  publishConflictScrollTop(GIT_CONFLICT_SIDE.Result, scrollTop)
                }
                onScrollPaneMount={(handle) =>
                  registerConflictScrollHandle(GIT_CONFLICT_SIDE.Result, handle)
                }
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
