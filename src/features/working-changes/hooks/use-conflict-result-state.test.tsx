import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ChangeType } from "@/shared/types/git";
import {
  GIT_CONFLICT_AI_DECISION_CHOICE,
  GIT_CONFLICT_CONTENT_KIND,
  GIT_CONFLICT_KIND,
  GIT_CONFLICT_LINE_ENDING,
  GIT_CONFLICT_SIDE,
  GIT_CONFLICT_SIZE_CLASS,
  type GitConflictFileDetail,
  type GitConflictSide,
} from "@/shared/types/git-conflicts";
import { useConflictResultState } from "./use-conflict-result-state";

const writeConflictResultMock = vi.hoisted(() => vi.fn());
const acceptConflictSideMock = vi.hoisted(() => vi.fn());
const markConflictResolvedMock = vi.hoisted(() => vi.fn());

vi.mock("@/shared/api/git/conflicts", () => ({
  writeConflictResult: writeConflictResultMock,
  acceptConflictSide: acceptConflictSideMock,
  markConflictResolved: markConflictResolvedMock,
}));

function wrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return function QueryWrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

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

function detail(overrides: Partial<GitConflictFileDetail> = {}): GitConflictFileDetail {
  return {
    path: "src/conflict.ts",
    status: ChangeType.Conflicted,
    base: null,
    current: version(GIT_CONFLICT_SIDE.Current, "current-file"),
    incoming: version(GIT_CONFLICT_SIDE.Incoming, "incoming-file"),
    result: version(
      GIT_CONFLICT_SIDE.Result,
      [
        "<<<<<<< HEAD",
        "current",
        "=======",
        "incoming",
        ">>>>>>> branch",
      ].join("\n"),
    ),
    regions: [
      {
        id: "conflict-1",
        resultStartLine: 1,
        resultSeparatorLine: 3,
        resultEndLine: 5,
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

describe("useConflictResultState", () => {
  beforeEach(() => {
    writeConflictResultMock.mockReset();
    acceptConflictSideMock.mockReset();
    markConflictResolvedMock.mockReset();
  });

  it("tracks dirty content and saves with expected signatures", async () => {
    const updated = detail({
      result: version(GIT_CONFLICT_SIDE.Result, "saved"),
      signatures: { indexSignature: "index-2", resultSignature: "result-2" },
    });
    const initialDetail = detail();
    writeConflictResultMock.mockResolvedValueOnce(updated);
    const { result } = renderHook(
      () =>
        useConflictResultState({
          repoPath: "/repo",
          filePath: "src/conflict.ts",
          detail: initialDetail,
          activeRegionIndex: 0,
        }),
      { wrapper: wrapper() },
    );

    act(() => result.current.setResultContent("manual"));

    expect(result.current.dirty).toBe(true);

    await act(async () => {
      await result.current.saveResult();
    });

    expect(writeConflictResultMock.mock.calls[0]?.[0]).toEqual({
      repoPath: "/repo",
      filePath: "src/conflict.ts",
      content: "manual",
      expectedIndexSignature: "index",
      expectedResultSignature: "result",
    });
    expect(result.current.content).toBe("saved");
    expect(result.current.dirty).toBe(false);
  });

  it("accepts the active incoming region into the local result content", () => {
    const initialDetail = detail();
    const { result } = renderHook(
      () =>
        useConflictResultState({
          repoPath: "/repo",
          filePath: "src/conflict.ts",
          detail: initialDetail,
          activeRegionIndex: 0,
        }),
      { wrapper: wrapper() },
    );

    act(() => result.current.acceptIncomingRegion());

    expect(result.current.content).toBe("incoming");
    expect(result.current.dirty).toBe(true);
    expect(result.current.acceptedRegion?.label).toBe("Incoming");

    act(() => result.current.removeAcceptedRegionSide());

    expect(result.current.content).toBe(initialDetail.result.text);
    expect(result.current.dirty).toBe(false);
    expect(result.current.acceptedRegion).toBeNull();
  });

  it("starts supported conflicts from the base projection and blocks unresolved no-change regions", async () => {
    const initialDetail = detail({
      base: version(GIT_CONFLICT_SIDE.Base, "base"),
    });
    const { result } = renderHook(
      () =>
        useConflictResultState({
          repoPath: "/repo",
          filePath: "src/conflict.ts",
          detail: initialDetail,
          activeRegionIndex: 0,
        }),
      { wrapper: wrapper() },
    );

    expect(result.current.content).toBe("base");
    expect(result.current.markResolvedBlockedReason).toContain(
      "remaining conflict regions",
    );

    await act(async () => {
      await result.current.markResolved();
    });

    expect(markConflictResolvedMock).not.toHaveBeenCalled();

    act(() => result.current.acceptIncomingRegion());

    expect(result.current.content).toBe("incoming");
    expect(result.current.markResolvedBlockedReason).toBeNull();
  });

  it("resets accepted region content back to the initial projection", () => {
    const initialDetail = detail({
      base: version(GIT_CONFLICT_SIDE.Base, "base"),
    });
    const { result } = renderHook(
      () =>
        useConflictResultState({
          repoPath: "/repo",
          filePath: "src/conflict.ts",
          detail: initialDetail,
          activeRegionIndex: 0,
        }),
      { wrapper: wrapper() },
    );

    act(() => result.current.acceptIncomingRegion());

    expect(result.current.content).toBe("incoming");
    expect(result.current.acceptedRegion?.label).toBe("Incoming");

    act(() => result.current.resetResult());

    expect(result.current.content).toBe("base");
    expect(result.current.dirty).toBe(false);
    expect(result.current.acceptedRegion).toBeNull();
    expect(result.current.markResolvedBlockedReason).toContain(
      "remaining conflict regions",
    );
  });

  it("removes a replaced accepted side back to the original region state", () => {
    const initialDetail = detail({
      base: version(GIT_CONFLICT_SIDE.Base, "base"),
    });
    const { result } = renderHook(
      () =>
        useConflictResultState({
          repoPath: "/repo",
          filePath: "src/conflict.ts",
          detail: initialDetail,
          activeRegionIndex: 0,
        }),
      { wrapper: wrapper() },
    );

    act(() => result.current.acceptCurrentRegion());

    expect(result.current.content).toBe("current");
    expect(result.current.acceptedRegion?.label).toBe("Current");
    expect(result.current.acceptedRegionSide).toBe(GIT_CONFLICT_SIDE.Current);

    act(() => result.current.acceptIncomingRegion());

    expect(result.current.content).toBe("incoming");
    expect(result.current.acceptedRegion?.label).toBe("Incoming");
    expect(result.current.acceptedRegionSide).toBe(GIT_CONFLICT_SIDE.Incoming);

    act(() => result.current.removeAcceptedRegionSide());

    expect(result.current.content).toBe("base");
    expect(result.current.acceptedRegion).toBeNull();
    expect(result.current.acceptedRegionSide).toBeNull();
    expect(result.current.markResolvedBlockedReason).toContain(
      "remaining conflict regions",
    );
  });

  it("accepts a combination of both region sides in the requested order", () => {
    const incomingFirstDetail = detail();
    const currentFirstDetail = detail();
    const incomingFirst = renderHook(
      () =>
        useConflictResultState({
          repoPath: "/repo",
          filePath: "src/conflict.ts",
          detail: incomingFirstDetail,
          activeRegionIndex: 0,
        }),
      { wrapper: wrapper() },
    );
    const currentFirst = renderHook(
      () =>
        useConflictResultState({
          repoPath: "/repo",
          filePath: "src/conflict.ts",
          detail: currentFirstDetail,
          activeRegionIndex: 0,
        }),
      { wrapper: wrapper() },
    );

    act(() => incomingFirst.result.current.acceptIncomingFirstCombination());
    act(() => currentFirst.result.current.acceptCurrentFirstCombination());

    expect(incomingFirst.result.current.content).toBe(
      ["incoming", "current"].join("\n"),
    );
    expect(incomingFirst.result.current.acceptedRegion?.label).toBe("Combination");
    expect(currentFirst.result.current.content).toBe(
      ["current", "incoming"].join("\n"),
    );
    expect(currentFirst.result.current.acceptedRegion?.label).toBe("Combination");
  });

  it("accepts a whole text file side into the local result content", async () => {
    const initialDetail = detail({
      base: version(GIT_CONFLICT_SIDE.Base, "base"),
    });
    const { result } = renderHook(
      () =>
        useConflictResultState({
          repoPath: "/repo",
          filePath: "src/conflict.ts",
          detail: initialDetail,
          activeRegionIndex: 0,
        }),
      { wrapper: wrapper() },
    );

    await act(async () => {
      await result.current.acceptIncomingFile();
    });

    expect(acceptConflictSideMock).not.toHaveBeenCalled();
    expect(result.current.content).toBe("incoming");
    expect(result.current.dirty).toBe(true);
    expect(result.current.acceptedRegions).toEqual([
      { regionId: "conflict-1", label: "Incoming" },
    ]);
    expect(result.current.acceptedRegionSidesById).toEqual({
      "conflict-1": GIT_CONFLICT_SIDE.Incoming,
    });
    expect(result.current.markResolvedBlockedReason).toBeNull();
  });

  it("resets whole-file text acceptance back to the initial projection", async () => {
    const initialDetail = detail({
      base: version(GIT_CONFLICT_SIDE.Base, "base"),
    });
    const { result } = renderHook(
      () =>
        useConflictResultState({
          repoPath: "/repo",
          filePath: "src/conflict.ts",
          detail: initialDetail,
          activeRegionIndex: 0,
        }),
      { wrapper: wrapper() },
    );

    await act(async () => {
      await result.current.acceptIncomingFile();
    });

    expect(result.current.content).toBe("incoming");
    expect(result.current.dirty).toBe(true);

    act(() => result.current.resetResult());

    expect(result.current.content).toBe("base");
    expect(result.current.dirty).toBe(false);
    expect(result.current.markResolvedBlockedReason).toContain(
      "remaining conflict regions",
    );
  });

  it("can remove one block after accepting a whole text file side", async () => {
    const initialDetail = detail({
      base: version(
        GIT_CONFLICT_SIDE.Base,
        ["base one", "middle", "base two"].join("\n"),
      ),
      result: version(
        GIT_CONFLICT_SIDE.Result,
        [
          "<<<<<<< HEAD",
          "current one",
          "=======",
          "incoming one",
          ">>>>>>> branch",
          "middle",
          "<<<<<<< HEAD",
          "current two",
          "=======",
          "incoming two",
          ">>>>>>> branch",
        ].join("\n"),
      ),
      regions: [
        {
          id: "conflict-1",
          resultStartLine: 1,
          resultSeparatorLine: 3,
          resultEndLine: 5,
        },
        {
          id: "conflict-2",
          resultStartLine: 7,
          resultSeparatorLine: 9,
          resultEndLine: 11,
        },
      ],
    });
    const { result } = renderHook(
      () =>
        useConflictResultState({
          repoPath: "/repo",
          filePath: "src/conflict.ts",
          detail: initialDetail,
          activeRegionIndex: 0,
        }),
      { wrapper: wrapper() },
    );

    await act(async () => {
      await result.current.acceptIncomingFile();
    });

    expect(result.current.content).toBe(
      ["incoming one", "middle", "incoming two"].join("\n"),
    );
    expect(result.current.acceptedRegions).toEqual([
      { regionId: "conflict-1", label: "Incoming" },
      { regionId: "conflict-2", label: "Incoming" },
    ]);

    act(() => result.current.removeAcceptedRegionSide("conflict-1"));

    expect(result.current.content).toBe(
      ["base one", "middle", "incoming two"].join("\n"),
    );
    expect(result.current.acceptedRegions).toEqual([
      { regionId: "conflict-2", label: "Incoming" },
    ]);
    expect(result.current.markResolvedBlockedReason).toContain(
      "remaining conflict regions",
    );
  });

  it("saves accepted whole-file text content with the loaded signatures", async () => {
    const initialDetail = detail({
      base: version(GIT_CONFLICT_SIDE.Base, "base"),
    });
    const savedDetail = detail({
      base: version(GIT_CONFLICT_SIDE.Base, "base"),
      result: version(GIT_CONFLICT_SIDE.Result, "incoming-file"),
      regions: [],
      signatures: { indexSignature: "index", resultSignature: "result-2" },
    });
    writeConflictResultMock.mockResolvedValueOnce(savedDetail);
    const { result } = renderHook(
      () =>
        useConflictResultState({
          repoPath: "/repo",
          filePath: "src/conflict.ts",
          detail: initialDetail,
          activeRegionIndex: 0,
        }),
      { wrapper: wrapper() },
    );

    await act(async () => {
      await result.current.acceptIncomingFile();
    });

    await act(async () => {
      await result.current.saveResult();
    });

    expect(writeConflictResultMock.mock.calls[0]?.[0]).toEqual({
      repoPath: "/repo",
      filePath: "src/conflict.ts",
      content: "incoming",
      expectedIndexSignature: "index",
      expectedResultSignature: "result",
    });
    expect(result.current.content).toBe("incoming-file");
    expect(result.current.dirty).toBe(false);
  });

  it("applies a full-file AI result with decision-derived accepted regions", () => {
    const initialDetail = detail({
      base: version(
        GIT_CONFLICT_SIDE.Base,
        ["base one", "middle", "base two"].join("\n"),
      ),
      result: version(
        GIT_CONFLICT_SIDE.Result,
        [
          "<<<<<<< HEAD",
          "current one",
          "=======",
          "incoming one",
          ">>>>>>> branch",
          "middle",
          "<<<<<<< HEAD",
          "current two",
          "=======",
          "incoming two",
          ">>>>>>> branch",
        ].join("\n"),
      ),
      regions: [
        {
          id: "conflict-1",
          resultStartLine: 1,
          resultSeparatorLine: 3,
          resultEndLine: 5,
        },
        {
          id: "conflict-2",
          resultStartLine: 7,
          resultSeparatorLine: 9,
          resultEndLine: 11,
        },
      ],
    });
    const { result } = renderHook(
      () =>
        useConflictResultState({
          repoPath: "/repo",
          filePath: "src/conflict.ts",
          detail: initialDetail,
          activeRegionIndex: 0,
        }),
      { wrapper: wrapper() },
    );

    act(() => {
      result.current.applyAiFileResult("resolved by ai", [
        {
          regionId: "conflict-1",
          selectedChoice: GIT_CONFLICT_AI_DECISION_CHOICE.Incoming,
          reason: "Incoming keeps the new pricing behavior.",
        },
        {
          regionId: "conflict-2",
          selectedChoice: GIT_CONFLICT_AI_DECISION_CHOICE.Combination,
          reason: "Both sides contain independent checks.",
        },
      ]);
    });

    expect(result.current.content).toBe("resolved by ai");
    expect(result.current.dirty).toBe(true);
    expect(result.current.markResolvedBlockedReason).toBeNull();
    expect(result.current.acceptedRegions).toEqual([
      { regionId: "conflict-1", label: "Incoming" },
      { regionId: "conflict-2", label: "Combination" },
    ]);
    expect(result.current.acceptedRegionSidesById).toEqual({
      "conflict-1": GIT_CONFLICT_SIDE.Incoming,
      "conflict-2": null,
    });
  });

  it("uses the backend side acceptance for missing-side file choices", async () => {
    const updated = detail({
      current: null,
      result: version(GIT_CONFLICT_SIDE.Result, ""),
    });
    const initialDetail = detail({
      current: null,
      incoming: version(GIT_CONFLICT_SIDE.Incoming, "incoming-file"),
    });
    acceptConflictSideMock.mockResolvedValueOnce(updated);
    const { result } = renderHook(
      () =>
        useConflictResultState({
          repoPath: "/repo",
          filePath: "src/conflict.ts",
          detail: initialDetail,
          activeRegionIndex: 0,
        }),
      { wrapper: wrapper() },
    );

    await act(async () => {
      await result.current.acceptCurrentFile();
    });

    expect(acceptConflictSideMock.mock.calls[0]?.[0]).toEqual({
      repoPath: "/repo",
      filePath: "src/conflict.ts",
      side: GIT_CONFLICT_SIDE.Current,
      expectedIndexSignature: "index",
      expectedResultSignature: "result",
    });
  });

  it("does not mark resolved while conflict markers remain", async () => {
    const initialDetail = detail();
    const { result } = renderHook(
      () =>
        useConflictResultState({
          repoPath: "/repo",
          filePath: "src/conflict.ts",
          detail: initialDetail,
          activeRegionIndex: 0,
        }),
      { wrapper: wrapper() },
    );

    await act(async () => {
      await result.current.markResolved();
    });

    expect(markConflictResolvedMock).not.toHaveBeenCalled();
    expect(result.current.markResolvedBlockedReason).toContain(
      "remaining conflict markers",
    );
  });

  it("saves dirty content before marking the file resolved", async () => {
    const onResolved = vi.fn();
    const saved = detail({
      result: version(GIT_CONFLICT_SIDE.Result, "saved"),
      signatures: { indexSignature: "index-2", resultSignature: "result-2" },
    });
    const initialDetail = detail();
    writeConflictResultMock.mockResolvedValueOnce(saved);
    markConflictResolvedMock.mockResolvedValueOnce(undefined);
    const { result } = renderHook(
      () =>
        useConflictResultState({
          repoPath: "/repo",
          filePath: "src/conflict.ts",
          detail: initialDetail,
          activeRegionIndex: 0,
          onResolved,
        }),
      { wrapper: wrapper() },
    );

    act(() => result.current.setResultContent("manual"));

    await act(async () => {
      await result.current.markResolved();
    });

    await waitFor(() => {
      expect(markConflictResolvedMock.mock.calls[0]?.[0]).toEqual({
        repoPath: "/repo",
        filePath: "src/conflict.ts",
        expectedIndexSignature: "index-2",
        expectedResultSignature: "result-2",
      });
    });
    expect(onResolved).toHaveBeenCalled();
  });
});
