import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ChangeType } from "@/shared/types/git";
import {
  GIT_CONFLICT_CONTENT_KIND,
  GIT_CONFLICT_KIND,
  GIT_CONFLICT_LINE_ENDING,
  GIT_CONFLICT_SIDE,
  GIT_CONFLICT_SIZE_CLASS,
} from "@/shared/types/git-conflicts";
import { ConflictMetadataBar } from "./conflict-metadata-bar";
import type { GitConflictFileDetail } from "@/shared/types/git-conflicts";

const detail: GitConflictFileDetail = {
  path: "target.txt",
  status: ChangeType.Conflicted,
  base: null,
  current: null,
  incoming: null,
  result: {
    side: GIT_CONFLICT_SIDE.Result,
    contentKind: GIT_CONFLICT_CONTENT_KIND.Text,
    text: "content",
    size: {
      byteSize: 7,
      lineCount: 1,
      sizeClass: GIT_CONFLICT_SIZE_CLASS.Normal,
    },
    lineEnding: GIT_CONFLICT_LINE_ENDING.Lf,
    hasFinalNewline: false,
  },
  regions: [
    { id: "conflict-1", resultStartLine: 1, resultSeparatorLine: 2, resultEndLine: 3 },
    { id: "conflict-2", resultStartLine: 8, resultSeparatorLine: 9, resultEndLine: 10 },
  ],
  conflictKinds: [GIT_CONFLICT_KIND.DeletedByIncoming],
  contentKind: GIT_CONFLICT_CONTENT_KIND.Text,
  signatures: {
    indexSignature: "index",
    resultSignature: "result",
  },
};

describe("ConflictMetadataBar", () => {
  it("shows conflict metadata and navigates regions", () => {
    const onPreviousRegion = vi.fn();
    const onNextRegion = vi.fn();

    render(
      <ConflictMetadataBar
        detail={detail}
        activeRegionIndex={0}
        onPreviousRegion={onPreviousRegion}
        onNextRegion={onNextRegion}
      />,
    );

    expect(screen.getByText(/Incoming deleted/)).toBeInTheDocument();
    expect(screen.getByText("Region 1 of 2")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Next conflict region" }));

    expect(onNextRegion).toHaveBeenCalled();
    expect(onPreviousRegion).not.toHaveBeenCalled();
  });
});
