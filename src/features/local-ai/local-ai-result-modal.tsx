import { useEffect, useMemo, useState } from "react";
import ReactDOM from "react-dom";
import { IconCheck, IconCircleDot, IconX } from "@/components/icons";
import type {
  LocalAiAnalysisResult,
  LocalAiConflictSuggestionsResult,
  LocalAiRunProgress,
  LocalAiRunResult,
} from "@/shared/api/local-ai";

type LocalAiResultModalProps = {
  open: boolean;
  title: string;
  result: LocalAiRunResult | null;
  loading?: boolean;
  error?: string | null;
  progress?: LocalAiRunProgress[];
  onClose: () => void;
  onRefresh?: () => void;
};

const PROGRESS_STEP_DELAY_MS = 400;

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

function isTerminalProgress(state: LocalAiRunProgress["state"]) {
  return state === "completed" || state === "failed";
}

function compactProgress(
  progress: LocalAiRunProgress[],
): LocalAiRunProgress[] {
  return progress.reduce<LocalAiRunProgress[]>((items, item) => {
    const previous = items[items.length - 1];
    if (previous?.state === item.state) {
      return items;
    }

    return [...items, item];
  }, []);
}

function ProgressTimeline({ progress }: { progress: LocalAiRunProgress[] }) {
  const steps = useMemo(() => compactProgress(progress), [progress]);
  const [visibleCount, setVisibleCount] = useState(0);
  const visibleSteps = steps.slice(0, visibleCount);
  const latestVisibleStep = visibleSteps[visibleSteps.length - 1];
  const modelRunning =
    visibleSteps.some((step) => step.state === "runningModel") &&
    !visibleSteps.some((step) => isTerminalProgress(step.state));
  const [runningStartedAt, setRunningStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!steps.length) {
      setVisibleCount(0);
      return;
    }

    setVisibleCount((current) =>
      current === 0 ? 1 : Math.min(current, steps.length),
    );
  }, [steps.length]);

  useEffect(() => {
    if (visibleCount >= steps.length) return;

    const timeout = window.setTimeout(() => {
      setVisibleCount((current) => Math.min(current + 1, steps.length));
    }, PROGRESS_STEP_DELAY_MS);

    return () => window.clearTimeout(timeout);
  }, [steps.length, visibleCount]);

  useEffect(() => {
    if (!modelRunning) {
      setRunningStartedAt(null);
      return;
    }

    setRunningStartedAt((current) => current ?? Date.now());
  }, [modelRunning]);

  useEffect(() => {
    if (!modelRunning) return;

    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [modelRunning]);

  const elapsedSeconds =
    modelRunning && runningStartedAt
      ? Math.max(0, Math.floor((now - runningStartedAt) / 1000))
      : 0;

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        {visibleSteps.map((step, index) => {
          const current = index === visibleSteps.length - 1;
          const complete = !current || step.state === "completed";
          const failed = step.state === "failed";
          return (
            <div
              key={`${step.runId}-${step.state}-${index}`}
              className="flex items-start gap-3 text-sm"
            >
              <span
                className={`mt-0.5 inline-flex h-5 w-5 flex-none items-center justify-center rounded-full border ${
                  failed
                    ? "border-red-500/50 text-red-200"
                    : complete
                      ? "border-emerald-500/50 text-emerald-200"
                      : "border-blue-400/60 text-blue-200"
                }`}
              >
                {complete ? <IconCheck size={13} /> : <IconCircleDot size={12} />}
              </span>
              <span
                className={
                  failed
                    ? "text-red-100"
                    : current
                      ? "text-zinc-100"
                      : "text-zinc-400"
                }
              >
                {step.state === "runningModel" && modelRunning
                  ? `${step.message} · ${elapsedSeconds}s`
                  : step.message}
              </span>
            </div>
          );
        })}
      </div>

      {modelRunning ? (
        <div className="rounded border border-border bg-background-emphasis px-3 py-2 text-xs text-zinc-400">
          Local models can take longer the first time they wake up.
        </div>
      ) : null}

      {latestVisibleStep?.state === "failed" && latestVisibleStep.error ? (
        <div className="rounded border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-100">
          {latestVisibleStep.error}
        </div>
      ) : null}
    </div>
  );
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
  progress = [],
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
            progress.length ? (
              <ProgressTimeline progress={progress} />
            ) : (
              <div className="flex h-44 items-center justify-center text-sm text-zinc-400">
                Running local analysis...
              </div>
            )
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
