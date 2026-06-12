type ConflictPaneHeaderProps = {
  title: string;
  fileActionLabel: string;
  fileActionTitle: string;
  fileActionDisabled: boolean;
  onAcceptFile: () => void;
};

function fileActionButtonClass(disabled: boolean) {
  return `inline-flex h-7 shrink-0 items-center rounded border border-border px-2.5 text-[11px] font-medium transition-colors ${
    disabled
      ? "cursor-not-allowed text-zinc-600"
      : "text-zinc-200 hover:bg-background hover:text-zinc-100"
  }`;
}

export function ConflictPaneHeader({
  title,
  fileActionLabel,
  fileActionTitle,
  fileActionDisabled,
  onAcceptFile,
}: ConflictPaneHeaderProps) {
  return (
    <div
      className="gitano-conflict-pane-header flex min-h-8 min-w-0 items-center gap-2 overflow-x-auto border-b border-border bg-background-emphasis px-3 py-1"
      data-conflict-pane-header="true"
    >
      <span
        className="gitano-conflict-pane-accent h-3 w-1 shrink-0 rounded-sm"
        aria-hidden="true"
      />
      <div className="gitano-conflict-pane-title min-w-0 flex-1 truncate text-xs font-semibold">
        {title}
      </div>
      <button
        type="button"
        className={fileActionButtonClass(fileActionDisabled)}
        disabled={fileActionDisabled}
        onClick={onAcceptFile}
        title={fileActionTitle}
      >
        {fileActionLabel}
      </button>
    </div>
  );
}
