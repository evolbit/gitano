export const CONFLICT_LINE_HIGHLIGHT = {
  None: "none",
  Strong: "strong",
  Weak: "weak",
} as const;

export type ConflictLineHighlight =
  (typeof CONFLICT_LINE_HIGHLIGHT)[keyof typeof CONFLICT_LINE_HIGHLIGHT];

type ConflictLineRowProps = {
  lineNumber: number;
  content: string;
  highlight: ConflictLineHighlight;
};

export function ConflictLineRow({
  lineNumber,
  content,
  highlight,
}: ConflictLineRowProps) {
  const highlightClass =
    highlight === CONFLICT_LINE_HIGHLIGHT.Strong
      ? "gitano-conflict-range-line-strong text-zinc-200"
      : highlight === CONFLICT_LINE_HIGHLIGHT.Weak
        ? "gitano-conflict-range-line-weak text-zinc-200"
        : "text-zinc-300";

  return (
    <div
      className={`grid min-w-0 grid-cols-[4rem_minmax(0,1fr)] font-mono text-xs leading-5 ${highlightClass}`}
    >
      <div className="select-none border-r border-border pr-2 text-right text-zinc-600">
        {lineNumber}
      </div>
      <pre className="min-w-0 overflow-hidden px-2 whitespace-pre-wrap">
        {content || " "}
      </pre>
    </div>
  );
}
