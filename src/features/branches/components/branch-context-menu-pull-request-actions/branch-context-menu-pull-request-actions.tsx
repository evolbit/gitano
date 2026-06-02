import {
  BranchContextMenuItem,
  BranchContextMenuSectionTitle,
} from "../branch-context-menu-parts/branch-context-menu-parts";
import type { MatchingBranchPullRequest } from "../../types";

type BranchContextMenuPullRequestActionsProps = {
  pullRequest: MatchingBranchPullRequest;
  onCopyText: (text: string, successTitle: string, successDetails: string) => void;
  onOpenPullRequestUrl: (url: string) => void;
  onOpenPullRequestReview: (pullRequest: MatchingBranchPullRequest) => void;
};

export function BranchContextMenuPullRequestActions({
  pullRequest,
  onCopyText,
  onOpenPullRequestUrl,
  onOpenPullRequestReview,
}: BranchContextMenuPullRequestActionsProps) {
  return (
    <>
      <BranchContextMenuSectionTitle>Pull request</BranchContextMenuSectionTitle>
      <BranchContextMenuItem
        className="px-4 py-2 hover:bg-zinc-700 cursor-pointer"
        onClick={() => onOpenPullRequestReview(pullRequest)}
      >
        Review pull request #{pullRequest.number}
      </BranchContextMenuItem>
      <BranchContextMenuItem
        className="px-4 py-2 hover:bg-zinc-700 cursor-pointer"
        onClick={() => onOpenPullRequestUrl(pullRequest.htmlUrl)}
      >
        View pull request #{pullRequest.number} on GitHub.com
      </BranchContextMenuItem>
      <BranchContextMenuItem
        className="px-4 py-2 hover:bg-zinc-700 cursor-pointer"
        onClick={() =>
          onCopyText(
            pullRequest.htmlUrl,
            "Copied pull request URL",
            `Copied pull request #${pullRequest.number} URL.`,
          )
        }
      >
        Copy link for pull request #{pullRequest.number}
      </BranchContextMenuItem>
    </>
  );
}
