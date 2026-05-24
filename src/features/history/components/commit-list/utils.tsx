import type React from "react";
import type { CommitListItem } from "@/shared/types/git";

export function createCommitAiRunId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `commit-analysis-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function formatCommitDate(value: number): string {
  if (!value) return "";
  const date = new Date(value * 1000);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("en-GB", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function toSearchableText(commit: CommitListItem): string {
  return [commit.message, commit.author, commit.sha, ...(commit.refs ?? [])]
    .join(" ")
    .toLowerCase();
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function highlightMatches(
  text: string,
  query: string,
): React.ReactNode {
  if (!query) {
    return text;
  }

  const pattern = new RegExp(`(${escapeRegExp(query)})`, "ig");
  const parts = text.split(pattern);
  if (parts.length <= 1) {
    return text;
  }

  return parts.map((part, index) =>
    part.toLowerCase() === query.toLowerCase() ? (
      <span
        key={`${part}-${index}`}
        className="text-sky-400"
      >
        {part}
      </span>
    ) : (
      <span key={`${part}-${index}`}>{part}</span>
    ),
  );
}

export function getRefBadgeClass(refLabel: string): string {
  if (refLabel.startsWith("tag:")) {
    return "border-lime-500/40 bg-lime-500/10 text-lime-200";
  }
  if (refLabel.startsWith("origin/")) {
    return "border-blue-500/40 bg-blue-500/10 text-blue-200";
  }
  return "border-violet-500/40 bg-violet-500/10 text-violet-200";
}
