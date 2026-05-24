import { classNames } from "@/shared/ui";
import type { GitTagRef } from "@/shared/types/git";
import { getTagStatusLabel } from "../../utils/tag-refs";

export function TagStatusChip({ tag }: { tag: GitTagRef }) {
  const label = getTagStatusLabel(tag.status);
  const className = classNames(
    "ml-2 max-w-[96px] flex-shrink-0 truncate rounded border px-1.5 py-0.5 text-[10px] leading-none",
    tag.status === "local-origin"
      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
      : "",
    tag.status === "local" ? "border-zinc-600 bg-zinc-800/70 text-zinc-300" : "",
    tag.status === "origin" ? "border-blue-500/40 bg-blue-500/10 text-blue-200" : "",
    tag.status === "conflict"
      ? "border-amber-500/50 bg-amber-500/10 text-amber-200"
      : "",
    tag.status === "unknown" ? "border-zinc-700 bg-zinc-900 text-zinc-400" : "",
  );

  return (
    <span className={className} title={label} aria-label={`Tag state: ${label}`}>
      {label}
    </span>
  );
}
