import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { PullRequestComment } from "@/shared/api/integrations";
import { PullRequestHistory } from "./pull-request-history";

const reviewComment: PullRequestComment = {
  id: 1,
  kind: "review",
  author: { login: "mordonez-me", avatarUrl: null },
  body: "Good",
  createdAt: "2026-05-28T08:44:00.000Z",
  updatedAt: "2026-05-28T08:44:00.000Z",
  path: "package.json",
  side: "RIGHT",
  line: 16,
  originalLine: null,
  diffHunk: "@@ -13,7 +13,7 @@\n-  old line\n+  new line\n   context",
  subjectType: "line",
  inReplyToId: null,
};

describe("PullRequestHistory", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders review diff hunks with hunk, deletion, addition, and context colors", () => {
    render(
      <PullRequestHistory
        pullRequest={null}
        comments={[reviewComment]}
        commits={[]}
        loading={false}
        error={null}
      />,
    );

    const hunk = screen.getByTestId("pull-request-diff-hunk");
    const lines = Array.from(hunk.querySelectorAll("span"));

    expect(lines[0]).toHaveTextContent("@@ -13,7 +13,7 @@");
    expect(lines[0]).toHaveClass("bg-background-emphasis", "text-zinc-400");
    expect(lines[1].textContent).toBe("-  old line");
    expect(lines[1]).toHaveClass("bg-red-950/50", "text-red-200");
    expect(lines[2].textContent).toBe("+  new line");
    expect(lines[2]).toHaveClass("bg-emerald-950/50", "text-emerald-200");
    expect(lines[3]).toHaveTextContent("context");
    expect(lines[3]).toHaveClass("text-zinc-300");
  });
});
