import { useCallback, useEffect, useState } from "react";
import { deleteTag, pushTag } from "@/shared/api/git/tags";
import { APP_EVENTS } from "@/shared/config/events";
import {
  canDeleteLocalTag,
  canDeleteOriginTag,
  canPushTag,
} from "../utils/tag-refs";
import type { GitTagRef } from "@/shared/types/git";
import { useGitActionsStore } from "@/features/repository-workspace";
import { applyOptimisticTagDelete } from "../components/tags-panel/tag-list-state";
import type {
  DeleteDialogState,
  TagActionLoading,
} from "../components/tags-panel/types";

type UseTagActionsStateOptions = {
  repoPath: string;
  refreshTags: () => Promise<void>;
  updateTagRefs: (updater: (currentTags: GitTagRef[]) => GitTagRef[]) => void;
};

export function useTagActionsState({
  repoPath,
  refreshTags,
  updateTagRefs,
}: UseTagActionsStateOptions) {
  const setGitActionNotice = useGitActionsStore((s) => s.setNotice);
  const [tagActionLoading, setTagActionLoading] =
    useState<TagActionLoading | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<DeleteDialogState | null>(null);

  useEffect(() => {
    setActionError(null);
    setDeleteDialog(null);
  }, [repoPath]);

  const clearActionError = useCallback(() => {
    setActionError(null);
  }, []);

  const showActionSuccess = useCallback(
    (title: string, details: string) => {
      setActionError(null);
      setGitActionNotice({
        kind: "success",
        title,
        details,
        expanded: false,
      });
    },
    [setGitActionNotice],
  );

  const showActionError = useCallback(
    (title: string, actionErrorValue: unknown) => {
      const details = String(actionErrorValue);
      setActionError(details);
      setGitActionNotice({
        kind: "error",
        title,
        details,
        expanded: false,
      });
    },
    [setGitActionNotice],
  );

  const refreshAfterTagAction = useCallback(
    async (options: { refreshCommits?: boolean } = {}) => {
      window.dispatchEvent(new CustomEvent(APP_EVENTS.repoRefsRefresh));
      if (options.refreshCommits) {
        window.dispatchEvent(new CustomEvent(APP_EVENTS.commitsRefresh));
      }
      await refreshTags();
    },
    [refreshTags],
  );

  const handlePushTag = useCallback(
    async (tag: GitTagRef) => {
      if (!canPushTag(tag) || tagActionLoading) return;

      setTagActionLoading({ kind: "push", tagName: tag.name });
      try {
        await pushTag(repoPath, tag.name);
        await refreshAfterTagAction();
        showActionSuccess("git push tag succeeded", `Pushed ${tag.name} to origin.`);
      } catch (pushError) {
        showActionError("git push tag failed", pushError);
      } finally {
        setTagActionLoading(null);
      }
    },
    [
      refreshAfterTagAction,
      repoPath,
      showActionError,
      showActionSuccess,
      tagActionLoading,
    ],
  );

  const openDeleteDialog = useCallback((tag: GitTagRef) => {
    setActionError(null);
    setDeleteDialog({ tag, deleteOrigin: false });
  }, []);

  const closeDeleteDialog = useCallback(() => {
    setDeleteDialog(null);
  }, []);

  const updateDeleteOrigin = useCallback((deleteOrigin: boolean) => {
    setDeleteDialog((current) => (current ? { ...current, deleteOrigin } : current));
  }, []);

  const handleDeleteTag = useCallback(async () => {
    if (!deleteDialog || tagActionLoading) return;

    const { tag } = deleteDialog;
    const deleteLocal = canDeleteLocalTag(tag);
    const deleteOrigin = deleteLocal ? deleteDialog.deleteOrigin : canDeleteOriginTag(tag);

    if (!deleteLocal && !deleteOrigin) return;

    setTagActionLoading({ kind: "delete", tagName: tag.name });
    try {
      await deleteTag(repoPath, tag.name, { deleteLocal, deleteOrigin });
      setDeleteDialog(null);
      updateTagRefs((currentTags) =>
        applyOptimisticTagDelete(currentTags, tag, deleteLocal, deleteOrigin),
      );
      void refreshAfterTagAction({ refreshCommits: deleteLocal });
      showActionSuccess(
        "git tag delete succeeded",
        deleteOrigin
          ? `Deleted ${tag.name} from ${deleteLocal ? "local tags and origin" : "origin"}.`
          : `Deleted ${tag.name} locally.`,
      );
    } catch (deleteError) {
      showActionError("git tag delete failed", deleteError);
    } finally {
      setTagActionLoading(null);
    }
  }, [
    deleteDialog,
    refreshAfterTagAction,
    repoPath,
    showActionError,
    showActionSuccess,
    tagActionLoading,
    updateTagRefs,
  ]);

  return {
    actionError,
    clearActionError,
    closeDeleteDialog,
    deleteDialog,
    handleDeleteTag,
    handlePushTag,
    openDeleteDialog,
    refreshAfterTagAction,
    setTagActionLoading,
    showActionError,
    showActionSuccess,
    tagActionLoading,
    updateDeleteOrigin,
  };
}
