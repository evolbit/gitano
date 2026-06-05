import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  deleteLocalAiModel,
  authenticateExternalAiAgent,
  cancelExternalAiRun,
  getExternalAiAgentCatalog,
  getExternalAiAgentSessionConfig,
  installExternalAiAgent,
  getLocalAiModelPreferences,
  getLocalAiRuntimeStatus,
  getLocalAiModelStatus,
  listenToExternalAiAgentProgress,
  listenToExternalAiRunEvents,
  listenToLocalAiRunProgress,
  prepareLocalAiModel,
  prepareLocalAiRuntime,
  removeExternalAiAgent,
  runExternalAiPrompt,
  runLocalAiAction,
  setExternalAiAgentAsDefault,
  setExternalAiAgentConfigPreference,
  setLocalAiActionPromptOverride,
  setLocalAiAnalysisEnginePreference,
  setLocalAiModelPreference,
  setLocalAiModelWarmPreference,
  warmConfiguredLocalAiModels,
} from "./local-ai";

const invokeCommandMock = vi.hoisted(() => vi.fn());
const listenToEventMock = vi.hoisted(() => vi.fn());

vi.mock("@/shared/platform/tauri/command", () => ({
  invokeCommand: invokeCommandMock,
}));

vi.mock("@/shared/platform/tauri/events", () => ({
  listenToEvent: listenToEventMock,
}));

describe("local AI API", () => {
  beforeEach(() => {
    invokeCommandMock.mockReset();
    listenToEventMock.mockReset();
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
      warmModelIds: [],
      keepAliveMinutes: 30,
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
      warmModelIds: [],
      keepAliveMinutes: 30,
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

  it("sets analysis engine preferences through the backend command", async () => {
    invokeCommandMock.mockResolvedValueOnce({
      globalModelId: "",
      actionModelIds: {},
      analysisEngine: {
        type: "external_agent",
        agentId: "codex-acp",
      },
      actionEngines: {},
      warmModelIds: [],
      keepAliveMinutes: 30,
    });

    const preferences = await setLocalAiAnalysisEnginePreference({
      engine: {
        type: "external_agent",
        agentId: "codex-acp",
      },
    });

    expect(preferences.analysisEngine).toEqual({
      type: "external_agent",
      agentId: "codex-acp",
    });
    expect(invokeCommandMock).toHaveBeenCalledWith(
      "ai_set_analysis_engine_preference",
      {
        request: {
          engine: {
            type: "external_agent",
            agentId: "codex-acp",
          },
          actionKind: null,
        },
      },
    );
  });

  it("clears action preferences locally when an older backend rejects the empty model", async () => {
    invokeCommandMock
      .mockRejectedValueOnce(new Error("Unsupported local AI model:"))
      .mockResolvedValueOnce({
        globalModelId: "qwen2.5-coder:7b",
        actionModelIds: {
          branchAnalysis: "qwen2.5-coder:1.5b",
        },
        warmModelIds: [],
        keepAliveMinutes: 30,
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
        warmModelIds: [],
        keepAliveMinutes: 30,
      })
      .mockResolvedValueOnce({
        globalModelId: "qwen2.5-coder:7b",
        actionModelIds: {
          branchAnalysis: "qwen2.5-coder:1.5b",
          commitMessage: "phi4-mini",
        },
        warmModelIds: [],
        keepAliveMinutes: 30,
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

  it("loads external agent catalog through the backend command", async () => {
    invokeCommandMock.mockResolvedValueOnce([]);

    await getExternalAiAgentCatalog();

    expect(invokeCommandMock).toHaveBeenCalledWith(
      "ai_get_external_agent_catalog",
    );
  });

  it("sends external agent install requests through the backend command", async () => {
    invokeCommandMock.mockResolvedValueOnce({ operationId: "agent-op" });

    await installExternalAiAgent({ agentId: "codex-acp" });

    expect(invokeCommandMock).toHaveBeenCalledWith(
      "ai_install_external_agent",
      {
        request: {
          agentId: "codex-acp",
        },
      },
    );
  });

  it("removes external agents through the backend command", async () => {
    invokeCommandMock.mockResolvedValueOnce(undefined);

    await removeExternalAiAgent({ agentId: "codex-acp" });

    expect(invokeCommandMock).toHaveBeenCalledWith(
      "ai_remove_external_agent",
      {
        request: {
          agentId: "codex-acp",
        },
      },
    );
  });

  it("sets external agents as the default analysis engine", async () => {
    invokeCommandMock.mockResolvedValueOnce({
      globalModelId: "",
      actionModelIds: {},
      analysisEngine: {
        type: "external_agent",
        agentId: "codex-acp",
      },
      actionEngines: {},
      warmModelIds: [],
      keepAliveMinutes: 30,
    });

    await setExternalAiAgentAsDefault({ agentId: "codex-acp" });

    expect(invokeCommandMock).toHaveBeenCalledWith(
      "ai_set_external_agent_as_default",
      {
        request: {
          agentId: "codex-acp",
        },
      },
    );
  });

  it("discovers external agent session config through the backend command", async () => {
    invokeCommandMock.mockResolvedValueOnce({
      agentId: "codex-acp",
      options: [],
    });

    await getExternalAiAgentSessionConfig({
      agentId: "codex-acp",
      repoPath: "/repo",
    });

    expect(invokeCommandMock).toHaveBeenCalledWith(
      "ai_get_external_agent_session_config",
      {
        request: {
          agentId: "codex-acp",
          repoPath: "/repo",
        },
      },
    );
  });

  it("persists external agent config preferences through the backend command", async () => {
    invokeCommandMock.mockResolvedValueOnce({
      globalModelId: "",
      actionModelIds: {},
      analysisEngine: {
        type: "external_agent",
        agentId: "codex-acp",
      },
      actionEngines: {},
      externalAgentOptionValues: {},
      actionExternalAgentOptionValues: {
        branchReview: {
          "codex-acp": {
            model: "gpt-5.5",
          },
        },
      },
      warmModelIds: [],
      keepAliveMinutes: 30,
    });

    const preferences = await setExternalAiAgentConfigPreference({
      agentId: "codex-acp",
      actionKind: "branchReview",
      configId: "model",
      value: "gpt-5.5",
    });

    expect(
      preferences.actionExternalAgentOptionValues?.branchReview?.[
        "codex-acp"
      ]?.model,
    ).toBe("gpt-5.5");
    expect(invokeCommandMock).toHaveBeenCalledWith(
      "ai_set_external_agent_config_preference",
      {
        request: {
          agentId: "codex-acp",
          actionKind: "branchReview",
          configId: "model",
          value: "gpt-5.5",
        },
      },
    );
  });

  it("persists action prompt overrides through the backend command", async () => {
    invokeCommandMock.mockResolvedValueOnce({
      globalModelId: "",
      actionModelIds: {},
      analysisEngine: {
        type: "local_model",
        modelId: null,
      },
      actionEngines: {},
      externalAgentOptionValues: {},
      actionExternalAgentOptionValues: {},
      actionPromptOverrides: {
        branchReview: "Focus on security risks.",
      },
      warmModelIds: [],
      keepAliveMinutes: 30,
    });

    const preferences = await setLocalAiActionPromptOverride({
      actionKind: "branchReview",
      prompt: "Focus on security risks.",
    });

    expect(preferences.actionPromptOverrides?.branchReview).toBe(
      "Focus on security risks.",
    );
    expect(invokeCommandMock).toHaveBeenCalledWith(
      "ai_set_action_prompt_override",
      {
        request: {
          actionKind: "branchReview",
          prompt: "Focus on security risks.",
        },
      },
    );
  });

  it("authenticates external agents through the backend command", async () => {
    invokeCommandMock.mockResolvedValueOnce({ agentId: "codex-acp" });

    await authenticateExternalAiAgent({ agentId: "codex-acp" });

    expect(invokeCommandMock).toHaveBeenCalledWith(
      "ai_authenticate_external_agent",
      {
        request: {
          agentId: "codex-acp",
        },
      },
    );
  });

  it("runs external agent prompts through the backend command", async () => {
    invokeCommandMock.mockResolvedValueOnce({
      agentId: "codex-acp",
      stopReason: "end_turn",
      transcript: "Done",
    });

    await runExternalAiPrompt({
      agentId: "codex-acp",
      repoPath: "/repo",
      runId: "run-1",
      actionKind: "branchAnalysis",
      prompt: "Analyze this branch",
    });

    expect(invokeCommandMock).toHaveBeenCalledWith(
      "ai_run_external_agent_prompt",
      {
        request: {
          agentId: "codex-acp",
          repoPath: "/repo",
          runId: "run-1",
          actionKind: "branchAnalysis",
          prompt: "Analyze this branch",
        },
      },
    );
  });

  it("cancels external agent runs through the backend command", async () => {
    invokeCommandMock.mockResolvedValueOnce(undefined);

    await cancelExternalAiRun({ runId: "run-1" });

    expect(invokeCommandMock).toHaveBeenCalledWith(
      "ai_cancel_external_agent_run",
      {
        request: {
          runId: "run-1",
        },
      },
    );
  });

  it("sets warm model preferences through the backend command", async () => {
    invokeCommandMock.mockResolvedValueOnce({
      globalModelId: "qwen2.5-coder:7b",
      actionModelIds: {},
      warmModelIds: ["phi4-mini"],
      keepAliveMinutes: 30,
    });

    await setLocalAiModelWarmPreference({
      modelId: " phi4-mini ",
      warm: true,
    });

    expect(invokeCommandMock).toHaveBeenCalledWith(
      "ai_set_model_warm_preference",
      {
        request: {
          modelId: "phi4-mini",
          warm: true,
        },
      },
    );
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

  it("requests configured model warmup", async () => {
    invokeCommandMock.mockResolvedValueOnce({
      warmedModelIds: ["phi4-mini"],
      failures: [],
    });

    await warmConfiguredLocalAiModels();

    expect(invokeCommandMock).toHaveBeenCalledWith(
      "ai_warm_configured_models",
    );
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

  it("runs scoped conflict AI actions with candidate scope", async () => {
    invokeCommandMock.mockResolvedValueOnce({ fromCache: false });

    await runLocalAiAction({
      repoPath: "/repo",
      actionKind: "mergeConflictSuggestions",
      conflictScope: {
        kind: "region",
        filePath: "src/conflict.ts",
        regionId: "conflict-1",
      },
    });

    expect(invokeCommandMock).toHaveBeenCalledWith("ai_run_action", {
      request: {
        repoPath: "/repo",
        actionKind: "mergeConflictSuggestions",
        conflictScope: {
          kind: "region",
          filePath: "src/conflict.ts",
          regionId: "conflict-1",
        },
      },
    });
  });

  it("listens to local AI run progress events", () => {
    const handler = vi.fn();
    const progress = {
      runId: "run-1",
      actionKind: "commitAnalysis",
      state: "runningModel",
      message: "Running local model",
      error: null,
    } as const;

    listenToLocalAiRunProgress(handler);

    expect(listenToEventMock).toHaveBeenCalledWith(
      "local-ai-run-progress",
      expect.any(Function),
    );

    const listener = listenToEventMock.mock.calls[0][1];
    listener({ payload: progress });

    expect(handler).toHaveBeenCalledWith(progress);
  });

  it("listens to external agent progress events", () => {
    const handler = vi.fn();
    const progress = {
      operationId: "agent-op",
      agentId: "codex-acp",
      state: "completed",
      status: "External agent ready",
      completedBytes: null,
      totalBytes: null,
      percentage: 100,
      error: null,
    } as const;

    listenToExternalAiAgentProgress(handler);

    expect(listenToEventMock).toHaveBeenCalledWith(
      "external-ai-agent-progress",
      expect.any(Function),
    );

    const listener = listenToEventMock.mock.calls[0][1];
    listener({ payload: progress });

    expect(handler).toHaveBeenCalledWith(progress);
  });

  it("listens to external agent run events", () => {
    const handler = vi.fn();
    const runEvent = {
      runId: "run-1",
      actionKind: "branchAnalysis",
      agentId: "codex-acp",
      kind: "text",
      message: "Analyzing",
      raw: null,
    } as const;

    listenToExternalAiRunEvents(handler);

    expect(listenToEventMock).toHaveBeenCalledWith(
      "external-ai-run-event",
      expect.any(Function),
    );

    const listener = listenToEventMock.mock.calls[0][1];
    listener({ payload: runEvent });

    expect(handler).toHaveBeenCalledWith(runEvent);
  });
});
