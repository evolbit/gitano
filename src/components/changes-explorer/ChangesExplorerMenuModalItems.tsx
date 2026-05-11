import { memo } from "react";
import { ChangesExplorerMenuButton } from "./ChangesExplorerMenuButton";

const modalMenuItems = [
  "Stage All",
  "Unstage All",
  "__separator__",
  "Stash All",
  "Stash Pop",
  "View Stash",
  "__separator__",
  "Open Diff",
  "__separator__",
  "Discard Tracked Changes",
  "Trash Untracked Files",
  "__separator__",
] as const;

export const ChangesExplorerModalMenuItems = memo(function ChangesExplorerModalMenuItems() {
  return (
    <>
      {modalMenuItems.map((item, index) =>
        item === "__separator__" ? (
          <div
            key={`separator-${index}`}
            className="my-1 border-t border-zinc-700"
          />
        ) : (
          <ChangesExplorerMenuButton key={`${item}-${index}`} disabled>
            {item}
          </ChangesExplorerMenuButton>
        ),
      )}
    </>
  );
});
