import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getLocalAiModelStatus,
  prepareLocalAiModel,
  runLocalAiAction,
  setLocalAiModelPreference,
} from "./local-ai";

const invokeCommandMock = vi.hoisted(() => vi.fn());

vi.mock("@/shared/platform/tauri/command", () => ({
  invokeCommand: invokeCommandMock,
}));

vi.mock("@/shared/platform/tauri/events", () => ({
  listenToEvent: vi.fn(),
}));

describe("local AI API", () => {
  beforeEach(() => {
    invokeCommandMock.mockReset();
  });

  it("requests model status with the expected payload", async () => {
    invokeCommandMock.mockResolvedValueOnce({ ready: false });

    await getLocalAiModelStatus("qwen2.5-coder:7b");

    expect(invokeCommandMock).toHaveBeenCalledWith("ai_get_model_status", {
      modelId: "qwen2.5-coder:7b",
    });
  });

  it("sets model preferences through the backend command", async () => {
    invokeCommandMock.mockResolvedValueOnce({
      globalModelId: "qwen2.5-coder:7b",
      actionModelIds: {},
    });

    await setLocalAiModelPreference({
      modelId: "qwen2.5-coder:14b",
      actionKind: "branchAnalysis",
    });

    expect(invokeCommandMock).toHaveBeenCalledWith("ai_set_model_preference", {
      request: {
        modelId: "qwen2.5-coder:14b",
        actionKind: "branchAnalysis",
      },
    });
  });

  it("prepares models with the expected payload", async () => {
    invokeCommandMock.mockResolvedValueOnce({ operationId: "op-1" });

    await prepareLocalAiModel({
      modelId: "qwen2.5-coder:7b",
      allowLimited: true,
    });

    expect(invokeCommandMock).toHaveBeenCalledWith("ai_prepare_model", {
      request: {
        modelId: "qwen2.5-coder:7b",
        allowLimited: true,
      },
    });
  });

  it("runs local AI actions with stable request shape", async () => {
    invokeCommandMock.mockResolvedValueOnce({ fromCache: false });

    await runLocalAiAction({
      repoPath: "/repo",
      actionKind: "commitAnalysis",
      commitSha: "abc123",
      forceRefresh: true,
    });

    expect(invokeCommandMock).toHaveBeenCalledWith("ai_run_action", {
      request: {
        repoPath: "/repo",
        actionKind: "commitAnalysis",
        commitSha: "abc123",
        forceRefresh: true,
      },
    });
  });
});
