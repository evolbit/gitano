import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ACTION_MODEL_REQUIRED_MESSAGE } from "../../constants";
import { SettingsWindow } from "./settings-window";

const apiMocks = vi.hoisted(() => ({
  authenticateExternalAiAgent: vi.fn(),
  deleteLocalAiModel: vi.fn(),
  getExternalAiAgentCatalog: vi.fn(),
  getExternalAiAgentSessionConfig: vi.fn(),
  getLocalAiEntitlementStatus: vi.fn(),
  getLocalAiMachineProfile: vi.fn(),
  getLocalAiModelCatalog: vi.fn(),
  getLocalAiModelPreferences: vi.fn(),
  getLocalAiModelStatus: vi.fn(),
  getLocalAiRuntimeStatus: vi.fn(),
  installExternalAiAgent: vi.fn(),
  listenToExternalAiAgentProgress: vi.fn(),
  listenToLocalAiProgress: vi.fn(),
  prepareLocalAiModel: vi.fn(),
  prepareLocalAiRuntime: vi.fn(),
  removeExternalAiAgent: vi.fn(),
  setExternalAiAgentAsDefault: vi.fn(),
  setExternalAiAgentConfigPreference: vi.fn(),
  setLocalAiActionPromptOverride: vi.fn(),
  setLocalAiAnalysisEnginePreference: vi.fn(),
  setLocalAiModelPreference: vi.fn(),
  setLocalAiModelWarmPreference: vi.fn(),
  warmConfiguredLocalAiModels: vi.fn(),
}));

vi.mock("@/shared/api/local-ai", () => apiMocks);

const models = [
  {
    id: "qwen2.5-coder:1.5b",
    displayName: "Qwen2.5 Coder 1.5B",
    provider: "Ollama",
    qualityTier: "fast",
    downloadSizeGb: 1,
    contextWindow: 32768,
    actionSuitability: ["commitMessage"],
    warmMemoryEstimateGb: 2,
    warmMemoryClass: "small",
    minRequirements: {
      minMemoryGb: 4,
      recommendedMemoryGb: 8,
      minDiskFreeGb: 2,
      recommendedDiskFreeGb: 4,
    },
    recommendedRequirements: {
      minMemoryGb: 8,
      recommendedMemoryGb: 8,
      minDiskFreeGb: 2,
      recommendedDiskFreeGb: 4,
    },
  },
  {
    id: "qwen2.5-coder:7b",
    displayName: "Qwen2.5 Coder 7B",
    provider: "Ollama",
    qualityTier: "recommended",
    downloadSizeGb: 4.7,
    contextWindow: 32768,
    actionSuitability: ["commitMessage", "branchAnalysis"],
    warmMemoryEstimateGb: 7,
    warmMemoryClass: "medium",
    minRequirements: {
      minMemoryGb: 12,
      recommendedMemoryGb: 16,
      minDiskFreeGb: 8,
      recommendedDiskFreeGb: 10,
    },
    recommendedRequirements: {
      minMemoryGb: 16,
      recommendedMemoryGb: 16,
      minDiskFreeGb: 8,
      recommendedDiskFreeGb: 10,
    },
  },
];

const legacyModels = models.map(
  ({ warmMemoryEstimateGb: _warmMemoryEstimateGb, warmMemoryClass: _warmMemoryClass, ...model }) =>
    model,
);

const codexAgent = {
  id: "codex-acp",
  displayName: "Codex CLI",
  provider: "OpenAI",
  description: "ACP adapter for Codex",
  version: "0.14.0",
  repository: "https://github.com/zed-industries/codex-acp",
  license: "Apache-2.0",
  installSource: {
    kind: "binary",
    package: null,
    archive:
      "https://github.com/zed-industries/codex-acp/releases/download/v0.14.0/codex-acp-0.14.0-aarch64-apple-darwin.tar.gz",
    command: ["./codex-acp"],
  },
  status: {
    agentId: "codex-acp",
    installed: true,
    authenticated: true,
    available: true,
    state: "ready",
    version: "0.14.0",
    authMethods: [{ id: "chatgpt", displayName: "ChatGPT account" }],
    error: null,
  },
};

const geminiAgent = {
  id: "gemini",
  displayName: "Gemini CLI",
  provider: "Google",
  description: "ACP adapter for Gemini",
  version: "0.43.0",
  repository: "https://github.com/google-gemini/gemini-cli",
  license: "Apache-2.0",
  installSource: {
    kind: "npx",
    package: "@google/gemini-cli@0.43.0",
    archive: null,
    command: [
      "npm",
      "exec",
      "--yes",
      "--",
      "@google/gemini-cli@0.0.0 - 0.43.0",
      "--acp",
    ],
  },
  status: {
    agentId: "gemini",
    installed: false,
    authenticated: false,
    available: false,
    state: "notInstalled",
    version: null,
    error:
      "npm is required to run the Gemini CLI ACP adapter package `@google/gemini-cli@0.43.0`.",
  },
};

const copilotAgent = {
  id: "github-copilot-cli",
  displayName: "GitHub Copilot",
  provider: "GitHub",
  description: "GitHub's official coding agent CLI",
  version: "1.0.51",
  repository: "https://github.com/github/copilot-cli",
  license: "proprietary",
  installSource: {
    kind: "npx",
    package: "@github/copilot@1.0.51",
    archive: null,
    command: [
      "npm",
      "exec",
      "--yes",
      "--",
      "@github/copilot@0.0.0 - 1.0.51",
      "--acp",
    ],
  },
  status: {
    agentId: "github-copilot-cli",
    installed: true,
    authenticated: false,
    available: true,
    state: "ready",
    version: "1.0.51",
    authMethods: [
      { id: "github_copilot_cli", displayName: "GitHub Copilot account" },
      { id: "github_token", displayName: "GITHUB_TOKEN" },
      { id: "gh_token", displayName: "GH_TOKEN" },
    ],
    error: null,
  },
};

const externalAgents = [codexAgent, geminiAgent, copilotAgent];

const codexModelConfig = {
  agentId: "codex-acp",
  options: [
    {
      id: "model",
      name: "Model",
      description: "Model used by the agent.",
      category: "model",
      type: "select",
      currentValue: "gpt-5.5",
      options: [
        {
          value: "gpt-5.5",
          name: "GPT-5.5",
          description: null,
        },
        {
          value: "gpt-5",
          name: "GPT-5",
          description: null,
        },
      ],
    },
  ],
};

const copilotModelConfig = {
  agentId: "github-copilot-cli",
  options: [
    {
      id: "model",
      name: "Model",
      description: "Model used by Copilot.",
      category: "model",
      type: "select",
      currentValue: "copilot-sonnet",
      options: [
        {
          value: "copilot-sonnet",
          name: "Copilot Sonnet",
          description: null,
        },
        {
          value: "copilot-gpt",
          name: "Copilot GPT",
          description: null,
        },
      ],
    },
  ],
};

describe("SettingsWindow", () => {
  beforeEach(() => {
    Object.values(apiMocks).forEach((mock) => mock.mockReset());
    apiMocks.getLocalAiModelCatalog.mockResolvedValue(models);
    apiMocks.getExternalAiAgentCatalog.mockResolvedValue(externalAgents);
    apiMocks.getExternalAiAgentSessionConfig.mockResolvedValue(codexModelConfig);
    apiMocks.getLocalAiModelPreferences.mockResolvedValue({
      globalModelId: "qwen2.5-coder:7b",
      actionModelIds: {
        commitMessage: "qwen2.5-coder:1.5b",
      },
      analysisEngine: {
        type: "local_model",
        modelId: "qwen2.5-coder:7b",
      },
      actionEngines: {
        commitMessage: {
          type: "local_model",
          modelId: "qwen2.5-coder:1.5b",
        },
      },
      warmModelIds: [],
      keepAliveMinutes: 30,
    });
    apiMocks.getLocalAiEntitlementStatus.mockResolvedValue({
      entitled: true,
      source: "developmentStub",
      reason: null,
    });
    apiMocks.getLocalAiRuntimeStatus.mockResolvedValue({
      runtime: {
        available: true,
        endpoint: "http://127.0.0.1:11435",
        error: null,
      },
      managed: true,
      installed: true,
      installedVersion: "ollama version is 0.5.13",
      latestCompatibleVersion: "Latest compatible",
      modelStoragePath: "/models",
      canInstall: true,
    });
    apiMocks.getLocalAiMachineProfile.mockResolvedValue({
      os: "macos",
      arch: "aarch64",
      cpuCount: 10,
      totalMemoryGb: 16,
      availableMemoryGb: null,
      modelStoragePath: "/models",
      modelStorageFreeDiskGb: 100,
    });
    apiMocks.getLocalAiModelStatus.mockImplementation(async (modelId: string) => ({
      runtime: {
        available: true,
        endpoint: "http://127.0.0.1:11435",
        error: null,
      },
      modelId,
      installed: modelId === "qwen2.5-coder:7b",
      digest: modelId === "qwen2.5-coder:7b" ? "digest" : null,
      sizeBytes: modelId === "qwen2.5-coder:7b" ? 4_700_000_000 : null,
      running: false,
      ready: modelId === "qwen2.5-coder:7b",
    }));
    apiMocks.listenToExternalAiAgentProgress.mockReturnValue(
      Promise.resolve(() => {}),
    );
    apiMocks.listenToLocalAiProgress.mockReturnValue(Promise.resolve(() => {}));
    apiMocks.warmConfiguredLocalAiModels.mockResolvedValue({
      warmedModelIds: [],
      failures: [],
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("opens on runtime settings and exposes runtime upgrade", async () => {
    render(
      <SettingsWindow
        open
        onClose={vi.fn()}
      />,
    );

    expect(await screen.findByText("Local Runtime")).toBeInTheDocument();
    expect(screen.getByText("ollama version is 0.5.13")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /upgrade runtime/i }),
    ).toBeEnabled();
  });

  it("shows model download and delete actions", async () => {
    const user = userEvent.setup();
    render(
      <SettingsWindow
        open
        onClose={vi.fn()}
      />,
    );

    await user.click(await screen.findByRole("button", { name: "Local Models" }));

    expect(screen.getByText("Qwen2.5 Coder 1.5B")).toBeInTheDocument();
    expect(screen.getByText(/Medium warm, about 7GB/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /download/i })).toBeEnabled();
    expect(screen.getByRole("button", { name: /delete/i })).toBeEnabled();
  });

  it("renders legacy model catalog entries without warm metadata", async () => {
    const user = userEvent.setup();
    apiMocks.getLocalAiModelCatalog.mockResolvedValueOnce(legacyModels);

    render(
      <SettingsWindow
        open
        onClose={vi.fn()}
      />,
    );

    await user.click(await screen.findByRole("button", { name: "Local Models" }));

    expect(screen.getAllByText(/Warm memory unavailable/).length).toBeGreaterThan(0);
    expect(
      screen.getAllByText("Restart Gitano to enable warmup for this model.").length,
    ).toBeGreaterThan(0);
    const warmCheckboxes = screen.getAllByLabelText("Keep this model warm");
    expect(warmCheckboxes[1]).toBeDisabled();
  });

  it("confirms before enabling warmup when memory crosses the threshold", async () => {
    const user = userEvent.setup();
    apiMocks.setLocalAiModelWarmPreference.mockResolvedValue({
      globalModelId: "qwen2.5-coder:7b",
      actionModelIds: {
        commitMessage: "qwen2.5-coder:1.5b",
      },
      warmModelIds: ["qwen2.5-coder:7b"],
      keepAliveMinutes: 30,
    });

    render(
      <SettingsWindow
        open
        onClose={vi.fn()}
      />,
    );

    await user.click(await screen.findByRole("button", { name: "Local Models" }));
    const warmCheckboxes = await screen.findAllByLabelText(
      "Keep this model warm",
    );
    await user.click(warmCheckboxes[1]);

    expect(await screen.findByText("Keep model warm?")).toBeInTheDocument();
    expect(screen.getByText(/Estimated warm memory: 7GB/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Continue" }));

    expect(apiMocks.setLocalAiModelWarmPreference).toHaveBeenCalledWith({
      modelId: "qwen2.5-coder:7b",
      warm: true,
    });
    await waitFor(() => {
      expect(apiMocks.warmConfiguredLocalAiModels).toHaveBeenCalled();
    });
  });

  it("warns when an action-specific selected model is not downloaded", async () => {
    const user = userEvent.setup();
    render(
      <SettingsWindow
        open
        onClose={vi.fn()}
      />,
    );

    await user.click(
      await screen.findByRole("button", { name: "Configuration" }),
    );

    await waitFor(() => {
      expect(
        screen.getAllByText(ACTION_MODEL_REQUIRED_MESSAGE).length,
      ).toBeGreaterThan(0);
    });
  });

  it("shows an unset placeholder for actions without a configured model", async () => {
    const user = userEvent.setup();
    render(
      <SettingsWindow
        open
        onClose={vi.fn()}
      />,
    );

    await user.click(
      await screen.findByRole("button", { name: "Configuration" }),
    );

    expect(screen.getByLabelText("Branch review analysis engine")).toHaveValue("");
  });

  it("clears an action-specific model when the unset placeholder is selected", async () => {
    const user = userEvent.setup();
    apiMocks.setLocalAiModelPreference.mockResolvedValue({
      globalModelId: "qwen2.5-coder:7b",
      actionModelIds: {},
    });

    render(
      <SettingsWindow
        open
        onClose={vi.fn()}
      />,
    );

    await user.click(
      await screen.findByRole("button", { name: "Configuration" }),
    );
    await user.selectOptions(screen.getByLabelText("Commit analysis engine"), "");

    expect(apiMocks.setLocalAiModelPreference).toHaveBeenCalledWith({
      modelId: "",
      actionKind: "commitMessage",
    });
  });

  it("shows preference command errors inside the settings window", async () => {
    const user = userEvent.setup();
    apiMocks.setLocalAiAnalysisEnginePreference.mockRejectedValueOnce(
      new Error("Unsupported local AI model:"),
    );

    render(
      <SettingsWindow
        open
        onClose={vi.fn()}
      />,
    );

    await user.click(
      await screen.findByRole("button", { name: "Configuration" }),
    );
    await user.selectOptions(
      screen.getByLabelText("Commit analysis engine"),
      "local:qwen2.5-coder:7b",
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Unsupported local AI model:",
    );
  });

  it("renders external agents with registry install actions", async () => {
    const user = userEvent.setup();
    apiMocks.installExternalAiAgent.mockResolvedValueOnce({
      operationId: "external-ai-gemini-1",
    });

    render(
      <SettingsWindow
        open
        onClose={vi.fn()}
      />,
    );

    await user.click(
      await screen.findByRole("button", { name: "External Agents" }),
    );
    expect(screen.getByText("Codex CLI")).toBeInTheDocument();
    expect(screen.getByText("Gemini CLI")).toBeInTheDocument();
    expect(screen.getByText("GitHub Copilot")).toBeInTheDocument();
    expect(screen.getByText("Installed")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /refresh status/i }),
    ).toBeEnabled();

    await user.click(screen.getByRole("button", { name: /install/i }));

    expect(apiMocks.installExternalAiAgent).toHaveBeenCalledWith({
      agentId: "gemini",
    });
  });

  it("groups Copilot with external agents and disables unavailable entries", async () => {
    const user = userEvent.setup();
    render(
      <SettingsWindow
        open
        onClose={vi.fn()}
      />,
    );

    await user.click(
      await screen.findByRole("button", { name: "Configuration" }),
    );
    const selector = screen.getByLabelText(
      "Global default analysis engine",
    ) as HTMLSelectElement;
    const externalGroup = selector.querySelector(
      "optgroup[label='External agents']",
    );

    expect(externalGroup).not.toBeNull();
    const externalOptions = Array.from(
      externalGroup?.querySelectorAll("option") ?? [],
    );
    expect(externalOptions.map((option) => option.textContent)).toContain(
      "GitHub Copilot",
    );
    expect(
      externalOptions.find((option) => option.textContent === "Gemini CLI")
        ?.disabled,
    ).toBe(true);
  });

  it("persists an external agent selection from the grouped selector", async () => {
    const user = userEvent.setup();
    apiMocks.setLocalAiAnalysisEnginePreference.mockResolvedValue({
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

    render(
      <SettingsWindow
        open
        onClose={vi.fn()}
      />,
    );

    await user.click(
      await screen.findByRole("button", { name: "Configuration" }),
    );
    await user.selectOptions(
      screen.getByLabelText("Global default analysis engine"),
      "external:codex-acp",
    );

    expect(apiMocks.setLocalAiAnalysisEnginePreference).toHaveBeenCalledWith({
      engine: {
        type: "external_agent",
        agentId: "codex-acp",
      },
      actionKind: null,
    });
  });

  it("uses selected external agent ACP options when agents expose different models", async () => {
    const user = userEvent.setup();
    apiMocks.getExternalAiAgentSessionConfig.mockImplementation(
      async (request: { agentId: string }) =>
        request.agentId === "github-copilot-cli"
          ? copilotModelConfig
          : codexModelConfig,
    );
    apiMocks.getLocalAiModelPreferences.mockResolvedValueOnce({
      globalModelId: "qwen2.5-coder:7b",
      actionModelIds: {},
      analysisEngine: {
        type: "external_agent",
        agentId: "codex-acp",
      },
      actionEngines: {
        branchReview: {
          type: "external_agent",
          agentId: "github-copilot-cli",
        },
      },
      externalAgentOptionValues: {
        "codex-acp": {
          model: "gpt-5.5",
        },
      },
      actionExternalAgentOptionValues: {},
      warmModelIds: [],
      keepAliveMinutes: 30,
    });
    apiMocks.setExternalAiAgentConfigPreference.mockResolvedValue({
      globalModelId: "qwen2.5-coder:7b",
      actionModelIds: {},
      analysisEngine: {
        type: "external_agent",
        agentId: "codex-acp",
      },
      actionEngines: {
        branchReview: {
          type: "external_agent",
          agentId: "github-copilot-cli",
        },
      },
      externalAgentOptionValues: {
        "codex-acp": {
          model: "gpt-5.5",
        },
      },
      actionExternalAgentOptionValues: {
        branchReview: {
          "github-copilot-cli": {
            model: "copilot-gpt",
          },
        },
      },
      warmModelIds: [],
      keepAliveMinutes: 30,
    });

    render(
      <SettingsWindow
        open
        onClose={vi.fn()}
        repoPath="/repo"
      />,
    );

    await user.click(
      await screen.findByRole("button", { name: "Configuration" }),
    );
    const modelSelect = await screen.findByLabelText(
      "Branch review Model",
    ) as HTMLSelectElement;
    const branchReviewModelLabels = Array.from(modelSelect.options).map(
      (option) => option.textContent,
    );

    expect(apiMocks.getExternalAiAgentSessionConfig).toHaveBeenCalledWith({
      agentId: "github-copilot-cli",
      repoPath: "/repo",
    });
    expect(branchReviewModelLabels).toContain("Copilot Sonnet");
    expect(branchReviewModelLabels).toContain("Copilot GPT");
    expect(branchReviewModelLabels).not.toContain("GPT-5.5");

    await user.selectOptions(modelSelect, "copilot-gpt");

    expect(apiMocks.setExternalAiAgentConfigPreference).toHaveBeenCalledWith({
      agentId: "github-copilot-cli",
      actionKind: "branchReview",
      configId: "model",
      value: "copilot-gpt",
    });
  });

  it("renders ACP config options and persists action-specific overrides", async () => {
    const user = userEvent.setup();
    apiMocks.getLocalAiModelPreferences.mockResolvedValueOnce({
      globalModelId: "qwen2.5-coder:7b",
      actionModelIds: {},
      analysisEngine: {
        type: "local_model",
        modelId: "qwen2.5-coder:7b",
      },
      actionEngines: {
        branchReview: {
          type: "external_agent",
          agentId: "codex-acp",
        },
      },
      externalAgentOptionValues: {},
      actionExternalAgentOptionValues: {},
      warmModelIds: [],
      keepAliveMinutes: 30,
    });
    apiMocks.setExternalAiAgentConfigPreference.mockResolvedValue({
      globalModelId: "qwen2.5-coder:7b",
      actionModelIds: {},
      analysisEngine: {
        type: "local_model",
        modelId: "qwen2.5-coder:7b",
      },
      actionEngines: {
        branchReview: {
          type: "external_agent",
          agentId: "codex-acp",
        },
      },
      externalAgentOptionValues: {},
      actionExternalAgentOptionValues: {
        branchReview: {
          "codex-acp": {
            model: "gpt-5",
          },
        },
      },
      warmModelIds: [],
      keepAliveMinutes: 30,
    });

    render(
      <SettingsWindow
        open
        onClose={vi.fn()}
        repoPath="/repo"
      />,
    );

    await user.click(
      await screen.findByRole("button", { name: "Configuration" }),
    );
    const modelSelect = await screen.findByLabelText("Branch review Model");
    expect(apiMocks.getExternalAiAgentSessionConfig).toHaveBeenCalledWith({
      agentId: "codex-acp",
      repoPath: "/repo",
    });

    await user.selectOptions(modelSelect, "gpt-5");

    expect(apiMocks.setExternalAiAgentConfigPreference).toHaveBeenCalledWith({
      agentId: "codex-acp",
      actionKind: "branchReview",
      configId: "model",
      value: "gpt-5",
    });
  });

  it("renders prompt controls for every AI action", async () => {
    const user = userEvent.setup();

    render(
      <SettingsWindow
        open
        onClose={vi.fn()}
      />,
    );

    await user.click(
      await screen.findByRole("button", { name: "Configuration" }),
    );

    expect(screen.getByText("Prompts")).toBeInTheDocument();
    expect(screen.getByLabelText("Commit prompt override")).toBeInTheDocument();
    expect(
      screen.getByLabelText("Commit review prompt override"),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText("Branch analysis prompt override"),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText("Branch review prompt override"),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText("Merge conflicts prompt override"),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Save" })[0]).toBeDisabled();
    expect(
      screen.getAllByRole("button", { name: "Use default value" })[0],
    ).toBeDisabled();

    await user.type(
      screen.getByLabelText("Commit prompt override"),
      "\nFocus on the user-visible behavior.",
    );

    expect(screen.getAllByRole("button", { name: "Save" })[0]).toBeEnabled();
    expect(
      screen.getAllByRole("button", { name: "Use default value" })[0],
    ).toBeEnabled();
  });

  it("saves and clears an action prompt override", async () => {
    const user = userEvent.setup();
    apiMocks.getLocalAiModelPreferences.mockResolvedValueOnce({
      globalModelId: "qwen2.5-coder:7b",
      actionModelIds: {},
      analysisEngine: {
        type: "local_model",
        modelId: "qwen2.5-coder:7b",
      },
      actionEngines: {},
      actionPromptOverrides: {
        branchReview: "Focus on security regressions.",
      },
      warmModelIds: [],
      keepAliveMinutes: 30,
    });
    apiMocks.setLocalAiActionPromptOverride
      .mockResolvedValueOnce({
        globalModelId: "qwen2.5-coder:7b",
        actionModelIds: {},
        analysisEngine: {
          type: "local_model",
          modelId: "qwen2.5-coder:7b",
        },
        actionEngines: {},
        actionPromptOverrides: {
          branchReview: "Focus on authorization and data loss.",
        },
        warmModelIds: [],
        keepAliveMinutes: 30,
      })
      .mockResolvedValueOnce({
        globalModelId: "qwen2.5-coder:7b",
        actionModelIds: {},
        analysisEngine: {
          type: "local_model",
          modelId: "qwen2.5-coder:7b",
        },
        actionEngines: {},
        actionPromptOverrides: {},
        warmModelIds: [],
        keepAliveMinutes: 30,
      });

    render(
      <SettingsWindow
        open
        onClose={vi.fn()}
      />,
    );

    await user.click(
      await screen.findByRole("button", { name: "Configuration" }),
    );
    const prompt = await screen.findByLabelText("Branch review prompt override");
    expect(prompt).toHaveValue("Focus on security regressions.");
    expect(screen.getAllByRole("button", { name: "Save" })[3]).toBeDisabled();
    expect(
      screen.getAllByRole("button", { name: "Use default value" })[3],
    ).toBeEnabled();

    await user.clear(prompt);
    await user.type(prompt, "Focus on authorization and data loss.");
    expect(screen.getAllByRole("button", { name: "Save" })[3]).toBeEnabled();
    await user.click(screen.getAllByRole("button", { name: "Save" })[3]);

    expect(apiMocks.setLocalAiActionPromptOverride).toHaveBeenCalledWith({
      actionKind: "branchReview",
      prompt: "Focus on authorization and data loss.",
    });

    await user.click(
      screen.getAllByRole("button", { name: "Use default value" })[3],
    );

    expect(apiMocks.setLocalAiActionPromptOverride).toHaveBeenLastCalledWith({
      actionKind: "branchReview",
      prompt: null,
    });
    expect((prompt as HTMLTextAreaElement).value).toContain(
      "Review this branch like PR review feedback.",
    );
  });

  it("disables warmup controls when an external agent is selected", async () => {
    const user = userEvent.setup();
    apiMocks.getLocalAiModelPreferences.mockResolvedValueOnce({
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

    render(
      <SettingsWindow
        open
        onClose={vi.fn()}
      />,
    );

    await user.click(await screen.findByRole("button", { name: "Local Models" }));
    expect(
      screen.getAllByText(
        "Warmup is unavailable while an external agent is selected.",
      ).length,
    ).toBeGreaterThan(0);
    expect(apiMocks.warmConfiguredLocalAiModels).not.toHaveBeenCalled();
  });

  it("clears the UI state when an older backend rejects the empty model", async () => {
    const user = userEvent.setup();
    apiMocks.setLocalAiModelPreference.mockRejectedValueOnce(
      new Error("Unsupported local AI model:"),
    );

    render(
      <SettingsWindow
        open
        onClose={vi.fn()}
      />,
    );

    await user.click(
      await screen.findByRole("button", { name: "Configuration" }),
    );
    await user.selectOptions(screen.getByLabelText("Commit analysis engine"), "");

    expect(apiMocks.setLocalAiModelPreference).toHaveBeenCalledWith({
      modelId: "",
      actionKind: "commitMessage",
    });
    await waitFor(() => {
      expect(screen.getByLabelText("Commit analysis engine")).toHaveValue("");
    });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
