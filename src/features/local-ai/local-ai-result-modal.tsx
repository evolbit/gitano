import ReactDOM from "react-dom";
import { IconX } from "@/components/icons";
import type {
  LocalAiAnalysisResult,
  LocalAiConflictSuggestionsResult,
  LocalAiRunResult,
} from "@/shared/api/local-ai";

type LocalAiResultModalProps = {
  open: boolean;
  title: string;
  result: LocalAiRunResult | null;
  loading?: boolean;
  error?: string | null;
  onClose: () => void;
  onRefresh?: () => void;
};

function severityClass(severity: string) {
  switch (severity) {
    case "high":
      return "border-red-500/40 bg-red-500/10 text-red-100";
    case "medium":
      return "border-amber-500/40 bg-amber-500/10 text-amber-100";
    case "low":
      return "border-blue-500/40 bg-blue-500/10 text-blue-100";
    default:
      return "border-zinc-600 bg-zinc-800 text-zinc-200";
  }
}

function AnalysisBody({ analysis }: { analysis: LocalAiAnalysisResult }) {
  return (
    <div className="space-y-4">
      <section>
        <h3 className="mb-1 text-xs font-semibold uppercase tracking-normal text-muted-foreground">
          Summary
        </h3>
        <p className="text-sm text-zinc-100">{analysis.summary}</p>
      </section>

      {analysis.riskAssessment ? (
        <section>
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-normal text-muted-foreground">
            Risk
          </h3>
          <p className="text-sm text-zinc-100">{analysis.riskAssessment}</p>
        </section>
      ) : null}

      {analysis.changedAreas.length ? (
        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-normal text-muted-foreground">
            Changed areas
          </h3>
          <div className="flex flex-wrap gap-2">
            {analysis.changedAreas.map((area) => (
              <span
                key={area}
                className="rounded border border-border bg-background-emphasis px-2 py-1 text-xs text-zinc-200"
              >
                {area}
              </span>
            ))}
          </div>
        </section>
      ) : null}

      <section>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-normal text-muted-foreground">
          Findings
        </h3>
        {analysis.findings.length ? (
          <div className="space-y-2">
            {analysis.findings.map((finding, index) => (
              <div
                key={`${finding.title}-${index}`}
                className="rounded border border-border bg-background-emphasis p-3"
              >
                <div className="mb-1 flex items-center gap-2">
                  <span
                    className={`rounded border px-1.5 py-0.5 text-[10px] uppercase ${severityClass(
                      finding.severity,
                    )}`}
                  >
                    {finding.severity}
                  </span>
                  <span className="font-medium text-zinc-100">
                    {finding.title}
                  </span>
                </div>
                <p className="text-sm text-zinc-300">{finding.explanation}</p>
                {finding.filePath ? (
                  <div className="mt-2 font-mono text-xs text-zinc-500">
                    {finding.filePath}
                    {finding.line ? `:${finding.line}` : ""}
                  </div>
                ) : null}
                {finding.suggestion ? (
                  <div className="mt-2 rounded border border-border bg-background px-2 py-1.5 text-xs text-zinc-300">
                    {finding.suggestion}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded border border-border bg-background-emphasis p-3 text-sm text-zinc-400">
            No findings returned.
          </div>
        )}
      </section>
    </div>
  );
}

function ConflictBody({
  conflicts,
}: {
  conflicts: LocalAiConflictSuggestionsResult;
}) {
  return (
    <div className="space-y-4">
      <section>
        <h3 className="mb-1 text-xs font-semibold uppercase tracking-normal text-muted-foreground">
          Summary
        </h3>
        <p className="text-sm text-zinc-100">{conflicts.summary}</p>
      </section>
      <section className="space-y-2">
        {conflicts.files.map((file) => (
          <div
            key={file.filePath}
            className="rounded border border-border bg-background-emphasis p-3"
          >
            <div className="mb-1 font-mono text-xs text-zinc-300">
              {file.filePath}
            </div>
            <p className="text-sm text-zinc-100">{file.summary}</p>
            <div className="mt-2 rounded border border-border bg-background px-2 py-1.5 text-xs text-zinc-300">
              {file.suggestion}
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}

export function LocalAiResultModal({
  open,
  title,
  result,
  loading,
  error,
  onClose,
  onRefresh,
}: LocalAiResultModalProps) {
  if (!open) return null;

  const analysis =
    result?.result.kind === "analysis" ? result.result.data : null;
  const conflicts =
    result?.result.kind === "conflictSuggestions" ? result.result.data : null;

  return ReactDOM.createPortal(
    <div className="fixed inset-0 z-[10040]">
      <div className="absolute inset-0 bg-black/60" />
      <div className="relative mx-auto my-8 flex max-h-[92vh] w-[min(760px,94vw)] flex-col overflow-hidden rounded-lg border border-border bg-background shadow-2xl">
        <div className="flex items-center justify-between border-b border-border bg-background-emphasis px-5 py-3">
          <div>
            <div className="text-xs uppercase tracking-normal text-muted-foreground">
              Local AI
            </div>
            <div className="text-base font-semibold text-foreground">{title}</div>
          </div>
          <button
            type="button"
            className="rounded p-2 text-muted-foreground hover:bg-zinc-800 hover:text-foreground"
            onClick={onClose}
            aria-label="Close"
          >
            <IconX size={20} />
          </button>
        </div>

        <div className="min-h-[220px] overflow-y-auto p-5">
          {loading ? (
            <div className="flex h-44 items-center justify-center text-sm text-zinc-400">
              Running local analysis...
            </div>
          ) : null}
          {error ? (
            <div className="rounded border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-100">
              {error}
            </div>
          ) : null}
          {!loading && !error && analysis ? (
            <AnalysisBody analysis={analysis} />
          ) : null}
          {!loading && !error && conflicts ? (
            <ConflictBody conflicts={conflicts} />
          ) : null}
        </div>

        <div className="flex items-center justify-between border-t border-border bg-background-emphasis px-5 py-3 text-xs text-zinc-500">
          <span>
            {result
              ? `${result.fromCache ? "Cached" : "Fresh"} · ${result.modelId}`
              : "Local model output"}
          </span>
          <div className="flex gap-2">
            {onRefresh ? (
              <button
                type="button"
                className="h-8 rounded border border-border px-3 text-xs text-zinc-200 hover:bg-zinc-800"
                onClick={onRefresh}
                disabled={loading}
              >
                Refresh
              </button>
            ) : null}
            <button
              type="button"
              className="h-8 rounded border border-border px-3 text-xs text-zinc-200 hover:bg-zinc-800"
              onClick={onClose}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
