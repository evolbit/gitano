import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ChangeType } from "@/shared/types/git";
import {
  GIT_CONFLICT_AI_CANDIDATE_KIND,
  GIT_CONFLICT_AI_SCOPE_KIND,
  GIT_CONFLICT_CONTENT_KIND,
  GIT_CONFLICT_KIND,
  GIT_CONFLICT_LINE_ENDING,
  GIT_CONFLICT_SIDE,
  GIT_CONFLICT_SIZE_CLASS,
  type GitConflictFileDetail,
  type GitConflictSide,
} from "@/shared/types/git-conflicts";
import { buildConflictResultProjection } from "../components/conflict-resolution-surface/utils/conflict-result-projection";
import { useConflictAiFix } from "./use-conflict-ai-fix";

const runLocalAiActionMock = vi.hoisted(() => vi.fn());

vi.mock("@/shared/api/local-ai", () => ({
  runLocalAiAction: runLocalAiActionMock,
}));

function version(side: GitConflictSide, text: string) {
  return {
    side,
    contentKind: GIT_CONFLICT_CONTENT_KIND.Text,
    text,
    size: {
      byteSize: text.length,
      lineCount: text.split("\n").length,
      sizeClass: GIT_CONFLICT_SIZE_CLASS.Normal,
    },
    lineEnding: GIT_CONFLICT_LINE_ENDING.Lf,
    hasFinalNewline: false,
  };
}

function detail(
  overrides: Partial<GitConflictFileDetail> = {},
): GitConflictFileDetail {
  return {
    path: "src/conflict.ts",
    status: ChangeType.Conflicted,
    base: null,
    current: version(GIT_CONFLICT_SIDE.Current, "current-file"),
    incoming: version(GIT_CONFLICT_SIDE.Incoming, "incoming-file"),
    result: version(
      GIT_CONFLICT_SIDE.Result,
      [
        "before",
        "<<<<<<< HEAD",
        "current",
        "=======",
        "incoming",
        ">>>>>>> branch",
        "after",
      ].join("\n"),
    ),
    regions: [
      {
        id: "conflict-1",
        resultStartLine: 2,
        resultSeparatorLine: 4,
        resultEndLine: 6,
      },
    ],
    conflictKinds: [GIT_CONFLICT_KIND.BothModified],
    contentKind: GIT_CONFLICT_CONTENT_KIND.Text,
    signatures: {
      indexSignature: "index",
      resultSignature: "result",
    },
    ...overrides,
  };
}

describe("useConflictAiFix", () => {
  beforeEach(() => {
    runLocalAiActionMock.mockReset();
  });

  it("runs a scoped region AI request and applies the returned candidate", async () => {
    const onApplyFileContent = vi.fn();
    const onApplyRegionContent = vi.fn();
    const fileDetail = detail();
    const resultProjection = buildConflictResultProjection({
      baseText: fileDetail.base?.text ?? null,
      regions: fileDetail.regions,
      resultText: fileDetail.result.text ?? "",
    });
    runLocalAiActionMock.mockResolvedValueOnce({
      result: {
        kind: "conflictCandidate",
        data: {
          candidate: {
            kind: GIT_CONFLICT_AI_CANDIDATE_KIND.RegionReplacement,
            scope: {
              kind: GIT_CONFLICT_AI_SCOPE_KIND.Region,
              filePath: "src/conflict.ts",
              regionId: "conflict-1",
            },
            summary: "Use resolved content",
            replacement: "resolved",
            inputSignatures: {
              indexSignature: "index",
              resultSignature: "result",
            },
          },
        },
      },
    });
    const { result } = renderHook(() =>
      useConflictAiFix({
        repoPath: "/repo",
        filePath: "src/conflict.ts",
        detail: fileDetail,
        activeRegion: fileDetail.regions[0],
        resultRegions: resultProjection.regions,
        onApplyFileContent,
        onApplyRegionContent,
      }),
    );

    await act(async () => {
      await result.current.runRegionFix();
    });

    expect(runLocalAiActionMock.mock.calls[0]?.[0]).toMatchObject({
      repoPath: "/repo",
      actionKind: "mergeConflictSuggestions",
      conflictScope: {
        kind: GIT_CONFLICT_AI_SCOPE_KIND.Region,
        filePath: "src/conflict.ts",
        regionId: "conflict-1",
      },
    });

    act(() => result.current.applyCandidate());

    expect(onApplyRegionContent).toHaveBeenCalledWith("conflict-1", "resolved");
    expect(onApplyFileContent).not.toHaveBeenCalled();
    expect(result.current.candidate).toBeNull();
  });

  it("rejects stale candidates before applying content", async () => {
    const onApplyFileContent = vi.fn();
    const onApplyRegionContent = vi.fn();
    const fileDetail = detail();
    const resultProjection = buildConflictResultProjection({
      baseText: fileDetail.base?.text ?? null,
      regions: fileDetail.regions,
      resultText: fileDetail.result.text ?? "",
    });
    runLocalAiActionMock.mockResolvedValueOnce({
      result: {
        kind: "conflictCandidate",
        data: {
          candidate: {
            kind: GIT_CONFLICT_AI_CANDIDATE_KIND.FullFileResult,
            scope: {
              kind: GIT_CONFLICT_AI_SCOPE_KIND.File,
              filePath: "src/conflict.ts",
            },
            summary: "Resolve file",
            content: "resolved file",
            inputSignatures: {
              indexSignature: "old-index",
              resultSignature: "result",
            },
          },
        },
      },
    });
    const { result } = renderHook(() =>
      useConflictAiFix({
        repoPath: "/repo",
        filePath: "src/conflict.ts",
        detail: fileDetail,
        activeRegion: fileDetail.regions[0],
        resultRegions: resultProjection.regions,
        onApplyFileContent,
        onApplyRegionContent,
      }),
    );

    await act(async () => {
      await result.current.runFileFix();
    });
    act(() => result.current.applyCandidate());

    expect(onApplyFileContent).not.toHaveBeenCalled();
    expect(onApplyRegionContent).not.toHaveBeenCalled();
    expect(result.current.error).toContain("stale");
  });
});
