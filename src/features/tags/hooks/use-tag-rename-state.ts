import { useCallback, useEffect, useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { checkTagNameAvailability, renameTag } from "@/shared/api/git/tags";
import type { GitTagRef, TagNameAvailability } from "@/shared/types/git";
import { applyOptimisticTagRename } from "../components/tags-panel/tag-list-state";
import type {
  RenameDialogState,
  TagActionLoading,
} from "../components/tags-panel/types";

type UseTagRenameStateOptions = {
  repoPath: string;
  tagActionLoading: TagActionLoading | null;
  setTagActionLoading: Dispatch<SetStateAction<TagActionLoading | null>>;
  updateTagRefs: (updater: (currentTags: GitTagRef[]) => GitTagRef[]) => void;
  refreshAfterTagAction: (options?: { refreshCommits?: boolean }) => Promise<void>;
  showActionSuccess: (title: string, details: string) => void;
  showActionError: (title: string, error: unknown) => void;
};

export function useTagRenameState({
  repoPath,
  tagActionLoading,
  setTagActionLoading,
  updateTagRefs,
  refreshAfterTagAction,
  showActionSuccess,
  showActionError,
}: UseTagRenameStateOptions) {
  const [renameDialog, setRenameDialog] = useState<RenameDialogState | null>(null);
  const [debouncedRenameName, setDebouncedRenameName] = useState("");
  const [renameAvailability, setRenameAvailability] =
    useState<TagNameAvailability | null>(null);
  const [renameChecking, setRenameChecking] = useState(false);
  const renameCheckRequestRef = useRef(0);

  useEffect(() => {
    if (!renameDialog) return;

    const timeout = window.setTimeout(() => {
      setDebouncedRenameName(renameDialog.value.trim());
    }, 220);

    return () => window.clearTimeout(timeout);
  }, [renameDialog]);

  useEffect(() => {
    if (!renameDialog) return;

    const nextName = debouncedRenameName;
    if (!nextName || nextName === renameDialog.tag.name) {
      setRenameAvailability(null);
      setRenameChecking(false);
      return;
    }

    const requestId = renameCheckRequestRef.current + 1;
    renameCheckRequestRef.current = requestId;
    setRenameChecking(true);

    checkTagNameAvailability(repoPath, nextName)
      .then((availability) => {
        if (renameCheckRequestRef.current !== requestId) return;
        setRenameAvailability(availability);
      })
      .catch((availabilityError) => {
        if (renameCheckRequestRef.current !== requestId) return;
        setRenameAvailability({
          validName: true,
          localExists: false,
          originExists: null,
          originAvailable: false,
          originError: String(availabilityError),
        });
      })
      .finally(() => {
        if (renameCheckRequestRef.current === requestId) {
          setRenameChecking(false);
        }
      });
  }, [debouncedRenameName, renameDialog, repoPath]);

  const openRenameDialog = useCallback((tag: GitTagRef) => {
    setRenameAvailability(null);
    setDebouncedRenameName(tag.name);
    setRenameDialog({ tag, value: tag.name });
  }, []);

  const closeRenameDialog = useCallback(() => {
    setRenameDialog(null);
  }, []);

  const updateRenameDialogValue = useCallback((value: string) => {
    setRenameAvailability(null);
    setRenameDialog((current) => (current ? { ...current, value } : current));
  }, []);

  const handleRenameTag = useCallback(async () => {
    if (!renameDialog || tagActionLoading) return;

    const nextName = renameDialog.value.trim();
    if (!nextName || nextName === renameDialog.tag.name) return;

    setTagActionLoading({ kind: "rename", tagName: renameDialog.tag.name });
    try {
      await renameTag(repoPath, renameDialog.tag.name, nextName);
      updateTagRefs((currentTags) =>
        applyOptimisticTagRename(currentTags, renameDialog.tag, nextName),
      );
      setRenameDialog(null);
      setRenameAvailability(null);
      await refreshAfterTagAction({ refreshCommits: true });
      showActionSuccess(
        "git tag rename succeeded",
        `Renamed ${renameDialog.tag.name} to ${nextName} locally.`,
      );
    } catch (renameError) {
      showActionError("git tag rename failed", renameError);
    } finally {
      setTagActionLoading(null);
    }
  }, [
    refreshAfterTagAction,
    renameDialog,
    repoPath,
    setTagActionLoading,
    showActionError,
    showActionSuccess,
    tagActionLoading,
    updateTagRefs,
  ]);

  const resetRenameState = useCallback(() => {
    setRenameDialog(null);
    setRenameAvailability(null);
  }, []);

  return {
    closeRenameDialog,
    handleRenameTag,
    openRenameDialog,
    renameAvailability,
    renameChecking,
    renameDialog,
    resetRenameState,
    updateRenameDialogValue,
  };
}
