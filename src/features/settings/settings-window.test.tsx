import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ACTION_MODEL_REQUIRED_MESSAGE } from "./constants";
import { SettingsWindow } from "./settings-window";

const apiMocks = vi.hoisted(() => ({
  deleteLocalAiModel: vi.fn(),
  getLocalAiEntitlementStatus: vi.fn(),
  getLocalAiMachineProfile: vi.fn(),
  getLocalAiModelCatalog: vi.fn(),
  getLocalAiModelPreferences: vi.fn(),
  getLocalAiModelStatus: vi.fn(),
  getLocalAiRuntimeStatus: vi.fn(),
  listenToLocalAiProgress: vi.fn(),
  prepareLocalAiModel: vi.fn(),
  prepareLocalAiRuntime: vi.fn(),
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

describe("SettingsWindow", () => {
  beforeEach(() => {
    Object.values(apiMocks).forEach((mock) => mock.mockReset());
    apiMocks.getLocalAiModelCatalog.mockResolvedValue(models);
    apiMocks.getLocalAiModelPreferences.mockResolvedValue({
      globalModelId: "qwen2.5-coder:7b",
      actionModelIds: {
        commitMessage: "qwen2.5-coder:1.5b",
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

    await user.click(await screen.findByRole("button", { name: "Models" }));

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

    await user.click(await screen.findByRole("button", { name: "Models" }));

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

    await user.click(await screen.findByRole("button", { name: "Models" }));
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

    expect(screen.getByLabelText("PR / branch review model")).toHaveValue("");
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
    await user.selectOptions(screen.getByLabelText("Commit model"), "");

    expect(apiMocks.setLocalAiModelPreference).toHaveBeenCalledWith({
      modelId: "",
      actionKind: "commitMessage",
    });
  });

  it("shows preference command errors inside the settings window", async () => {
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
    await user.selectOptions(
      screen.getByLabelText("Commit model"),
      "qwen2.5-coder:7b",
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Unsupported local AI model:",
    );
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
    await user.selectOptions(screen.getByLabelText("Commit model"), "");

    expect(apiMocks.setLocalAiModelPreference).toHaveBeenCalledWith({
      modelId: "",
      actionKind: "commitMessage",
    });
    await waitFor(() => {
      expect(screen.getByLabelText("Commit model")).toHaveValue("");
    });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
