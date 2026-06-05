import {
  IconChevronDown,
  IconChevronUp,
} from "@/shared/components/icons/icons";
import {
  getConflictMetadataLabels,
  getConflictMetadataMessage,
} from "../../utils/conflict-metadata";
import type { ConflictMetadataBarProps } from "./types";

function regionButtonClass(disabled = false) {
  return `inline-flex h-7 w-7 items-center justify-center rounded border border-border transition-colors ${
    disabled
      ? "cursor-not-allowed text-zinc-600"
      : "text-zinc-300 hover:bg-background-emphasis hover:text-zinc-100"
  }`;
}

export function ConflictMetadataBar({
  detail,
  activeRegionIndex,
  onPreviousRegion,
  onNextRegion,
}: ConflictMetadataBarProps) {
  const labels = getConflictMetadataLabels(detail);
  const regionCount = detail.regions.length;
  const regionPosition = regionCount ? activeRegionIndex + 1 : 0;
  const canGoPreviousRegion = activeRegionIndex > 0;
  const canGoNextRegion = regionCount > 0 && activeRegionIndex < regionCount - 1;

  return (
    <div className="flex min-h-10 items-center gap-3 border-b border-border bg-zinc-950/40 px-3">
      <div className="min-w-0 flex-1">
        <div className="truncate text-xs text-zinc-300">
          {getConflictMetadataMessage(detail)}
        </div>
        <div className="mt-1 flex flex-wrap gap-1">
          {labels.map((label) => (
            <span
              key={label}
              className="rounded border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-200"
            >
              {label}
            </span>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-1 text-xs text-zinc-400">
        <span className="min-w-[72px] text-right">
          Region {regionPosition} of {regionCount}
        </span>
        <button
          type="button"
          className={regionButtonClass(!canGoPreviousRegion)}
          disabled={!canGoPreviousRegion}
          onClick={onPreviousRegion}
          aria-label="Previous conflict region"
          title="Previous conflict region"
        >
          <IconChevronUp size={14} />
        </button>
        <button
          type="button"
          className={regionButtonClass(!canGoNextRegion)}
          disabled={!canGoNextRegion}
          onClick={onNextRegion}
          aria-label="Next conflict region"
          title="Next conflict region"
        >
          <IconChevronDown size={14} />
        </button>
      </div>
    </div>
  );
}
