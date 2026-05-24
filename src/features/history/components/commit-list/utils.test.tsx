import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { CommitListItem } from "@/shared/types/git";
import {
  formatCommitDate,
  getRefBadgeClass,
  highlightMatches,
  toSearchableText,
} from "./utils";

const commit: CommitListItem = {
  sha: "abc123456789",
  parents: [],
  refs: ["main", "tag:v1"],
  message: "Fix search escaping",
  author: "Test User",
  author_initial: "T",
  date: 1_700_000_000,
  current_branch: "main",
  source_branch: "main",
  commit_history: [],
  files: 1,
};

describe("commit list utilities", () => {
  it("formats dates and searchable commit text", () => {
    expect(formatCommitDate(0)).toBe("");
    expect(formatCommitDate(commit.date)).toContain("2023");
    expect(toSearchableText(commit)).toContain("fix search escaping");
    expect(toSearchableText(commit)).toContain("tag:v1");
  });

  it("highlights literal search matches and classifies refs", () => {
    render(<div>{highlightMatches("Fix [query]", "[query]")}</div>);

    expect(screen.getByText("[query]")).toHaveClass("text-sky-400");
    expect(getRefBadgeClass("tag:v1")).toContain("text-lime-200");
    expect(getRefBadgeClass("origin/main")).toContain("text-blue-200");
    expect(getRefBadgeClass("main")).toContain("text-violet-200");
  });
});
