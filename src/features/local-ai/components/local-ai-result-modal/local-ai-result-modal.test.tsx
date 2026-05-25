import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type {
  ExternalAiRunEvent,
  LocalAiRunProgress,
  LocalAiRunResult,
} from "@/shared/api/local-ai";
import { LocalAiResultModal } from "./local-ai-result-modal";

const baseProgress = {
  runId: "run-1",
  actionKind: "commitAnalysis",
  error: null,
} satisfies Pick<LocalAiRunProgress, "runId" | "actionKind" | "error">;

const baseExternalEvent = {
  runId: "run-1",
  actionKind: "branchReview",
  agentId: "codex-acp",
  raw: null,
} satisfies Pick<
  ExternalAiRunEvent,
  "runId" | "actionKind" | "agentId" | "raw"
>;

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

  it("scrolls the modal body as progress messages become visible", () => {
    vi.useFakeTimers();

    renderModal({
      loading: true,
      progress: [
        {
          ...baseProgress,
          state: "runningModel",
          message: "Running external agent",
        },
        {
          ...baseProgress,
          state: "runningModel",
          message: "Reading more files",
        },
      ],
    });

    const body = screen.getByTestId("local-ai-result-modal-body");
    Object.defineProperty(body, "scrollHeight", {
      configurable: true,
      value: 640,
    });
    body.scrollTop = 0;

    act(() => {
      vi.advanceTimersByTime(400);
    });

    expect(body.scrollTop).toBe(640);
    expect(screen.getByText(/Reading more files/)).toBeInTheDocument();
  });

  it("collapses long progress rows with ellipsis and wraps when expanded", () => {
    renderModal({
      loading: true,
      progress: [
        {
          ...baseProgress,
          state: "checkingCache",
          message:
            "completed {\"aggregated_output\":\"src/features/local-ai/local-ai-result-modal.tsx changed with a very long line that should not force horizontal scrolling\"}",
        },
      ],
    });

    const body = screen.getByTestId("local-ai-result-modal-body");
    const rowMessage = screen.getByTestId("progress-row-message");
    const rowButton = rowMessage.closest("button");

    expect(body).toHaveClass("overflow-x-hidden");
    expect(rowButton).toHaveAttribute("aria-expanded", "false");
    expect(rowMessage.firstElementChild).toHaveClass("truncate");

    fireEvent.click(rowButton!);

    expect(rowButton).toHaveAttribute("aria-expanded", "true");
    expect(rowMessage.firstElementChild).toHaveClass(
      "whitespace-pre-wrap",
      "break-words",
    );
  });

  it("uses the progress timeline for external agent events while loading", () => {
    vi.useFakeTimers();

    renderModal({
      loading: true,
      progress: [
        {
          ...baseProgress,
          state: "runningModel",
          message: "Running external agent",
        },
        {
          ...baseProgress,
          state: "runningModel",
          message: "Reading the comparison",
        },
        {
          ...baseProgress,
          state: "runningModel",
          message: "Read src/app.ts (completed)",
        },
      ],
      externalEvents: [
        {
          ...baseExternalEvent,
          kind: "thought",
          message: "Reading the comparison",
        },
        {
          ...baseExternalEvent,
          kind: "toolCall",
          message: "Read src/app.ts (completed)",
        },
        {
          ...baseExternalEvent,
          kind: "text",
          message: "{\"summary\":\"",
        },
        {
          ...baseExternalEvent,
          kind: "text",
          message: "Done\"}",
        },
      ],
    });

    expect(screen.getByText("External Agent")).toBeInTheDocument();
    expect(screen.getByText(/Running external agent/)).toBeInTheDocument();
    expect(screen.queryByText("Reading the comparison")).not.toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(400);
    });

    expect(screen.getByText(/Reading the comparison/)).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(400);
    });

    expect(screen.getByText(/Read src\/app\.ts \(completed\)/)).toBeInTheDocument();
    expect(screen.queryByText('{"summary":"Done"}')).not.toBeInTheDocument();
    expect(
      screen.queryByText(
        "Local models can take longer the first time they wake up.",
      ),
    ).not.toBeInTheDocument();
  });

  it("falls back to external events when progress has not arrived", () => {
    renderModal({
      loading: true,
      externalEvents: [
        {
          ...baseExternalEvent,
          kind: "toolCall",
          message: "git diff --stat (in_progress)",
        },
      ],
    });

    expect(screen.getByText("External Agent")).toBeInTheDocument();
    expect(screen.getByText(/git diff --stat/)).toBeInTheDocument();
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

  it("summarizes reportable error payloads in the modal", () => {
    renderModal({
      error:
        "External agent output could not be parsed. Report this debug payload:\n{\n  \"kind\": \"external_agent_structured_output_error\"\n}",
    });

    const errorPayload = screen.getByText(/External agent output could not be parsed/);

    expect(screen.getByText("AI action failed")).toBeInTheDocument();
    expect(errorPayload.tagName).toBe("PRE");
    expect(errorPayload).toHaveClass("whitespace-pre-wrap", "break-words");
    expect(
      screen.getByText(/See log for more details/),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/external_agent_structured_output_error/),
    ).not.toBeInTheDocument();
  });

  it("renders omitted context metadata", () => {
    const result: LocalAiRunResult = {
      actionKind: "branchReview",
      modelId: "phi4-mini",
      modelDigest: "digest",
      promptVersion: "v1",
      inputDigest: "input",
      fromCache: false,
      metadata: {
        omittedFiles: ["src/large-file.ts"],
        omittedSections: [
          "Prompt context was truncated to fit the selected model budget.",
        ],
      },
      result: {
        kind: "branchReview",
        data: {
          summary: "No actionable changed-code risks were found.",
          findings: [],
          notes: [],
        },
      },
    };

    renderModal({ result });

    expect(
      screen.getByText("Some context was omitted or truncated."),
    ).toBeInTheDocument();
    expect(screen.getByText("Omitted file: src/large-file.ts")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Prompt context was truncated to fit the selected model budget.",
      ),
    ).toBeInTheDocument();
  });
});
