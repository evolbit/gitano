import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CommitListItem } from "@/shared/types/git";
import {
  shouldOpenCommitAiSetup,
  useCommitAiAnalysis,
} from "./use-commit-ai-analysis";

const localAiMocks = vi.hoisted(() => ({
  listenToExternalAiRunEvents: vi.fn(),
  listenToLocalAiRunProgress: vi.fn(),
  runLocalAiAction: vi.fn(),
}));

vi.mock("@/shared/api/local-ai", () => localAiMocks);

const commit: CommitListItem = {
  sha: "48ef742c24ccc21d93c724fbefe0c2255c9451aa",
  message: "Test commit",
  author: "Marco",
  author_initial: "M",
  date: 1,
  current_branch: "main",
  source_branch: "main",
  commit_history: [],
  files: 1,
};

describe("shouldOpenCommitAiSetup", () => {
  it("detects setup-related local AI failures", () => {
    expect(
      shouldOpenCommitAiSetup(new Error("LOCAL_AI_MODEL_SETUP_REQUIRED")),
    ).toBe(true);
    expect(shouldOpenCommitAiSetup(new Error("Ollama is not running"))).toBe(
      true,
    );
    expect(
      shouldOpenCommitAiSetup(
        new Error("Local AI returned invalid JSON: expected value"),
      ),
    ).toBe(false);
    expect(shouldOpenCommitAiSetup(new Error("network failed"))).toBe(false);
  });
});

describe("useCommitAiAnalysis", () => {
  beforeEach(() => {
    localAiMocks.listenToExternalAiRunEvents.mockReset();
    localAiMocks.listenToLocalAiRunProgress.mockReset();
    localAiMocks.runLocalAiAction.mockReset();
    localAiMocks.listenToExternalAiRunEvents.mockResolvedValue(vi.fn());
    localAiMocks.listenToLocalAiRunProgress.mockResolvedValue(vi.fn());
  });

  it("keeps the result modal open with the original failure for compact display", async () => {
    const notifyError = vi.fn();
    const error = new Error(
      "External agent failed before returning a structured result:\nError: You are not authorized to use this Copilot feature.",
    );
    localAiMocks.runLocalAiAction.mockRejectedValueOnce(
      error,
    );
    const { result } = renderHook(() =>
      useCommitAiAnalysis({ repoPath: "/repo", notifyError }),
    );

    await act(async () => {
      await result.current.runCommitAiAnalysis(commit);
    });

    expect(notifyError).toHaveBeenCalledWith(
      "AI analysis failed",
      expect.any(Error),
    );
    expect(result.current.commitAiAnalysis?.error).toBe(error.message);
    expect(result.current.commitAiAnalysis?.setupOpen).toBe(false);
  });

  it("keeps setup failures in the setup flow", async () => {
    const notifyError = vi.fn();
    localAiMocks.runLocalAiAction.mockRejectedValueOnce(
      new Error("LOCAL_AI_MODEL_SETUP_REQUIRED"),
    );
    const { result } = renderHook(() =>
      useCommitAiAnalysis({ repoPath: "/repo", notifyError }),
    );

    await act(async () => {
      await result.current.runCommitAiAnalysis(commit);
    });

    expect(notifyError).not.toHaveBeenCalled();
    expect(result.current.commitAiAnalysis?.setupOpen).toBe(true);
    expect(result.current.commitAiAnalysis?.error).toBeNull();
  });
});
