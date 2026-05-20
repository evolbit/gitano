import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { LocalAiRunProgress, LocalAiRunResult } from "@/shared/api/local-ai";
import { LocalAiResultModal } from "./local-ai-result-modal";

const baseProgress = {
  runId: "run-1",
  actionKind: "commitAnalysis",
  error: null,
} satisfies Pick<LocalAiRunProgress, "runId" | "actionKind" | "error">;

function renderModal(props: Partial<Parameters<typeof LocalAiResultModal>[0]>) {
  return render(
    <LocalAiResultModal
      open
      title="Analyze abc1234"
      result={null}
      loading={false}
      error={null}
      onClose={vi.fn()}
      {...props}
    />,
  );
}

describe("LocalAiResultModal", () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("paces commit analysis progress while loading", () => {
    vi.useFakeTimers();

    renderModal({
      loading: true,
      progress: [
        {
          ...baseProgress,
          state: "resolvingCommit",
          message: "Resolving commit",
        },
        {
          ...baseProgress,
          state: "readingCommitDiff",
          message: "Reading commit diff",
        },
        {
          ...baseProgress,
          state: "runningModel",
          message: "Running local model",
        },
      ],
    });

    expect(screen.getByText("Resolving commit")).toBeInTheDocument();
    expect(screen.queryByText("Reading commit diff")).not.toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(400);
    });

    expect(screen.getByText("Reading commit diff")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(400);
    });

    expect(screen.getByText(/Running local model/)).toBeInTheDocument();
    expect(
      screen.getByText(
        "Local models can take longer the first time they wake up.",
      ),
    ).toBeInTheDocument();
  });

  it("shows cache-hit progress while loading", () => {
    vi.useFakeTimers();

    renderModal({
      loading: true,
      progress: [
        {
          ...baseProgress,
          state: "checkingCache",
          message: "Checking cache",
        },
        {
          ...baseProgress,
          state: "cacheHit",
          message: "Using cached analysis",
        },
      ],
    });

    expect(screen.getByText("Checking cache")).toBeInTheDocument();
    expect(screen.queryByText("Using cached analysis")).not.toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(400);
    });

    expect(screen.getByText("Using cached analysis")).toBeInTheDocument();
  });

  it("renders the structured result after loading finishes", () => {
    const result: LocalAiRunResult = {
      actionKind: "commitAnalysis",
      modelId: "phi4-mini",
      modelDigest: "digest",
      promptVersion: "v1",
      inputDigest: "input",
      fromCache: false,
      metadata: {
        omittedFiles: [],
        omittedSections: [],
      },
      result: {
        kind: "analysis",
        data: {
          summary: "The commit updates local AI progress.",
          riskAssessment: null,
          changedAreas: ["AI"],
          findings: [],
        },
      },
    };

    renderModal({
      result,
      loading: false,
      progress: [
        {
          ...baseProgress,
          state: "runningModel",
          message: "Running local model",
        },
      ],
    });

    expect(
      screen.getByText("The commit updates local AI progress."),
    ).toBeInTheDocument();
    expect(screen.queryByText("Running local model")).not.toBeInTheDocument();
  });
});
