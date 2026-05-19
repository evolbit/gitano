import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  deleteLocalAiModel,
  getLocalAiModelPreferences,
  getLocalAiRuntimeStatus,
  getLocalAiModelStatus,
  prepareLocalAiModel,
  prepareLocalAiRuntime,
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
    globalThis.localStorage.clear();
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

  it("clears action model preferences through the backend command", async () => {
    invokeCommandMock.mockResolvedValueOnce({
      globalModelId: "qwen2.5-coder:7b",
      actionModelIds: {},
    });

    await setLocalAiModelPreference({
      modelId: "",
      actionKind: "branchAnalysis",
    });

    expect(invokeCommandMock).toHaveBeenCalledWith("ai_set_model_preference", {
      request: {
        modelId: "",
        actionKind: "branchAnalysis",
      },
    });
  });

  it("clears action preferences locally when an older backend rejects the empty model", async () => {
    invokeCommandMock
      .mockRejectedValueOnce(new Error("Unsupported local AI model:"))
      .mockResolvedValueOnce({
        globalModelId: "qwen2.5-coder:7b",
        actionModelIds: {
          branchAnalysis: "qwen2.5-coder:1.5b",
        },
      });

    const preferences = await setLocalAiModelPreference({
      modelId: "",
      actionKind: "branchAnalysis",
    });

    expect(preferences.actionModelIds).not.toHaveProperty("branchAnalysis");
    expect(invokeCommandMock).toHaveBeenNthCalledWith(
      1,
      "ai_set_model_preference",
      {
        request: {
          modelId: "",
          actionKind: "branchAnalysis",
        },
      },
    );
    expect(invokeCommandMock).toHaveBeenNthCalledWith(
      2,
      "ai_get_model_preferences",
    );
  });

  it("applies locally cleared action preferences when preferences are loaded", async () => {
    invokeCommandMock
      .mockRejectedValueOnce(new Error("Unsupported local AI model:"))
      .mockResolvedValueOnce({
        globalModelId: "qwen2.5-coder:7b",
        actionModelIds: {
          branchAnalysis: "qwen2.5-coder:1.5b",
        },
      })
      .mockResolvedValueOnce({
        globalModelId: "qwen2.5-coder:7b",
        actionModelIds: {
          branchAnalysis: "qwen2.5-coder:1.5b",
          commitMessage: "phi4-mini",
        },
      });

    await setLocalAiModelPreference({
      modelId: "",
      actionKind: "branchAnalysis",
    });

    const preferences = await getLocalAiModelPreferences();

    expect(preferences.actionModelIds).toEqual({
      commitMessage: "phi4-mini",
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

  it("requests runtime status", async () => {
    invokeCommandMock.mockResolvedValueOnce({ installed: false });

    await getLocalAiRuntimeStatus();

    expect(invokeCommandMock).toHaveBeenCalledWith("ai_get_runtime_status");
  });

  it("prepares the runtime with the expected payload", async () => {
    invokeCommandMock.mockResolvedValueOnce({ operationId: "runtime-op" });

    await prepareLocalAiRuntime({ forceReinstall: true });

    expect(invokeCommandMock).toHaveBeenCalledWith("ai_prepare_runtime", {
      request: {
        forceReinstall: true,
      },
    });
  });

  it("deletes models through the backend command", async () => {
    invokeCommandMock.mockResolvedValueOnce(undefined);

    await deleteLocalAiModel("qwen2.5-coder:1.5b");

    expect(invokeCommandMock).toHaveBeenCalledWith("ai_delete_model", {
      modelId: "qwen2.5-coder:1.5b",
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
