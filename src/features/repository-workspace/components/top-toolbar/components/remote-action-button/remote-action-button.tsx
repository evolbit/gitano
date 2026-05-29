import { Tooltip, Text } from "@mantine/core";
import type { RemoteActionButtonProps } from "../../types";

export const RemoteActionButton: React.FC<RemoteActionButtonProps> = ({
  label,
  icon,
  onClick,
  onFocus,
  onPointerEnter,
  disabled = false,
  loading = false,
  tooltip,
  rightSlot,
}) => {
  const content = (
    <div
      className={`flex h-full overflow-hidden rounded border transition-colors ${
        loading
          ? "border-zinc-700/80 bg-zinc-800/70"
          : disabled
            ? "border-transparent opacity-45"
            : "border-transparent hover:border-zinc-700/80 hover:bg-zinc-800/70"
      }`}
    >
      <button
        type="button"
        className={`flex min-w-[60px] flex-col items-center justify-center gap-0.5 px-2.5 py-1.5 text-left ${
          loading
            ? "cursor-progress text-zinc-400"
            : disabled
              ? "cursor-not-allowed text-zinc-500"
              : "cursor-pointer text-zinc-400"
        }`}
        onClick={onClick}
        onFocus={onFocus}
        onPointerEnter={onPointerEnter}
        disabled={disabled || loading}
      >
        <Text
          size="xs"
          className={`text-[10px] leading-none ${
            disabled ? "text-zinc-500" : "text-zinc-400"
          }`}
        >
          {label}
        </Text>
        <div className={disabled ? "text-zinc-500" : "text-zinc-100"}>
          {loading ? (
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-500/40 border-t-zinc-100" />
          ) : (
            icon
          )}
        </div>
      </button>
      {rightSlot}
    </div>
  );

  if (!tooltip) {
    return content;
  }

  return (
    <Tooltip
      label={tooltip}
      openDelay={150}
    >
      {content}
    </Tooltip>
  );
};
