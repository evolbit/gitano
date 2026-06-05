import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ChangeType } from "@/shared/types/git";
import {
  GIT_CONFLICT_CONTENT_KIND,
  GIT_CONFLICT_LINE_ENDING,
  GIT_CONFLICT_SIDE,
  GIT_CONFLICT_SIZE_CLASS,
} from "@/shared/types/git-conflicts";
import type { GitConflictFileDetail } from "@/shared/types/git-conflicts";
import {
  conflictFileDetailQueryKey,
  useConflictFileDetail,
} from "./use-conflict-file-detail";

const getMergeConflictFileMock = vi.hoisted(() => vi.fn());

vi.mock("@/shared/api/git/conflicts", () => ({
  getMergeConflictFile: getMergeConflictFileMock,
}));

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
}

function wrapper(client = createQueryClient()) {
  return function QueryWrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

function detail(): GitConflictFileDetail {
  const version = {
    side: GIT_CONFLICT_SIDE.Result,
    contentKind: GIT_CONFLICT_CONTENT_KIND.Text,
    text: "result",
    size: {
      byteSize: 6,
      lineCount: 1,
      sizeClass: GIT_CONFLICT_SIZE_CLASS.Normal,
    },
    lineEnding: GIT_CONFLICT_LINE_ENDING.Lf,
    hasFinalNewline: true,
  };

  return {
    path: "src/conflict.ts",
    status: ChangeType.Conflicted,
    base: null,
    current: null,
    incoming: null,
    result: version,
    regions: [],
    conflictKinds: [],
    contentKind: GIT_CONFLICT_CONTENT_KIND.Text,
    signatures: {
      indexSignature: "index",
      resultSignature: "result",
    },
  };
}

describe("useConflictFileDetail", () => {
  beforeEach(() => {
    getMergeConflictFileMock.mockReset();
  });

  it("loads selected conflict detail by repo and file path", async () => {
    getMergeConflictFileMock.mockResolvedValueOnce(detail());

    const { result } = renderHook(
      () =>
        useConflictFileDetail({
          repoPath: "/repo",
          filePath: "src/conflict.ts",
          fileSignature: "sig-1",
        }),
      { wrapper: wrapper() },
    );

    await waitFor(() => {
      expect(result.current.detail?.path).toBe("src/conflict.ts");
    });

    expect(getMergeConflictFileMock).toHaveBeenCalledWith(
      "/repo",
      "src/conflict.ts",
    );
  });

  it("does not load when disabled", () => {
    renderHook(
      () =>
        useConflictFileDetail({
          repoPath: "/repo",
          filePath: "src/conflict.ts",
          enabled: false,
        }),
      { wrapper: wrapper() },
    );

    expect(getMergeConflictFileMock).not.toHaveBeenCalled();
  });

  it("includes the file signature in the query key", () => {
    expect(
      conflictFileDetailQueryKey("/repo", "src/conflict.ts", "sig-1"),
    ).toEqual([
      "working-changes-conflict-file-detail",
      "/repo",
      "src/conflict.ts",
      "sig-1",
    ]);
  });
});
