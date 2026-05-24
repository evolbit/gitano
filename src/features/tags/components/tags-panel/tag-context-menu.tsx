import ReactDOM from "react-dom";
import type { ReactNode, Ref } from "react";
import {
  canDeleteLocalTag,
  canDeleteOriginTag,
  canPushTag,
  canRenameTag,
} from "../../utils/tag-refs";
import type { GitTagRef } from "@/shared/types/git";
import type { TagActionLoading, TagContextMenu } from "./types";

type TagContextMenuProps = {
  contextMenu: TagContextMenu | null;
  menuPos: { x: number; y: number } | null;
  menuRef: Ref<HTMLDivElement>;
  tagRefByName: Map<string, GitTagRef>;
  tagActionLoading: TagActionLoading | null;
  onClose: () => void;
  onCopyText: (text: string) => Promise<void>;
  onCopyRemoteLink: (tagName: string) => Promise<void>;
  onPushTag: (tag: GitTagRef) => Promise<void>;
  onOpenRenameDialog: (tag: GitTagRef) => void;
  onOpenDeleteDialog: (tag: GitTagRef) => void;
};

const actionClass = "px-4 py-2 hover:bg-zinc-700 cursor-pointer whitespace-nowrap";
const disabledActionClass =
  "px-4 py-2 text-zinc-500 cursor-not-allowed whitespace-nowrap";

function getPushUnavailableReason(tag: GitTagRef) {
  switch (tag.status) {
    case "local-origin":
      return "Already on origin";
    case "origin":
      return "No local tag to push";
    case "conflict":
      return "Cannot push conflicting tag";
    case "unknown":
      return "Origin state unavailable";
    case "local":
      return null;
  }
}

export function TagContextMenuView({
  contextMenu,
  menuPos,
  menuRef,
  tagRefByName,
  tagActionLoading,
  onClose,
  onCopyText,
  onCopyRemoteLink,
  onPushTag,
  onOpenRenameDialog,
  onOpenDeleteDialog,
}: TagContextMenuProps) {
  if (!contextMenu || !menuPos) return null;

  const tagName = contextMenu.node.full;
  const isGroup = contextMenu.node.type === "group";
  const tag = isGroup ? null : tagRefByName.get(tagName);
  const isBusy = tagActionLoading?.tagName === tagName;

  const closeAfter = (action?: () => void | Promise<void>) => {
    onClose();
    if (action) {
      void Promise.resolve(action()).catch((actionError: unknown) => {
        console.error(actionError);
      });
    }
  };

  if (isGroup) {
    return ReactDOM.createPortal(
      <MenuFrame menuRef={menuRef} menuPos={menuPos} minWidth="220px">
        <div className="text-[9px] text-zinc-500 uppercase font-semibold px-4 pt-2 pb-1 tracking-wide">
          Tag group
        </div>
        <div className={actionClass} onClick={() => closeAfter(() => onCopyText(tagName))}>
          Copy group name
        </div>
      </MenuFrame>,
      document.body,
    );
  }

  if (!tag) return null;

  const pushUnavailableReason = getPushUnavailableReason(tag);

  return ReactDOM.createPortal(
    <MenuFrame menuRef={menuRef} menuPos={menuPos} minWidth="280px">
      <div className="text-[9px] text-zinc-500 uppercase font-semibold px-4 pt-2 pb-1 tracking-wide">
        Tag actions
      </div>
      {canPushTag(tag) ? (
        <div className={actionClass} onClick={() => closeAfter(() => onPushTag(tag))}>
          {isBusy && tagActionLoading?.kind === "push" ? "Pushing tag..." : "Push tag to origin"}
        </div>
      ) : (
        <div className={disabledActionClass} title={pushUnavailableReason ?? undefined}>
          Push tag to origin
        </div>
      )}
      {canRenameTag(tag) ? (
        <div className={actionClass} onClick={() => closeAfter(() => onOpenRenameDialog(tag))}>
          Rename tag...
        </div>
      ) : null}
      {canDeleteLocalTag(tag) || canDeleteOriginTag(tag) ? (
        <div className={actionClass} onClick={() => closeAfter(() => onOpenDeleteDialog(tag))}>
          Delete tag...
        </div>
      ) : null}
      <div className="my-1 border-t border-zinc-700" />
      <div className={actionClass} onClick={() => closeAfter(() => onCopyText(tagName))}>
        Copy tag name
      </div>
      <div
        className={tag.originObjectId ? actionClass : disabledActionClass}
        title={
          tag.originObjectId
            ? undefined
            : "Remote link is only available when the tag exists on origin"
        }
        onClick={tag.originObjectId ? () => closeAfter(() => onCopyRemoteLink(tagName)) : undefined}
      >
        Copy link to this tag on remote: origin
      </div>
    </MenuFrame>,
    document.body,
  );
}

function MenuFrame({
  children,
  menuRef,
  menuPos,
  minWidth,
}: {
  children: ReactNode;
  menuRef: Ref<HTMLDivElement>;
  menuPos: { x: number; y: number };
  minWidth: string;
}) {
  return (
    <div
      ref={menuRef}
      style={{
        position: "fixed",
        top: menuPos.y,
        left: menuPos.x,
        zIndex: 99999,
        minWidth,
      }}
      className="bg-background-emphasis border border-border rounded shadow-lg py-1 text-xs text-zinc-200 select-none z-[99999]"
    >
      {children}
    </div>
  );
}
