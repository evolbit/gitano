import type {
  LocalAiBranchReviewFinding,
  LocalAiBranchReviewNote,
  LocalAiRunResult,
} from "@/shared/api/local-ai";
import type { DiffLineAnchor } from "@/features/diffs";
import type { DiffHunk } from "@/shared/types/git";

export function findingAnchorKey({
  filePath,
  side,
  line,
}: {
  filePath: string;
  side: "old" | "new";
  line: number;
}) {
  return `${filePath}:${side}:${line}`;
}

export function findingKey(finding: LocalAiBranchReviewFinding) {
  return `${findingAnchorKey(finding)}:${finding.title}`;
}

export function buildAnchorIndex(hunksByPath: Record<string, DiffHunk[]>) {
  const index = new Map<string, DiffLineAnchor>();

  Object.entries(hunksByPath).forEach(([filePath, fileHunks]) => {
    fileHunks.forEach((hunk, hunkIdx) => {
      hunk.lines.forEach((line, lineIdx) => {
        if (line.kind === "Add" && line.new_lineno !== null) {
          index.set(
            findingAnchorKey({
              filePath,
              side: "new",
              line: line.new_lineno,
            }),
            {
              filePath,
              hunkIdx,
              lineIdx,
              side: "new",
              oldLine: line.old_lineno,
              newLine: line.new_lineno,
              kind: line.kind,
            },
          );
        }
        if (line.kind === "Del" && line.old_lineno !== null) {
          index.set(
            findingAnchorKey({
              filePath,
              side: "old",
              line: line.old_lineno,
            }),
            {
              filePath,
              hunkIdx,
              lineIdx,
              side: "old",
              oldLine: line.old_lineno,
              newLine: line.new_lineno,
              kind: line.kind,
            },
          );
        }
      });
    });
  });

  return index;
}

export function formatFindingFeedback(finding: LocalAiBranchReviewFinding) {
  return [
    `**${finding.title}**`,
    "",
    `\`${finding.filePath}:${finding.line}\``,
    "",
    finding.explanation,
    finding.impact ? `\nImpact: ${finding.impact}` : "",
    finding.recommendation ? `\nRecommendation: ${finding.recommendation}` : "",
    finding.suggestedComment
      ? `\nSuggested comment:\n\n${finding.suggestedComment}`
      : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export function formatNoteFeedback(note: LocalAiBranchReviewNote) {
  return [
    `**${note.title}**`,
    note.filePath ? `\n\`${note.filePath}\`` : "",
    "",
    note.explanation,
    note.recommendation ? `\nRecommendation: ${note.recommendation}` : "",
    note.suggestedComment ? `\nSuggested comment:\n\n${note.suggestedComment}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export function reviewResultData(result: LocalAiRunResult | null) {
  return result?.result.kind === "branchReview" ? result.result.data : null;
}

export function visibleBranchReviewResult(
  result: LocalAiRunResult | null,
  anchorIndex: Map<string, DiffLineAnchor>,
  dismissedFindingKeys: Set<string>,
  reviewHunksLoading: boolean,
): LocalAiRunResult | null {
  if (!result || result.result.kind !== "branchReview") {
    return result;
  }

  const data = result.result.data;
  const notes = [...data.notes];
  const findings = data.findings.filter((finding) => {
    if (dismissedFindingKeys.has(findingKey(finding))) {
      return false;
    }

    const anchor = anchorIndex.get(findingAnchorKey(finding));
    if (!anchor && !reviewHunksLoading) {
      notes.push({
        severity: finding.severity,
        confidence: finding.confidence,
        title: finding.title,
        explanation: finding.explanation,
        recommendation: finding.recommendation,
        suggestedComment: finding.suggestedComment,
        filePath: finding.filePath,
      });
      return false;
    }

    return true;
  });

  return {
    ...result,
    result: {
      kind: "branchReview",
      data: {
        ...data,
        findings,
        notes,
      },
    },
  };
}
