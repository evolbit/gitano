import {
  IconCloud,
  IconDeviceDesktop,
} from "@/shared/components/icons/icons";
import type { GitTagRef } from "@/shared/types/git";

const PRESENT_ICON_CLASS = "text-foreground/80";
const ABSENT_ICON_CLASS = "text-muted-foreground/40";

export function TagPresenceIcons({ tag }: { tag?: GitTagRef }) {
  const hasLocal = Boolean(tag?.localObjectId);
  const hasOrigin = Boolean(tag?.originObjectId);
  const isConflict = tag?.status === "conflict";
  const isUnknown = tag?.status === "unknown";
  const localLabel = hasLocal
    ? isConflict
      ? "Local tag differs from remote"
      : "Local tag"
    : "No local tag";
  const originLabel = isUnknown
    ? "Remote tag state unknown"
    : hasOrigin
      ? isConflict
        ? "Remote tag differs from local"
        : "Remote tag"
      : "No remote tag";

  return (
    <span className="grid w-9 shrink-0 grid-cols-2 items-center justify-items-center gap-1">
      <span className="inline-flex h-4 w-4 items-center justify-center">
        <IconDeviceDesktop
          size={14}
          className={hasLocal ? PRESENT_ICON_CLASS : ABSENT_ICON_CLASS}
          aria-label={localLabel}
          title={localLabel}
        />
      </span>
      <span className="inline-flex h-4 w-4 items-center justify-center">
        <IconCloud
          size={14}
          className={hasOrigin ? PRESENT_ICON_CLASS : ABSENT_ICON_CLASS}
          aria-label={originLabel}
          title={originLabel}
        />
      </span>
    </span>
  );
}
