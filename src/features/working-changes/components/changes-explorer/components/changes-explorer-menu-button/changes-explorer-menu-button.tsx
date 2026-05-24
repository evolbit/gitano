import { memo, type ReactNode } from "react";
import { IconCheck } from "@/shared/components/icons/icons";

type ChangesExplorerMenuButtonProps = {
  children: ReactNode;
  active?: boolean;
  disabled?: boolean;
  onClick?: () => void;
};

export const ChangesExplorerMenuButton = memo(
  function ChangesExplorerMenuButton({
    children,
    active = false,
    disabled = false,
    onClick,
  }: ChangesExplorerMenuButtonProps) {
    return (
      <button
        type="button"
        className={`flex w-full items-center justify-between px-3 py-1.5 text-left transition-colors ${
          disabled
            ? "cursor-default text-zinc-500"
            : active
              ? "bg-zinc-800 text-white"
              : "text-zinc-200 hover:bg-zinc-800"
        }`}
        disabled={disabled}
        onClick={onClick}
      >
        <span>{children}</span>
        {active ? <IconCheck size={14} /> : null}
      </button>
    );
  },
);
