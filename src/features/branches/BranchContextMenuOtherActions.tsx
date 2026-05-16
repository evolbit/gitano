import type { RefObject } from "react";
import { IconChevronRight } from "@/components/icons";

type BranchContextMenuOtherActionsProps = {
  branchName: string;
  showOther: boolean;
  submenuLeft: boolean;
  submenuDirection: "down" | "up";
  otherRef: RefObject<HTMLDivElement>;
  onShowOtherChange: (showOther: boolean | ((current: boolean) => boolean)) => void;
  onCloseMenus: () => void;
  onCopyText: (text: string, successTitle: string, successDetails: string) => void;
  onCopyBranchTipSha: (branchName: string) => void;
  onSubmenuMouseEnter: () => void;
  onSubmenuMouseLeave: () => void;
};

export function BranchContextMenuOtherActions({
  branchName,
  showOther,
  submenuLeft,
  submenuDirection,
  otherRef,
  onShowOtherChange,
  onCloseMenus,
  onCopyText,
  onCopyBranchTipSha,
  onSubmenuMouseEnter,
  onSubmenuMouseLeave,
}: BranchContextMenuOtherActionsProps) {
  return (
    <div className="relative" ref={otherRef}>
      <div
        className="flex cursor-pointer items-center gap-2 px-4 py-2 hover:bg-zinc-700"
        onMouseEnter={() => onShowOtherChange(true)}
        onClick={() => onShowOtherChange((value) => !value)}
        tabIndex={0}
      >
        Otras acciones
        <IconChevronRight size={14} />
      </div>
      {showOther ? (
        <div
          className={`submenu absolute z-[100000] min-w-[180px] select-none rounded border border-zinc-600 bg-zinc-900/95 py-1 text-xs text-zinc-200 shadow-lg ${
            submenuDirection === "down" ? "top-0" : "bottom-0"
          } ${submenuLeft ? "left-full ml-1" : "right-full mr-1"}`}
          onMouseEnter={onSubmenuMouseEnter}
          onMouseLeave={onSubmenuMouseLeave}
        >
          <div
            className="cursor-pointer px-4 py-2 hover:bg-zinc-700"
            onClick={() => {
              onCloseMenus();
              onCopyText(
                branchName,
                "Copied branch name",
                `Copied ${branchName}.`,
              );
            }}
          >
            Copy branch name
          </div>
          <div
            className="cursor-pointer px-4 py-2 hover:bg-zinc-700"
            onClick={() => {
              onCloseMenus();
              onCopyBranchTipSha(branchName);
            }}
          >
            Copy commit sha
          </div>
        </div>
      ) : null}
    </div>
  );
}
