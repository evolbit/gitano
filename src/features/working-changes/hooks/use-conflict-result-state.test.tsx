import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ChangeType } from "@/shared/types/git";
import {
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
    expect(result.current.acceptedRegionLabel).toBe("Incoming");

    act(() => result.current.removeAcceptedRegionSide());

    expect(result.current.content).toBe(initialDetail.result.text);
    expect(result.current.dirty).toBe(false);
    expect(result.current.acceptedRegionLabel).toBeNull();
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
    expect(incomingFirst.result.current.acceptedRegionLabel).toBe("Combination");
    expect(currentFirst.result.current.content).toBe(
      ["current", "incoming"].join("\n"),
    );
    expect(currentFirst.result.current.acceptedRegionLabel).toBe("Combination");
  });

  it("accepts a whole file side through the backend", async () => {
    const updated = detail({ result: version(GIT_CONFLICT_SIDE.Result, "incoming-file") });
    const initialDetail = detail();
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
      await result.current.acceptIncomingFile();
    });

    expect(acceptConflictSideMock.mock.calls[0]?.[0]).toEqual({
      repoPath: "/repo",
      filePath: "src/conflict.ts",
      side: GIT_CONFLICT_SIDE.Incoming,
      expectedIndexSignature: "index",
      expectedResultSignature: "result",
    });
    expect(result.current.content).toBe("incoming-file");
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
