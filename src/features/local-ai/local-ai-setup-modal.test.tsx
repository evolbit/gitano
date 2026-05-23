import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LocalAiSetupModal } from "./local-ai-setup-modal";
import { useLocalAiStore } from "./store";

const apiMocks = vi.hoisted(() => ({
  getLocalAiModelCatalog: vi.fn(),
  getExternalAiAgentCatalog: vi.fn(),
  getLocalAiEntitlementStatus: vi.fn(),
  getLocalAiModelPreferences: vi.fn(),
  getLocalAiModelStatus: vi.fn(),
  getLocalAiModelCompatibility: vi.fn(),
  prepareLocalAiModel: vi.fn(),
  setLocalAiModelPreference: vi.fn(),
  setLocalAiAnalysisEnginePreference: vi.fn(),
  listenToLocalAiProgress: vi.fn(),
}));

vi.mock("@/shared/api/local-ai", () => apiMocks);

const model = {
  id: "qwen2.5-coder:14b",
  displayName: "Qwen2.5 Coder 14B",
  provider: "Ollama",
  qualityTier: "better",
  downloadSizeGb: 9,
  contextWindow: 32768,
  actionSuitability: ["branchAnalysis"],
  minRequirements: {
    minMemoryGb: 24,
    recommendedMemoryGb: 32,
    minDiskFreeGb: 14,
    recommendedDiskFreeGb: 18,
  },
  recommendedRequirements: {
    minMemoryGb: 24,
    recommendedMemoryGb: 32,
    minDiskFreeGb: 14,
    recommendedDiskFreeGb: 18,
  },
};

const codexAgent = {
  id: "codex-acp",
  displayName: "Codex CLI",
  provider: "OpenAI",
  description: "ACP adapter for OpenAI's coding assistant",
  version: "0.14.0",
  repository: "https://github.com/zed-industries/codex-acp",
  license: "Apache-2.0",
  installSource: null,
  status: {
    agentId: "codex-acp",
    installed: true,
    authenticated: false,
    available: true,
    state: "ready",
    version: "0.14.0",
    authMethods: [],
    error: null,
  },
};

describe("LocalAiSetupModal", () => {
  beforeEach(() => {
    apiMocks.getLocalAiModelCatalog.mockResolvedValue([model]);
    apiMocks.getExternalAiAgentCatalog.mockResolvedValue([]);
    apiMocks.getLocalAiEntitlementStatus.mockResolvedValue({
      entitled: true,
      source: "developmentStub",
      reason: "dev",
    });
    apiMocks.getLocalAiModelPreferences.mockResolvedValue({
      globalModelId: "qwen2.5-coder:14b",
      actionModelIds: {},
    });
    apiMocks.getLocalAiModelStatus.mockResolvedValue({
      runtime: {
        available: true,
        endpoint: "http://127.0.0.1:11434",
        error: null,
      },
      modelId: "qwen2.5-coder:14b",
      installed: false,
      digest: null,
      sizeBytes: null,
      running: false,
      ready: false,
    });
    apiMocks.getLocalAiModelCompatibility.mockResolvedValue({
      modelId: "qwen2.5-coder:14b",
      level: "limited",
      blocking: false,
      reasons: ["This model may run slowly."],
      recommendedModelId: null,
      machine: {
        os: "macos",
        arch: "aarch64",
        cpuCount: 8,
        totalMemoryGb: 16,
        availableMemoryGb: null,
        modelStoragePath: "/models",
        modelStorageFreeDiskGb: 20,
      },
    });
    apiMocks.prepareLocalAiModel.mockResolvedValue({ operationId: "op-1" });
    apiMocks.setLocalAiModelPreference.mockResolvedValue({
      globalModelId: "qwen2.5-coder:14b",
      actionModelIds: {},
    });
    apiMocks.setLocalAiAnalysisEnginePreference.mockResolvedValue({
      globalModelId: "qwen2.5-coder:14b",
      actionModelIds: {},
      analysisEngine: { type: "local_model", modelId: "qwen2.5-coder:14b" },
      actionEngines: {},
    });
    apiMocks.listenToLocalAiProgress.mockReturnValue(Promise.resolve(() => {}));
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    useLocalAiStore.setState({
      catalog: [],
      externalAgents: [],
      entitlement: null,
      preferences: null,
      modelStatus: null,
      compatibility: null,
      progressByOperationId: {},
      progressTimelineByOperationId: {},
      activeOperationId: null,
      setupOpen: false,
      setupRequest: null,
      loading: false,
      error: null,
    });
  });

  it("shows compatibility warnings and requires explicit override", async () => {
    const user = userEvent.setup();

    render(
      <LocalAiSetupModal
        open
        actionKind="branchAnalysis"
        onClose={vi.fn()}
      />,
    );

    expect(await screen.findByText("This model may run slowly")).toBeInTheDocument();
    expect(screen.getByText("This model may run slowly.")).toBeInTheDocument();
    expect(screen.getByText(/Machine:/i)).toBeInTheDocument();
    expect(
      screen.getByText(/free in local AI model storage at \/models/i),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /download model/i })).toBeDisabled();

    await user.click(screen.getByLabelText("Continue anyway"));
    await user.click(screen.getByRole("button", { name: /download model/i }));

    expect(apiMocks.prepareLocalAiModel).toHaveBeenCalledWith({
      modelId: "qwen2.5-coder:14b",
      allowLimited: true,
    });
  });

  it("prefers a model suitable for the requested action over the global model", async () => {
    const reviewModel = {
      ...model,
      id: "qwen2.5-coder:7b",
      displayName: "Qwen2.5 Coder 7B",
      qualityTier: "recommended",
      actionSuitability: ["branchReview"],
    };
    apiMocks.getLocalAiModelCatalog.mockResolvedValue([model, reviewModel]);
    apiMocks.getLocalAiModelStatus.mockImplementation(async (modelId: string) => ({
      runtime: {
        available: true,
        endpoint: "http://127.0.0.1:11435",
        error: null,
      },
      modelId,
      installed: true,
      digest: "digest",
      sizeBytes: 4_700_000_000,
      running: false,
      ready: true,
    }));
    apiMocks.getLocalAiModelCompatibility.mockImplementation(async (modelId: string) => ({
      modelId,
      level: "compatible",
      blocking: false,
      reasons: [],
      recommendedModelId: null,
      machine: {
        os: "macos",
        arch: "aarch64",
        cpuCount: 8,
        totalMemoryGb: 16,
        availableMemoryGb: null,
        modelStoragePath: "/models",
        modelStorageFreeDiskGb: 20,
      },
    }));

    render(
      <LocalAiSetupModal
        open
        actionKind="branchReview"
        onClose={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByLabelText("Analysis engine")).toHaveValue(
        "local:qwen2.5-coder:7b",
      );
    });
  });

  it("offers ready external agents when no action engine is selected", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onReady = vi.fn();
    apiMocks.getExternalAiAgentCatalog.mockResolvedValue([codexAgent]);
    apiMocks.getLocalAiModelPreferences.mockResolvedValue({
      globalModelId: "qwen2.5-coder:14b",
      actionModelIds: {},
      analysisEngine: { type: "local_model", modelId: "qwen2.5-coder:14b" },
      actionEngines: {
        branchReview: { type: "local_model", modelId: null },
      },
    });
    apiMocks.setLocalAiAnalysisEnginePreference.mockResolvedValue({
      globalModelId: "qwen2.5-coder:14b",
      actionModelIds: {},
      analysisEngine: { type: "local_model", modelId: "qwen2.5-coder:14b" },
      actionEngines: {
        branchReview: { type: "external_agent", agentId: "codex-acp" },
      },
    });

    render(
      <LocalAiSetupModal
        open
        actionKind="branchReview"
        setupReason="No AI model selected for Branch review"
        onClose={onClose}
        onReady={onReady}
      />,
    );

    await waitFor(() => {
      expect(screen.getByLabelText("Analysis engine")).toHaveValue(
        "external:codex-acp",
      );
    });
    expect(screen.getByText("Codex CLI")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Ready" }));

    await waitFor(() => {
      expect(apiMocks.setLocalAiAnalysisEnginePreference).toHaveBeenCalledWith({
        engine: { type: "external_agent", agentId: "codex-acp" },
        actionKind: "branchReview",
      });
    });
    expect(onReady).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("offers to download the app-managed runtime before the model", async () => {
    const user = userEvent.setup();
    apiMocks.getLocalAiModelStatus.mockResolvedValue({
      runtime: {
        available: false,
        endpoint: "http://127.0.0.1:11435",
        error: "Local AI runtime is not running.",
      },
      modelId: "qwen2.5-coder:14b",
      installed: false,
      digest: null,
      sizeBytes: null,
      running: false,
      ready: false,
    });
    apiMocks.getLocalAiModelCompatibility.mockResolvedValue({
      modelId: "qwen2.5-coder:14b",
      level: "compatible",
      blocking: false,
      reasons: [],
      recommendedModelId: null,
      machine: {
        os: "macos",
        arch: "aarch64",
        cpuCount: 8,
        totalMemoryGb: 16,
        availableMemoryGb: null,
        modelStoragePath: "/models",
        modelStorageFreeDiskGb: 20,
      },
    });

    render(
      <LocalAiSetupModal
        open
        onClose={vi.fn()}
      />,
    );

    expect(await screen.findByText("Local AI setup required")).toBeInTheDocument();
    expect(
      screen.getByText(/Gitano will prepare its private local AI engine/i),
    ).toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: /download local ai/i }),
    );

    expect(
      await screen.findByText("Starting local AI setup..."),
    ).toBeInTheDocument();
    act(() => {
      useLocalAiStore.getState().markReadyIfActive({
        operationId: "op-1",
        modelId: "qwen2.5-coder:14b",
        state: "installingRuntime",
        status: "Downloading runtime...",
        completedBytes: 10,
        totalBytes: 100,
        percentage: 10,
        error: null,
      });
    });
    expect(await screen.findByText("Downloading runtime...")).toBeInTheDocument();

    act(() => {
      useLocalAiStore.getState().markReadyIfActive({
        operationId: "op-1",
        modelId: "qwen2.5-coder:14b",
        state: "downloading",
        status: "Downloading model qwen2.5-coder:14b...",
        completedBytes: 20,
        totalBytes: 100,
        percentage: 20,
        error: null,
      });
    });
    expect(
      await screen.findByText("Downloading model qwen2.5-coder:14b..."),
    ).toBeInTheDocument();
    expect(screen.getByText("Downloading runtime...")).toBeInTheDocument();
    expect(apiMocks.prepareLocalAiModel).toHaveBeenCalledWith({
      modelId: "qwen2.5-coder:14b",
      allowLimited: false,
    });
  });

  it("resumes the requested AI action when setup completes", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onReady = vi.fn();
    apiMocks.getLocalAiModelStatus.mockResolvedValue({
      runtime: {
        available: false,
        endpoint: "http://127.0.0.1:11435",
        error: "Local AI runtime is not running.",
      },
      modelId: "qwen2.5-coder:14b",
      installed: false,
      digest: null,
      sizeBytes: null,
      running: false,
      ready: false,
    });
    apiMocks.getLocalAiModelCompatibility.mockResolvedValue({
      modelId: "qwen2.5-coder:14b",
      level: "compatible",
      blocking: false,
      reasons: [],
      recommendedModelId: null,
      machine: {
        os: "macos",
        arch: "aarch64",
        cpuCount: 8,
        totalMemoryGb: 16,
        availableMemoryGb: null,
        modelStoragePath: "/models",
        modelStorageFreeDiskGb: 20,
      },
    });

    render(
      <LocalAiSetupModal
        open
        onClose={onClose}
        onReady={onReady}
      />,
    );

    expect(await screen.findByText("Local AI setup required")).toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: /download local ai/i }),
    );
    expect(
      await screen.findByText("Starting local AI setup..."),
    ).toBeInTheDocument();

    apiMocks.getLocalAiModelStatus.mockResolvedValue({
      runtime: {
        available: true,
        endpoint: "http://127.0.0.1:11435",
        error: null,
      },
      modelId: "qwen2.5-coder:14b",
      installed: true,
      digest: "digest",
      sizeBytes: 4_700_000_000,
      running: false,
      ready: true,
    });

    act(() => {
      useLocalAiStore.getState().markReadyIfActive({
        operationId: "op-1",
        modelId: "qwen2.5-coder:14b",
        state: "completed",
        status: "Model ready",
        completedBytes: null,
        totalBytes: null,
        percentage: 100,
        error: null,
      });
    });

    await waitFor(() => {
      expect(onReady).toHaveBeenCalledTimes(1);
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("saves an already-installed model for the requested action before resuming", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onReady = vi.fn();
    apiMocks.getLocalAiModelStatus.mockResolvedValue({
      runtime: {
        available: true,
        endpoint: "http://127.0.0.1:11435",
        error: null,
      },
      modelId: "qwen2.5-coder:14b",
      installed: true,
      digest: "digest",
      sizeBytes: 4_700_000_000,
      running: false,
      ready: true,
    });
    apiMocks.getLocalAiModelCompatibility.mockResolvedValue({
      modelId: "qwen2.5-coder:14b",
      level: "compatible",
      blocking: false,
      reasons: [],
      recommendedModelId: null,
      machine: {
        os: "macos",
        arch: "aarch64",
        cpuCount: 8,
        totalMemoryGb: 16,
        availableMemoryGb: null,
        modelStoragePath: "/models",
        modelStorageFreeDiskGb: 20,
      },
    });
    apiMocks.setLocalAiModelPreference.mockResolvedValue({
      globalModelId: "qwen2.5-coder:14b",
      actionModelIds: {
        branchReview: "qwen2.5-coder:14b",
      },
    });

    render(
      <LocalAiSetupModal
        open
        actionKind="branchReview"
        onClose={onClose}
        onReady={onReady}
      />,
    );

    await user.click(await screen.findByRole("button", { name: "Ready" }));

    await waitFor(() => {
      expect(apiMocks.setLocalAiModelPreference).toHaveBeenCalledWith({
        modelId: "qwen2.5-coder:14b",
        actionKind: "branchReview",
      });
    });
    expect(onReady).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
