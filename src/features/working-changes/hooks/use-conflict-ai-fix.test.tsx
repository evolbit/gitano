import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ChangeType } from "@/shared/types/git";
import {
  GIT_CONFLICT_AI_CANDIDATE_KIND,
  GIT_CONFLICT_AI_DECISION_CHOICE,
  GIT_CONFLICT_AI_SCOPE_KIND,
  GIT_CONFLICT_CONTENT_KIND,
  GIT_CONFLICT_KIND,
  GIT_CONFLICT_LINE_ENDING,
  GIT_CONFLICT_SIDE,
  GIT_CONFLICT_SIZE_CLASS,
  type GitConflictFileDetail,
  type GitConflictSide,
} from "@/shared/types/git-conflicts";
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

  it("runs a file AI request and applies the returned candidate immediately", async () => {
    const onApplyFileContent = vi.fn();
    const fileDetail = detail();
    const decisions = [
      {
        regionId: "conflict-1",
        selectedChoice: GIT_CONFLICT_AI_DECISION_CHOICE.Incoming,
        reason: "Incoming keeps the expected branch behavior.",
      },
    ];
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
            summary: "Applied incoming pricing behavior.",
            details: "Kept incoming because it matches the expected branch behavior.",
            content: "resolved file",
            decisions,
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
        onApplyFileContent,
      }),
    );

    await act(async () => {
      await result.current.runFileFix();
    });

    expect(runLocalAiActionMock.mock.calls[0]?.[0]).toMatchObject({
      repoPath: "/repo",
      actionKind: "mergeConflictSuggestions",
      conflictScope: {
        kind: GIT_CONFLICT_AI_SCOPE_KIND.File,
        filePath: "src/conflict.ts",
      },
    });
    expect(onApplyFileContent).toHaveBeenCalledWith("resolved file", decisions);
    expect(result.current.candidateSummary).toBe(
      "Applied incoming pricing behavior.",
    );
    expect(result.current.candidateDetails).toBe(
      "Kept incoming because it matches the expected branch behavior.",
    );
  });

  it("rejects stale candidates before applying content", async () => {
    const onApplyFileContent = vi.fn();
    const fileDetail = detail();
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
            decisions: [],
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
        onApplyFileContent,
      }),
    );

    await act(async () => {
      await result.current.runFileFix();
    });

    expect(onApplyFileContent).not.toHaveBeenCalled();
    expect(result.current.error).toContain("stale");
  });

  it("accepts legacy snake-case input signatures from cached candidates", async () => {
    const onApplyFileContent = vi.fn();
    const fileDetail = detail();
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
            decisions: [],
            input_signatures: {
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
        onApplyFileContent,
      }),
    );

    await act(async () => {
      await result.current.runFileFix();
    });

    expect(onApplyFileContent).toHaveBeenCalledWith("resolved file", []);
    expect(result.current.error).toBeNull();
  });

  it("falls back to decision text when candidate details are missing", async () => {
    const onApplyFileContent = vi.fn();
    const fileDetail = detail();
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
            summary: "Resolved the file.",
            content: "resolved file",
            decisions: [
              {
                regionId: "conflict-1",
                selectedChoice: GIT_CONFLICT_AI_DECISION_CHOICE.Incoming,
                reason: "Incoming keeps the expected branch behavior.",
              },
              {
                regionId: "conflict-2",
                selectedChoice: GIT_CONFLICT_AI_DECISION_CHOICE.Combination,
                reason: "Both sides keep compatible validation changes.",
              },
            ],
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
        onApplyFileContent,
      }),
    );

    await act(async () => {
      await result.current.runFileFix();
    });

    expect(result.current.candidateSummary).toBe("Resolved the file.");
    expect(result.current.candidateDetails).toBe(
      [
        "conflict-1: Incoming - Incoming keeps the expected branch behavior.",
        "conflict-2: Combination - Both sides keep compatible validation changes.",
      ].join("\n"),
    );
  });
});
