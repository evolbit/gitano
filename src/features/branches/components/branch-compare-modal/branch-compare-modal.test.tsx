import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useLocalAiStore } from "@/features/local-ai";
import { useGitActionsStore } from "@/features/repository-workspace";
import { BranchCompareModal } from "./branch-compare-modal";

const branchApiMocks = vi.hoisted(() => ({
  getBranches: vi.fn(),
}));
const diffApiMocks = vi.hoisted(() => ({
  getBranchComparisonFiles: vi.fn(),
  getBranchComparisonFileDiff: vi.fn(),
}));
const localAiMocks = vi.hoisted(() => ({
  runLocalAiAction: vi.fn(),
  listenToLocalAiRunProgress: vi.fn(),
  listenToExternalAiRunEvents: vi.fn(),
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
const integrationApiMocks = vi.hoisted(() => ({
  listGitHubPullRequestComments: vi.fn(),
  submitGitHubPullRequestReview: vi.fn(),
}));
const clipboardMocks = vi.hoisted(() => ({
  writeClipboardText: vi.fn(),
}));

vi.mock("../../api", () => branchApiMocks);
vi.mock("@/shared/api/git/diffs", () => diffApiMocks);
vi.mock("@/shared/api/local-ai", () => localAiMocks);
vi.mock("@/shared/api/integrations", () => integrationApiMocks);
vi.mock("@/shared/platform/clipboard", () => clipboardMocks);

describe("BranchCompareModal local AI", () => {
  beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn();
	    branchApiMocks.getBranches.mockImplementation((_repoPath: string, type: string) =>
	      Promise.resolve(type === "local" ? ["main", "feature", "develop"] : []),
	    );
    diffApiMocks.getBranchComparisonFiles.mockResolvedValue([]);
    diffApiMocks.getBranchComparisonFileDiff.mockResolvedValue([]);
    integrationApiMocks.listGitHubPullRequestComments.mockResolvedValue([]);
    integrationApiMocks.submitGitHubPullRequestReview.mockResolvedValue({
      id: 1,
      state: "COMMENTED",
      htmlUrl: null,
    });
    localAiMocks.runLocalAiAction.mockResolvedValue({
      result: {
        kind: "analysis",
        data: {
          summary: "Looks good",
          riskAssessment: "Low",
          changedAreas: [],
          findings: [],
        },
      },
      modelId: "qwen2.5-coder:7b",
      fromCache: false,
    });
    localAiMocks.listenToLocalAiRunProgress.mockReturnValue(
      Promise.resolve(() => {}),
    );
    localAiMocks.listenToExternalAiRunEvents.mockReturnValue(
      Promise.resolve(() => {}),
    );
    localAiMocks.listenToLocalAiProgress.mockReturnValue(Promise.resolve(() => {}));
    localAiMocks.getExternalAiAgentCatalog.mockResolvedValue([]);
    localAiMocks.getLocalAiModelCatalog.mockResolvedValue([
      {
        id: "qwen2.5-coder:3b",
        displayName: "Qwen2.5 Coder 3B",
        provider: "Ollama",
        qualityTier: "fast",
        downloadSizeGb: 1.9,
        contextWindow: 32768,
        actionSuitability: ["commitMessage", "commitAnalysis"],
        minRequirements: {
          minMemoryGb: 8,
          recommendedMemoryGb: 8,
          minDiskFreeGb: 4,
          recommendedDiskFreeGb: 6,
        },
        recommendedRequirements: {
          minMemoryGb: 8,
          recommendedMemoryGb: 12,
          minDiskFreeGb: 4,
          recommendedDiskFreeGb: 6,
        },
      },
      {
        id: "qwen2.5-coder:7b",
        displayName: "Qwen2.5 Coder 7B",
        provider: "Ollama",
        qualityTier: "recommended",
        downloadSizeGb: 4.7,
        contextWindow: 32768,
        actionSuitability: [
          "commitMessage",
          "commitAnalysis",
          "branchAnalysis",
          "branchReview",
          "mergeConflictSuggestions",
        ],
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
    ]);
    localAiMocks.getLocalAiEntitlementStatus.mockResolvedValue({
      entitled: true,
      source: "developmentStub",
      reason: "dev",
    });
    localAiMocks.getLocalAiModelPreferences.mockResolvedValue({
      globalModelId: "qwen2.5-coder:3b",
      actionModelIds: {},
    });
    localAiMocks.getLocalAiModelStatus.mockImplementation(async (modelId: string) => ({
      runtime: {
        available: true,
        endpoint: "http://127.0.0.1:11434",
        error: null,
      },
      modelId,
      installed: true,
      digest: "digest",
      sizeBytes: modelId === "qwen2.5-coder:7b" ? 4_700_000_000 : 1_900_000_000,
      running: false,
      ready: true,
    }));
    localAiMocks.getLocalAiModelCompatibility.mockImplementation(async (modelId: string) => ({
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
    localAiMocks.setLocalAiModelPreference.mockResolvedValue({
      globalModelId: "qwen2.5-coder:3b",
      actionModelIds: {
        branchReview: "qwen2.5-coder:7b",
      },
    });
    localAiMocks.setLocalAiAnalysisEnginePreference.mockResolvedValue({
      globalModelId: "qwen2.5-coder:3b",
      actionModelIds: {
        branchReview: "qwen2.5-coder:7b",
      },
      analysisEngine: { type: "local_model", modelId: "qwen2.5-coder:3b" },
      actionEngines: {
        branchReview: { type: "local_model", modelId: "qwen2.5-coder:7b" },
      },
    });
    clipboardMocks.writeClipboardText.mockResolvedValue(undefined);
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
    useGitActionsStore.setState({
      pendingAction: null,
      notice: null,
    });
  });

  it("renders pull request review mode with comments panel", async () => {
    const user = userEvent.setup();
    integrationApiMocks.listGitHubPullRequestComments.mockResolvedValueOnce([
      {
        id: 1,
        kind: "review",
        author: { login: "marco", avatarUrl: null },
        body: "Please check this line.",
        createdAt: "2026-05-21T10:00:00Z",
        updatedAt: "2026-05-21T10:00:00Z",
        path: "src/app.ts",
        side: "RIGHT",
        line: 12,
        originalLine: 12,
        diffHunk: "@@",
      },
    ]);

    render(
      <MantineProvider>
        <BranchCompareModal
          repoPath="/repo"
          initialSourceBranch="refs/remotes/origin/pull/12/head"
          initialTargetBranch="refs/remotes/origin/main"
          pullRequestContext={{
            number: 12,
            title: "Improve checkout flow",
            baseRef: "refs/remotes/origin/main",
            headRef: "refs/remotes/origin/pull/12/head",
            baseLabel: "acme:main",
            headLabel: "acme:feature",
          }}
          onClose={vi.fn()}
        />
      </MantineProvider>,
    );

    expect(await screen.findByText("Pull Request #12")).toBeInTheDocument();
    expect(screen.getByText("Improve checkout flow")).toBeInTheDocument();
    expect(screen.getByText("acme:main <- acme:feature")).toBeInTheDocument();
    expect(diffApiMocks.getBranchComparisonFiles).toHaveBeenCalledWith({
      path: "/repo",
      baseRef: "refs/remotes/origin/main",
      headRef: "refs/remotes/origin/pull/12/head",
      comparisonMode: "mergeBase",
    });
    await user.click(screen.getByRole("button", { name: "Comments" }));

    expect(
      await screen.findByText("Please check this line."),
    ).toBeInTheDocument();
    expect(integrationApiMocks.listGitHubPullRequestComments).toHaveBeenCalledWith({
      path: "/repo",
      number: 12,
    });
  });

  it("shows pull request review comment controls in split diff mode", async () => {
    const user = userEvent.setup();
    diffApiMocks.getBranchComparisonFiles.mockResolvedValue([
      { path: "package.json", status: "modified", insertions: 1, deletions: 1 },
    ]);
    diffApiMocks.getBranchComparisonFileDiff.mockResolvedValue([
      {
        header: "@@ -10,7 +10,7 @@",
        old_start: 10,
        old_lines: 7,
        new_start: 10,
        new_lines: 7,
        is_new_file: false,
        lines: [
          {
            kind: "Context",
            content: '  "dependencies": {',
            old_lineno: 12,
            new_lineno: 12,
          },
          {
            kind: "Del",
            content: '    "@gfazioli/mantine-split-pane": "^2.1.2",',
            old_lineno: 13,
            new_lineno: null,
          },
          {
            kind: "Add",
            content: '    "@gfazioli/mantine-split-pane": "^2.5.4",',
            old_lineno: null,
            new_lineno: 13,
          },
        ],
      },
    ]);

    render(
      <MantineProvider>
        <BranchCompareModal
          repoPath="/repo"
          initialSourceBranch="refs/remotes/origin/pull/14/head"
          initialTargetBranch="refs/remotes/origin/main"
          pullRequestContext={{
            number: 14,
            title: "Upgrade split pane",
            baseRef: "refs/remotes/origin/main",
            headRef: "refs/remotes/origin/pull/14/head",
            baseLabel: "evolbit:main",
            headLabel: "evolbit:snyk-upgrade",
          }}
          onClose={vi.fn()}
        />
      </MantineProvider>,
    );

    await screen.findByText("package.json");
    await user.click(screen.getByRole("button", { name: "Split" }));
    await user.click(screen.getAllByRole("button", { name: "Add comment" })[0]);

    expect(await screen.findByPlaceholderText("Leave a comment")).toBeInTheDocument();
  });

  it("runs local AI analysis for the active branch comparison", async () => {
    const user = userEvent.setup();

    render(
      <MantineProvider>
	        <BranchCompareModal
	          repoPath="/repo"
	          initialSourceBranch="feature"
	          initialTargetBranch="main"
	          onClose={vi.fn()}
	        />
      </MantineProvider>,
    );

    await waitFor(() => {
      expect(diffApiMocks.getBranchComparisonFiles).toHaveBeenCalled();
    });
    await user.click(screen.getByRole("button", { name: "Analyze" }));

    expect(localAiMocks.runLocalAiAction).toHaveBeenCalledWith({
      repoPath: "/repo",
      actionKind: "branchAnalysis",
      runId: expect.any(String),
      baseRef: "main",
      headRef: "feature",
      comparisonMode: "direct",
      forceRefresh: false,
    });
  });

  it("runs local AI review for the active branch comparison", async () => {
    const user = userEvent.setup();

    render(
      <MantineProvider>
	        <BranchCompareModal
	          repoPath="/repo"
	          initialSourceBranch="feature"
	          initialTargetBranch="main"
	          onClose={vi.fn()}
	        />
      </MantineProvider>,
    );

    await waitFor(() => {
      expect(diffApiMocks.getBranchComparisonFiles).toHaveBeenCalled();
    });
    await user.click(screen.getByRole("button", { name: "Review" }));

    expect(localAiMocks.runLocalAiAction).toHaveBeenCalledWith({
      repoPath: "/repo",
      actionKind: "branchReview",
      runId: expect.any(String),
      baseRef: "main",
      headRef: "feature",
      comparisonMode: "direct",
      forceRefresh: false,
    });
  });

  it("reloads comparison files when the source branch changes", async () => {
    const user = userEvent.setup();

    render(
      <MantineProvider>
        <BranchCompareModal
          repoPath="/repo"
          initialSourceBranch="feature"
          initialTargetBranch="main"
          onClose={vi.fn()}
        />
      </MantineProvider>,
    );

    await waitFor(() => {
      expect(diffApiMocks.getBranchComparisonFiles).toHaveBeenCalledWith({
        path: "/repo",
        baseRef: "main",
        headRef: "feature",
        comparisonMode: "direct",
      });
    });
    diffApiMocks.getBranchComparisonFiles.mockClear();

    await user.click(screen.getByRole("button", { name: "feature" }));
    await user.click(await screen.findByRole("button", { name: "develop" }));

    await waitFor(() => {
      expect(diffApiMocks.getBranchComparisonFiles).toHaveBeenCalledWith({
        path: "/repo",
        baseRef: "main",
        headRef: "develop",
        comparisonMode: "direct",
      });
    });
  });

  it("reloads comparison files when the target branch changes", async () => {
    const user = userEvent.setup();

    render(
      <MantineProvider>
        <BranchCompareModal
          repoPath="/repo"
          initialSourceBranch="feature"
          initialTargetBranch="main"
          onClose={vi.fn()}
        />
      </MantineProvider>,
    );

    await waitFor(() => {
      expect(diffApiMocks.getBranchComparisonFiles).toHaveBeenCalled();
    });
    diffApiMocks.getBranchComparisonFiles.mockClear();

    await user.click(screen.getByRole("button", { name: "main" }));
    await user.click(await screen.findByRole("button", { name: "develop" }));

    await waitFor(() => {
      expect(diffApiMocks.getBranchComparisonFiles).toHaveBeenCalledWith({
        path: "/repo",
        baseRef: "develop",
        headRef: "feature",
        comparisonMode: "direct",
      });
    });
  });

  it("supports empty endpoint selections without loading comparison files", async () => {
    render(
      <MantineProvider>
        <BranchCompareModal
          repoPath="/repo"
          initialSourceBranch={null}
          initialTargetBranch={null}
          onClose={vi.fn()}
        />
      </MantineProvider>,
    );

    await waitFor(() => {
      expect(branchApiMocks.getBranches).toHaveBeenCalled();
    });

    expect(diffApiMocks.getBranchComparisonFiles).not.toHaveBeenCalled();
    expect(screen.getAllByText("Select a source branch").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Analyze" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Review" })).toBeDisabled();
  });

  it("treats same-branch comparisons as a no-op empty state", async () => {
    render(
      <MantineProvider>
        <BranchCompareModal
          repoPath="/repo"
          initialSourceBranch="main"
          initialTargetBranch="main"
          onClose={vi.fn()}
        />
      </MantineProvider>,
    );

    await waitFor(() => {
      expect(branchApiMocks.getBranches).toHaveBeenCalled();
    });

    expect(diffApiMocks.getBranchComparisonFiles).not.toHaveBeenCalled();
    expect(
      screen.getAllByText("No changes between these branches").length,
    ).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Analyze" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Review" })).toBeDisabled();
  });

  it("swaps branch comparison direction", async () => {
    const user = userEvent.setup();

    render(
      <MantineProvider>
        <BranchCompareModal
          repoPath="/repo"
          initialSourceBranch="feature"
          initialTargetBranch="main"
          onClose={vi.fn()}
        />
      </MantineProvider>,
    );

    await waitFor(() => {
      expect(diffApiMocks.getBranchComparisonFiles).toHaveBeenCalled();
    });
    diffApiMocks.getBranchComparisonFiles.mockClear();

    await user.click(
      screen.getByRole("button", { name: "Swap comparison direction" }),
    );

    await waitFor(() => {
      expect(diffApiMocks.getBranchComparisonFiles).toHaveBeenCalledWith({
        path: "/repo",
        baseRef: "feature",
        headRef: "main",
        comparisonMode: "direct",
      });
    });
  });

  it("clears stale local AI analysis when the comparison pair changes", async () => {
    const user = userEvent.setup();

    render(
      <MantineProvider>
        <BranchCompareModal
          repoPath="/repo"
          initialSourceBranch="feature"
          initialTargetBranch="main"
          onClose={vi.fn()}
        />
      </MantineProvider>,
    );

    await waitFor(() => {
      expect(diffApiMocks.getBranchComparisonFiles).toHaveBeenCalled();
    });
    await user.click(screen.getByRole("button", { name: "Analyze" }));
    expect(await screen.findByText("Looks good")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "feature" }));
    await user.click(await screen.findByRole("button", { name: "develop" }));

    await waitFor(() => {
      expect(screen.queryByText("Looks good")).not.toBeInTheDocument();
    });
  });

  it("saves a ready setup model and resumes branch review when no action model is selected", async () => {
    const user = userEvent.setup();
    localAiMocks.runLocalAiAction
      .mockRejectedValueOnce(new Error("No AI model selected for Branch review"))
      .mockResolvedValueOnce({
        result: {
          kind: "branchReview",
          data: {
            summary: "No actionable findings.",
            findings: [],
            notes: [],
          },
        },
        modelId: "qwen2.5-coder:3b",
        fromCache: false,
      });

    render(
      <MantineProvider>
	        <BranchCompareModal
	          repoPath="/repo"
	          initialSourceBranch="feature"
	          initialTargetBranch="main"
	          onClose={vi.fn()}
	        />
      </MantineProvider>,
    );

    await waitFor(() => {
      expect(diffApiMocks.getBranchComparisonFiles).toHaveBeenCalled();
    });
    await user.click(screen.getByRole("button", { name: "Review" }));
    await user.click(await screen.findByRole("button", { name: "Ready" }));

    await waitFor(() => {
      expect(localAiMocks.setLocalAiModelPreference).toHaveBeenCalledWith({
        modelId: "qwen2.5-coder:7b",
        actionKind: "branchReview",
      });
    });
    await waitFor(() => {
      expect(localAiMocks.runLocalAiAction).toHaveBeenCalledTimes(2);
    });
    expect(
      await screen.findByText("No actionable review findings returned."),
    ).toBeInTheDocument();
  });

  it("shows branch review output errors beside the action buttons with report data", async () => {
    const user = userEvent.setup();
    const debugError =
      "External agent output could not be parsed. Report this debug payload:\n" +
      JSON.stringify(
        {
          kind: "external_agent_structured_output_error",
          agentId: "github-copilot-cli",
          actionKind: "branchReview",
          parseError: "Local AI returned invalid JSON: expected value",
          transcript: "SUMMARY\nInspecting the commit directly.",
        },
        null,
        2,
      );
    localAiMocks.runLocalAiAction.mockRejectedValue(
      new Error(debugError),
    );

    render(
      <MantineProvider>
	        <BranchCompareModal
	          repoPath="/repo"
	          initialSourceBranch="feature"
	          initialTargetBranch="main"
	          onClose={vi.fn()}
	        />
      </MantineProvider>,
    );

    await waitFor(() => {
      expect(diffApiMocks.getBranchComparisonFiles).toHaveBeenCalled();
    });
    await user.click(screen.getByRole("button", { name: "Review" }));

    await waitFor(() => {
      expect(useGitActionsStore.getState().notice).toMatchObject({
        kind: "error",
        title: "AI review failed",
        details: debugError,
        expanded: true,
      });
    });
    expect(screen.getByText("Review failed")).toBeInTheDocument();
    expect(
      screen.getAllByText(/External agent output could not be parsed/).length,
    ).toBeGreaterThan(0);
    expect(screen.getAllByText(/See log for more details/).length).toBeGreaterThan(0);
    expect(screen.getByText("AI action failed")).toBeInTheDocument();
    expect(
      screen.queryByText(/external_agent_structured_output_error/),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Copy report data" }));

    expect(clipboardMocks.writeClipboardText).toHaveBeenCalledWith(debugError);
    expect(screen.queryByText("Analysis engine setup")).not.toBeInTheDocument();
    expect(
      screen.queryByText("No actionable review findings returned."),
    ).not.toBeInTheDocument();
  });

  it("renders branch AI progress events while review is running", async () => {
    const user = userEvent.setup();
    let emitProgress = (_payload: unknown) => {};
    localAiMocks.listenToLocalAiRunProgress.mockImplementation((handler) => {
      emitProgress = (payload) => handler(payload);
      return Promise.resolve(() => {});
    });
    localAiMocks.runLocalAiAction.mockReturnValue(new Promise(() => {}));

    render(
      <MantineProvider>
	        <BranchCompareModal
	          repoPath="/repo"
	          initialSourceBranch="feature"
	          initialTargetBranch="main"
	          onClose={vi.fn()}
	        />
      </MantineProvider>,
    );

    await waitFor(() => {
      expect(diffApiMocks.getBranchComparisonFiles).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(localAiMocks.listenToLocalAiRunProgress).toHaveBeenCalled();
    });
    await user.click(screen.getByRole("button", { name: "Review" }));
    const request = localAiMocks.runLocalAiAction.mock.calls[0][0];

    emitProgress({
      runId: request.runId,
      actionKind: "branchReview",
      state: "resolvingRefs",
      message: "Resolving comparison refs",
      error: null,
    });

    await waitFor(() => {
      expect(screen.getByText("Resolving comparison refs")).toBeInTheDocument();
    });
  });

  it("applies anchored AI review findings as bot draft comments", async () => {
    const user = userEvent.setup();
    diffApiMocks.getBranchComparisonFiles.mockResolvedValue([
      { path: "src/app.ts", status: "modified", insertions: 1, deletions: 0 },
    ]);
    diffApiMocks.getBranchComparisonFileDiff.mockResolvedValue([
      {
        header: "@@ -1,1 +1,2 @@",
        old_start: 1,
        old_lines: 1,
        new_start: 1,
        new_lines: 2,
        is_new_file: false,
        lines: [
          { kind: "Context", content: " keep", old_lineno: 1, new_lineno: 1 },
          { kind: "Add", content: "+ risky()", old_lineno: null, new_lineno: 2 },
        ],
      },
    ]);
    localAiMocks.runLocalAiAction.mockResolvedValue({
      actionKind: "branchReview",
      result: {
        kind: "branchReview",
        data: {
          summary: "One issue",
          findings: [
            {
              severity: "high",
              confidence: "medium",
              title: "Missing guard",
              explanation: "The new call can fail.",
              impact: "The UI can become stale.",
              recommendation: "Handle the error path.",
              suggestedComment: "Can we guard this call before updating state?",
              filePath: "src/app.ts",
              side: "new",
              line: 2,
              endLine: null,
            },
          ],
          notes: [],
        },
      },
      modelId: "qwen2.5-coder:7b",
      modelDigest: "digest",
      promptVersion: "v1",
      inputDigest: "input",
      fromCache: false,
      metadata: { omittedFiles: [], omittedSections: [] },
    });

    render(
      <MantineProvider>
	        <BranchCompareModal
	          repoPath="/repo"
	          initialSourceBranch="feature"
	          initialTargetBranch="main"
	          onClose={vi.fn()}
	        />
      </MantineProvider>,
    );

    await screen.findByText(/risky/);
    await user.click(screen.getByRole("button", { name: "Review" }));
    await waitFor(() => {
      expect(screen.getAllByText("Missing guard").length).toBeGreaterThan(0);
    });
    await user.click(screen.getAllByRole("button", { name: "Apply draft" })[0]);

    expect(await screen.findByText("Gitano AI")).toBeInTheDocument();
    expect(
      screen.getByText("Can we guard this call before updating state?"),
    ).toBeInTheDocument();
  });

  it("submits applied AI findings as GitHub pull request comments in PR mode", async () => {
    const user = userEvent.setup();
    diffApiMocks.getBranchComparisonFiles.mockResolvedValue([
      { path: "src/app.ts", status: "modified", insertions: 1, deletions: 0 },
    ]);
    diffApiMocks.getBranchComparisonFileDiff.mockResolvedValue([
      {
        header: "@@ -1,1 +1,2 @@",
        old_start: 1,
        old_lines: 1,
        new_start: 1,
        new_lines: 2,
        is_new_file: false,
        lines: [
          { kind: "Context", content: " keep", old_lineno: 1, new_lineno: 1 },
          { kind: "Add", content: "+ risky()", old_lineno: null, new_lineno: 2 },
        ],
      },
    ]);
    localAiMocks.runLocalAiAction.mockResolvedValue({
      actionKind: "branchReview",
      result: {
        kind: "branchReview",
        data: {
          summary: "One issue",
          findings: [
            {
              severity: "high",
              confidence: "medium",
              title: "Missing guard",
              explanation: "The new call can fail.",
              impact: "The UI can become stale.",
              recommendation: "Handle the error path.",
              suggestedComment: "Can we guard this call before updating state?",
              filePath: "src/app.ts",
              side: "new",
              line: 2,
              endLine: null,
            },
          ],
          notes: [],
        },
      },
      modelId: "qwen2.5-coder:7b",
      modelDigest: "digest",
      promptVersion: "v1",
      inputDigest: "input",
      fromCache: false,
      metadata: { omittedFiles: [], omittedSections: [] },
    });

    render(
      <MantineProvider>
        <BranchCompareModal
          repoPath="/repo"
          initialSourceBranch="refs/remotes/origin/pull/12/head"
          initialTargetBranch="refs/remotes/origin/main"
          pullRequestContext={{
            number: 12,
            title: "Improve checkout flow",
            baseRef: "refs/remotes/origin/main",
            headRef: "refs/remotes/origin/pull/12/head",
            baseLabel: "acme:main",
            headLabel: "acme:feature",
          }}
          onClose={vi.fn()}
        />
      </MantineProvider>,
    );

    await screen.findByText(/risky/);
    await user.click(screen.getByRole("button", { name: "Review" }));
    await waitFor(() => {
      expect(screen.getAllByText("Missing guard").length).toBeGreaterThan(0);
    });
    await user.click(screen.getAllByRole("button", { name: "Apply draft" })[0]);
    await user.click(screen.getByRole("button", { name: "Submit comments" }));

    await waitFor(() => {
      expect(integrationApiMocks.submitGitHubPullRequestReview).toHaveBeenCalledWith({
        path: "/repo",
        number: 12,
        event: "COMMENT",
        body: null,
        comments: [
          {
            path: "src/app.ts",
            body: "Can we guard this call before updating state?",
            side: "RIGHT",
            line: 2,
          },
        ],
      });
    });
    expect(await screen.findByText("Submitted 1 review comment.")).toBeInTheDocument();
  });

  it("renders invalid-anchor AI review findings as notes without apply controls", async () => {
    const user = userEvent.setup();
    diffApiMocks.getBranchComparisonFiles.mockResolvedValue([
      { path: "src/app.ts", status: "modified", insertions: 1, deletions: 0 },
    ]);
    diffApiMocks.getBranchComparisonFileDiff.mockResolvedValue([
      {
        header: "@@ -1,1 +1,2 @@",
        old_start: 1,
        old_lines: 1,
        new_start: 1,
        new_lines: 2,
        is_new_file: false,
        lines: [
          { kind: "Context", content: " keep", old_lineno: 1, new_lineno: 1 },
          { kind: "Add", content: "+ risky()", old_lineno: null, new_lineno: 2 },
        ],
      },
    ]);
    localAiMocks.runLocalAiAction.mockResolvedValue({
      actionKind: "branchReview",
      result: {
        kind: "branchReview",
        data: {
          summary: "One issue",
          findings: [
            {
              severity: "medium",
              confidence: "high",
              title: "Invalid anchor finding",
              explanation: "The concern is useful but the line is not in the diff.",
              impact: "The user still needs to see the feedback.",
              recommendation: "Show it as a note.",
              suggestedComment: "Can we verify this path?",
              filePath: "src/app.ts",
              side: "new",
              line: 99,
              endLine: null,
            },
          ],
          notes: [],
        },
      },
      modelId: "qwen2.5-coder:7b",
      modelDigest: "digest",
      promptVersion: "v1",
      inputDigest: "input",
      fromCache: false,
      metadata: { omittedFiles: [], omittedSections: [] },
    });

    render(
      <MantineProvider>
        <BranchCompareModal
          repoPath="/repo"
          initialSourceBranch="feature"
          initialTargetBranch="main"
          onClose={vi.fn()}
        />
      </MantineProvider>,
    );

    await screen.findByText(/risky/);
    await user.click(screen.getByRole("button", { name: "Review" }));

    await waitFor(() => {
      expect(screen.getByText("Review notes")).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Apply draft" })).not.toBeInTheDocument();
    });
    expect(screen.getByText("Invalid anchor finding")).toBeInTheDocument();
    expect(screen.getByText("Show it as a note.")).toBeInTheDocument();
  });

  it("copies and dismisses AI review findings", async () => {
    const user = userEvent.setup();
    diffApiMocks.getBranchComparisonFiles.mockResolvedValue([
      { path: "src/app.ts", status: "modified", insertions: 1, deletions: 0 },
    ]);
    diffApiMocks.getBranchComparisonFileDiff.mockResolvedValue([
      {
        header: "@@ -1,1 +1,2 @@",
        old_start: 1,
        old_lines: 1,
        new_start: 1,
        new_lines: 2,
        is_new_file: false,
        lines: [
          { kind: "Context", content: " keep", old_lineno: 1, new_lineno: 1 },
          { kind: "Add", content: "+ risky()", old_lineno: null, new_lineno: 2 },
        ],
      },
    ]);
    localAiMocks.runLocalAiAction.mockResolvedValue({
      actionKind: "branchReview",
      result: {
        kind: "branchReview",
        data: {
          summary: "One issue",
          findings: [
            {
              severity: "medium",
              confidence: "high",
              title: "Copyable finding",
              explanation: "This needs attention.",
              impact: "It may fail.",
              recommendation: "Add a guard.",
              suggestedComment: "Please add a guard here.",
              filePath: "src/app.ts",
              side: "new",
              line: 2,
              endLine: null,
            },
          ],
          notes: [],
        },
      },
      modelId: "qwen2.5-coder:7b",
      modelDigest: "digest",
      promptVersion: "v1",
      inputDigest: "input",
      fromCache: false,
      metadata: { omittedFiles: [], omittedSections: [] },
    });

    render(
      <MantineProvider>
	        <BranchCompareModal
	          repoPath="/repo"
	          initialSourceBranch="feature"
	          initialTargetBranch="main"
	          onClose={vi.fn()}
	        />
      </MantineProvider>,
    );

    await screen.findByText(/risky/);
    await user.click(screen.getByRole("button", { name: "Review" }));
    await waitFor(() => {
      expect(screen.getAllByText("Copyable finding").length).toBeGreaterThan(0);
    });
    await user.click(screen.getAllByRole("button", { name: "Copy" })[0]);

    expect(clipboardMocks.writeClipboardText).toHaveBeenCalledWith(
      expect.stringContaining("Copyable finding"),
    );

    await user.click(screen.getAllByRole("button", { name: "Dismiss" })[0]);
    await waitFor(() => {
      expect(screen.queryByText("Copyable finding")).not.toBeInTheDocument();
    });
  });
});
