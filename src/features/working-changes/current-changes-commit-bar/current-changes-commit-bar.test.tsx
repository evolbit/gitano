import {
  act,
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useLocalAiStore } from "@/features/local-ai/store";
import { useGitActionsStore } from "@/features/repository-workspace/stores/git-actions-store";
import { useRepoStore } from "@/features/repository-workspace/stores/repo-store";
import { useStagedLinesStore } from "@/features/working-changes/stores/staging-store";
import CurrentChangesCommitBar from "./current-changes-commit-bar";

const getRepositoryStateMock = vi.hoisted(() => vi.fn());
const commitStagedChangesMock = vi.hoisted(() => vi.fn());
const hasStagedChangesMock = vi.hoisted(() => vi.fn());
const pushRepositoryMock = vi.hoisted(() => vi.fn());
const stashSelectedFilesMock = vi.hoisted(() => vi.fn());
const localAiMocks = vi.hoisted(() => ({
  runLocalAiAction: vi.fn(),
  deleteLocalAiModel: vi.fn(),
  getLocalAiModelCatalog: vi.fn(),
  getExternalAiAgentCatalog: vi.fn(),
  getLocalAiEntitlementStatus: vi.fn(),
  getLocalAiModelPreferences: vi.fn(),
  getLocalAiModelStatus: vi.fn(),
  getLocalAiRuntimeStatus: vi.fn(),
  getLocalAiModelCompatibility: vi.fn(),
  prepareLocalAiModel: vi.fn(),
  prepareLocalAiRuntime: vi.fn(),
  setLocalAiModelPreference: vi.fn(),
  setLocalAiAnalysisEnginePreference: vi.fn(),
  listenToLocalAiProgress: vi.fn(),
}));

const localAiModel = {
  id: "qwen2.5-coder:7b",
  displayName: "Qwen2.5 Coder 7B",
  provider: "Ollama",
  qualityTier: "recommended",
  downloadSizeGb: 4.7,
  contextWindow: 32768,
  actionSuitability: ["commitMessage"],
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
};

vi.mock("@/shared/api/repositories", () => ({
  getRepositoryState: getRepositoryStateMock,
}));

vi.mock("@/shared/api/git/staging", () => ({
  commitStagedChanges: commitStagedChangesMock,
  hasStagedChanges: hasStagedChangesMock,
  pushRepository: pushRepositoryMock,
}));

vi.mock("@/shared/api/git/stashes", () => ({
  stashSelectedFiles: stashSelectedFilesMock,
}));

vi.mock("@/shared/api/local-ai", () => localAiMocks);

vi.mock("@/shared/platform/tauri/storage", () => ({
  tauriStorage: {
    getItem: vi.fn(async () => null),
    setItem: vi.fn(async () => undefined),
    removeItem: vi.fn(async () => undefined),
  },
}));

describe("CurrentChangesCommitBar", () => {
  beforeEach(() => {
    getRepositoryStateMock.mockReset();
    commitStagedChangesMock.mockReset();
    hasStagedChangesMock.mockReset();
    pushRepositoryMock.mockReset();
    stashSelectedFilesMock.mockReset();
    Object.values(localAiMocks).forEach((mock) => mock.mockReset());
    localAiMocks.listenToLocalAiProgress.mockReturnValue(Promise.resolve(() => {}));
    localAiMocks.getExternalAiAgentCatalog.mockResolvedValue([]);
    localAiMocks.getLocalAiModelPreferences.mockResolvedValue({
      globalModelId: "qwen2.5-coder:7b",
      actionModelIds: {
        commitMessage: "qwen2.5-coder:7b",
        mergeConflictSuggestions: "qwen2.5-coder:7b",
      },
    });
    localAiMocks.getLocalAiModelStatus.mockResolvedValue({
      runtime: {
        available: true,
        endpoint: "http://127.0.0.1:11435",
        error: null,
      },
      modelId: "qwen2.5-coder:7b",
      installed: true,
      digest: "digest",
      sizeBytes: 4_700_000_000,
      running: false,
      ready: true,
    });
    getRepositoryStateMock.mockResolvedValue({
      path: "/repo",
      isValid: true,
      branch: "main",
      headStatus: "unborn",
      hasCommits: false,
      isUnborn: true,
      isDetached: false,
    });
    useStagedLinesStore.getState().clearAllStagedLines();
    useStagedLinesStore
      .getState()
      .setStagedLines("file.txt", 0, new Set([0]));
    useRepoStore.setState({
      tabs: [
        {
          id: "repo-1",
          repoPath: "/repo",
          selectedBranch: "main",
          selectedCommit: null,
        },
      ],
      activeTabId: "repo-1",
      recentRepos: [],
      favoriteRepos: [],
    });
    useGitActionsStore.setState({
      pendingAction: null,
      notice: null,
    });
  });

  afterEach(() => {
    cleanup();
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
    useGitActionsStore.setState({
      pendingAction: null,
      notice: null,
    });
  });

  it("keeps first commit available while disabling unborn-only actions", async () => {
    const user = userEvent.setup();
    render(<CurrentChangesCommitBar repoPath="/repo" />);

    await waitFor(() => {
      expect(screen.getByLabelText("Push")).toBeDisabled();
    });

    await user.type(screen.getByPlaceholderText("Enter commit message"), "initial");
    expect(screen.getByRole("button", { name: "Commit" })).toBeEnabled();

    await user.click(screen.getByRole("button", { name: "Commit options" }));
    expect(screen.getByRole("button", { name: "Amend" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Stash" })).toBeDisabled();
  });

  it("renders commit actions inside the commit message frame", () => {
    render(<CurrentChangesCommitBar repoPath="/repo" />);

    const commitMessageFrame = screen.getByRole("group", {
      name: "Commit message controls",
    });
    const frame = within(commitMessageFrame);

    expect(
      frame.getByPlaceholderText("Enter commit message"),
    ).toBeInTheDocument();
    expect(
      frame.getByRole("group", { name: "Commit actions" }),
    ).toBeInTheDocument();
    expect(
      frame.getByRole("button", { name: /generate commit message/i }),
    ).toBeInTheDocument();
    expect(frame.getByLabelText("Push")).toBeInTheDocument();
    expect(frame.getByRole("button", { name: "Commit" })).toBeInTheDocument();
  });

  it("fills the commit message from local AI generation", async () => {
    const user = userEvent.setup();
    getRepositoryStateMock.mockResolvedValue({
      path: "/repo",
      isValid: true,
      branch: "main",
      headStatus: "normal",
      hasCommits: true,
      isUnborn: false,
      isDetached: false,
    });
    localAiMocks.runLocalAiAction.mockResolvedValue({
      result: {
        kind: "commitMessage",
        data: {
          message: "Add local AI foundation",
          alternatives: [],
        },
      },
    });

    render(<CurrentChangesCommitBar repoPath="/repo" />);

    await user.click(
      screen.getByRole("button", { name: /generate commit message/i }),
    );

    expect(localAiMocks.runLocalAiAction).toHaveBeenCalledWith({
      repoPath: "/repo",
      actionKind: "commitMessage",
    });
    expect(screen.getByPlaceholderText("Enter commit message")).toHaveValue(
      "Add local AI foundation",
    );
  });

  it("shows a loading affordance while generating a commit message", async () => {
    const user = userEvent.setup();
    getRepositoryStateMock.mockResolvedValue({
      path: "/repo",
      isValid: true,
      branch: "main",
      headStatus: "normal",
      hasCommits: true,
      isUnborn: false,
      isDetached: false,
    });

    let resolveGeneration: (value: unknown) => void = () => undefined;
    localAiMocks.runLocalAiAction.mockReturnValue(
      new Promise((resolve) => {
        resolveGeneration = resolve;
      }),
    );

    render(<CurrentChangesCommitBar repoPath="/repo" />);

    await user.click(
      screen.getByRole("button", { name: /generate commit message/i }),
    );

    const loadingButton = await screen.findByRole("button", {
      name: /generating commit message/i,
    });
    expect(loadingButton).toBeDisabled();
    expect(loadingButton).toHaveAttribute("aria-busy", "true");
    expect(loadingButton.querySelector(".animate-spin")).toBeInTheDocument();

    await act(async () => {
      resolveGeneration({
        result: {
          kind: "commitMessage",
          data: {
            message: "Add generated commit message",
            alternatives: [],
          },
        },
      });
    });

    await waitFor(() => {
      expect(screen.getByPlaceholderText("Enter commit message")).toHaveValue(
        "Add generated commit message",
      );
    });
  });

  it("continues commit message generation after local AI setup completes", async () => {
    const user = userEvent.setup();
    getRepositoryStateMock.mockResolvedValue({
      path: "/repo",
      isValid: true,
      branch: "main",
      headStatus: "normal",
      hasCommits: true,
      isUnborn: false,
      isDetached: false,
    });
    localAiMocks.runLocalAiAction
      .mockRejectedValueOnce(
        new Error("LOCAL_AI_MODEL_SETUP_REQUIRED: qwen2.5-coder:7b is not installed."),
      )
      .mockResolvedValueOnce({
        result: {
          kind: "commitMessage",
          data: {
            message: "Add generated commit message",
            alternatives: [],
          },
        },
      });
    localAiMocks.getLocalAiModelCatalog.mockResolvedValue([localAiModel]);
    localAiMocks.getLocalAiEntitlementStatus.mockResolvedValue({
      entitled: true,
      source: "developmentStub",
      reason: "dev",
    });
    localAiMocks.getLocalAiModelPreferences.mockResolvedValue({
      globalModelId: "qwen2.5-coder:7b",
      actionModelIds: {
        commitMessage: "qwen2.5-coder:7b",
      },
    });
    localAiMocks.getLocalAiModelStatus.mockResolvedValue({
      runtime: {
        available: false,
        endpoint: "http://127.0.0.1:11435",
        error: "Local AI runtime is not running.",
      },
      modelId: "qwen2.5-coder:7b",
      installed: false,
      digest: null,
      sizeBytes: null,
      running: false,
      ready: false,
    });
    localAiMocks.getLocalAiModelCompatibility.mockResolvedValue({
      modelId: "qwen2.5-coder:7b",
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
    localAiMocks.prepareLocalAiModel.mockResolvedValue({ operationId: "op-1" });

    render(<CurrentChangesCommitBar repoPath="/repo" />);

    await user.click(
      screen.getByRole("button", { name: /generate commit message/i }),
    );
    expect(await screen.findByText("Local AI setup required")).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: /download local ai/i }),
    );
    expect(
      await screen.findByText("Starting local AI setup..."),
    ).toBeInTheDocument();

    localAiMocks.getLocalAiModelStatus.mockResolvedValue({
      runtime: {
        available: true,
        endpoint: "http://127.0.0.1:11435",
        error: null,
      },
      modelId: "qwen2.5-coder:7b",
      installed: true,
      digest: "digest",
      sizeBytes: 4_700_000_000,
      running: false,
      ready: true,
    });

    act(() => {
      useLocalAiStore.getState().markReadyIfActive({
        operationId: "op-1",
        modelId: "qwen2.5-coder:7b",
        state: "completed",
        status: "Model ready",
        completedBytes: null,
        totalBytes: null,
        percentage: 100,
        error: null,
      });
    });

    await waitFor(() => {
      expect(localAiMocks.runLocalAiAction).toHaveBeenCalledTimes(2);
    });
    expect(screen.getByPlaceholderText("Enter commit message")).toHaveValue(
      "Add generated commit message",
    );
  });

  it("blocks commit AI when the action-specific model was deleted", async () => {
    const user = userEvent.setup();
    getRepositoryStateMock.mockResolvedValue({
      path: "/repo",
      isValid: true,
      branch: "main",
      headStatus: "normal",
      hasCommits: true,
      isUnborn: false,
      isDetached: false,
    });
    localAiMocks.getLocalAiModelPreferences.mockResolvedValue({
      globalModelId: "qwen2.5-coder:7b",
      actionModelIds: {
        commitMessage: "qwen2.5-coder:1.5b",
      },
    });
    localAiMocks.getLocalAiModelStatus.mockResolvedValue({
      runtime: {
        available: true,
        endpoint: "http://127.0.0.1:11435",
        error: null,
      },
      modelId: "qwen2.5-coder:1.5b",
      installed: false,
      digest: null,
      sizeBytes: null,
      running: false,
      ready: false,
    });

    render(<CurrentChangesCommitBar repoPath="/repo" />);

    await user.click(
      screen.getByRole("button", { name: /generate commit message/i }),
    );

    await waitFor(() => {
      expect(useGitActionsStore.getState().notice).toMatchObject({
        kind: "error",
        title: "No AI model selected for Commit",
      });
    });
    expect(localAiMocks.runLocalAiAction).not.toHaveBeenCalled();
  });

  it("runs local AI merge conflict suggestions from commit options", async () => {
    const user = userEvent.setup();
    getRepositoryStateMock.mockResolvedValue({
      path: "/repo",
      isValid: true,
      branch: "main",
      headStatus: "normal",
      hasCommits: true,
      isUnborn: false,
      isDetached: false,
    });
    localAiMocks.runLocalAiAction.mockResolvedValue({
      result: {
        kind: "conflictSuggestions",
        data: {
          summary: "Resolve conflicts",
          files: [],
        },
      },
    });

    render(<CurrentChangesCommitBar repoPath="/repo" />);

    await user.click(screen.getByRole("button", { name: "Commit options" }));
    await user.click(screen.getByRole("button", { name: "Suggest conflicts" }));

    expect(localAiMocks.runLocalAiAction).toHaveBeenCalledWith({
      repoPath: "/repo",
      actionKind: "mergeConflictSuggestions",
      forceRefresh: false,
    });
  });
});
