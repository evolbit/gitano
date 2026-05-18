import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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
  getLocalAiModelCatalog: vi.fn(),
  getLocalAiEntitlementStatus: vi.fn(),
  getLocalAiModelPreferences: vi.fn(),
  getLocalAiModelStatus: vi.fn(),
  getLocalAiModelCompatibility: vi.fn(),
  prepareLocalAiModel: vi.fn(),
  setLocalAiModelPreference: vi.fn(),
  listenToLocalAiProgress: vi.fn(),
}));

vi.mock("./api", () => branchApiMocks);
vi.mock("@/shared/api/git/diffs", () => diffApiMocks);
vi.mock("@/shared/api/local-ai", () => localAiMocks);

describe("BranchCompareModal local AI", () => {
  beforeEach(() => {
    branchApiMocks.getBranches.mockImplementation((_repoPath: string, type: string) =>
      Promise.resolve(type === "local" ? ["main", "feature"] : []),
    );
    diffApiMocks.getBranchComparisonFiles.mockResolvedValue([]);
    diffApiMocks.getBranchComparisonFileDiff.mockResolvedValue([]);
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
    localAiMocks.listenToLocalAiProgress.mockReturnValue(Promise.resolve(() => {}));
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("runs local AI analysis for the active branch comparison", async () => {
    const user = userEvent.setup();

    render(
      <MantineProvider>
        <BranchCompareModal
          repoPath="/repo"
          sourceBranch="feature"
          currentBranch="main"
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
      baseRef: "main",
      headRef: "feature",
      comparisonMode: "direct",
      forceRefresh: false,
    });
  });
});
