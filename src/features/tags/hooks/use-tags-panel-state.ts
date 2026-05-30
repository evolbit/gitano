import {
  useCallback,
  useEffect,
  useState,
} from "react";
import { getRemoteUrl } from "@/shared/api/git/commits";
import { APP_EVENTS } from "@/shared/config/events";
import {
  writeClipboardText,
  writeClipboardTextFromPromise,
} from "@/shared/platform/clipboard";
import type { GitTagRef } from "@/shared/types/git";
import {
  DEFAULT_REF_PRESENCE_FILTER,
  DEFAULT_REPO_WORKSPACE_STATE,
  useWorkspaceUiStore,
} from "@/features/repository-workspace";
import type { RefPresenceFilter } from "@/features/repository-workspace";
import { buildRemoteTagUrl } from "../utils/remote-tag-url";
import { useTagActionsState } from "./use-tag-actions-state";
import { useTagContextMenuState } from "./use-tag-context-menu-state";
import { useTagCreateForm } from "./use-tag-create-form";
import { useTagRefsState } from "./use-tag-refs-state";
import { useTagRepositoryState } from "./use-tag-repository-state";
import { useTagRenameState } from "./use-tag-rename-state";

export function useTagsPanelState(repoPath: string) {
  const tagTreeExpanded = useWorkspaceUiStore(
    (s) =>
      (s.repoStateByPath[repoPath] ?? DEFAULT_REPO_WORKSPACE_STATE)
        .tagTreeExpanded ?? DEFAULT_REPO_WORKSPACE_STATE.tagTreeExpanded,
  );
  const setTagTreeExpanded = useWorkspaceUiStore((s) => s.setTagTreeExpanded);
  const tagPresenceFilter = useWorkspaceUiStore(
    (s) =>
      (s.repoStateByPath[repoPath] ?? DEFAULT_REPO_WORKSPACE_STATE)
        .tagPresenceFilter ?? DEFAULT_REF_PRESENCE_FILTER,
  );
  const setTagPresenceFilterStore = useWorkspaceUiStore(
    (s) => s.setTagPresenceFilter,
  );
  const [search, setSearch] = useState("");
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const {
    error,
    groupedTags,
    hasLoadedOnce,
    loading,
    originError,
    refreshTags,
    showInitialLoading,
    tagRefByName,
    updateTagRefs,
  } = useTagRefsState(repoPath, search, tagPresenceFilter);
  const {
    closeContextMenu,
    contextMenu,
    isRowActionsVisible,
    menuPos,
    menuRef,
    openContextMenu,
    setHoveredRowKey,
  } = useTagContextMenuState();
  const { requiresInitialCommit } = useTagRepositoryState(repoPath);
  const createForm = useTagCreateForm({
    repoPath,
    requiresInitialCommit,
    refreshTags,
  });
  const {
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
  } = useTagActionsState({
    repoPath,
    refreshTags,
    updateTagRefs,
  });

  useEffect(() => {
    const handleRepoRefsRefresh = () => {
      void refreshTags();
    };

    window.addEventListener(APP_EVENTS.repoRefsRefresh, handleRepoRefsRefresh);
    return () => {
      window.removeEventListener(APP_EVENTS.repoRefsRefresh, handleRepoRefsRefresh);
    };
  }, [refreshTags]);

  const toggleGroup = useCallback(
    (nodeFull: string, isOpen: boolean) => {
      setTagTreeExpanded(repoPath, {
        ...tagTreeExpanded,
        [nodeFull]: !isOpen,
      });
    },
    [repoPath, setTagTreeExpanded, tagTreeExpanded],
  );

  const toggleTagPresenceFilter = useCallback(
    (key: keyof RefPresenceFilter) => {
      const nextFilter = {
        ...tagPresenceFilter,
        [key]: !tagPresenceFilter[key],
      };

      if (!nextFilter.local && !nextFilter.remote) return;
      setTagPresenceFilterStore(repoPath, nextFilter);
    },
    [repoPath, setTagPresenceFilterStore, tagPresenceFilter],
  );

  const copyText = useCallback(async (text: string) => {
    await writeClipboardText(text);
  }, []);

  const copyRemoteLink = useCallback(
    async (targetTagName: string) => {
      await writeClipboardTextFromPromise(
        getRemoteUrl(repoPath, "origin").then((remoteUrl) => {
          if (!remoteUrl) {
            throw new Error("Remote origin is not configured");
          }

          return buildRemoteTagUrl(remoteUrl, targetTagName);
        }),
      );
    },
    [repoPath],
  );

  const {
    closeRenameDialog,
    handleRenameTag,
    openRenameDialog: openRenameDialogBase,
    renameAvailability,
    renameChecking,
    renameDialog,
    resetRenameState,
    updateRenameDialogValue,
  } = useTagRenameState({
    repoPath,
    tagActionLoading,
    setTagActionLoading,
    updateTagRefs,
    refreshAfterTagAction,
    showActionSuccess,
    showActionError,
  });

  useEffect(() => {
    resetRenameState();
  }, [repoPath, resetRenameState]);

  const openRenameDialog = useCallback(
    (tag: GitTagRef) => {
      clearActionError();
      openRenameDialogBase(tag);
    },
    [clearActionError, openRenameDialogBase],
  );

  return {
    actionError,
    addPanelOpen: createForm.addPanelOpen,
    closeAddPanel: createForm.closeAddPanel,
    closeContextMenu,
    closeDeleteDialog,
    closeRenameDialog,
    commitDropdownOpen: createForm.commitDropdownOpen,
    commitLoading: createForm.commitLoading,
    commitOptions: createForm.commitOptions,
    commitSearch: createForm.commitSearch,
    contextMenu,
    copyRemoteLink,
    copyText,
    createError: createForm.createError,
    createLoading: createForm.createLoading,
    deleteDialog,
    error,
    groupedTags,
    handleCreateTag: createForm.handleCreateTag,
    handleDeleteTag,
    handlePushTag,
    handleRenameTag,
    hasLoadedOnce,
    isRowActionsVisible,
    loading,
    menuPos,
    menuRef,
    openAddPanel: createForm.openAddPanel,
    openContextMenu,
    openDeleteDialog,
    openRenameDialog,
    originError,
    renameAvailability,
    renameChecking,
    renameDialog,
    requiresInitialCommit,
    search,
    selectedCommit: createForm.selectedCommit,
    selectedTag,
    setCommitDropdownOpen: createForm.setCommitDropdownOpen,
    setCommitSearch: createForm.setCommitSearch,
    setHoveredRowKey,
    setSearch,
    setSelectedCommit: createForm.setSelectedCommit,
    setSelectedTag,
    setTagAnnotated: createForm.setTagAnnotated,
    setTagDescription: createForm.setTagDescription,
    setTagName: createForm.setTagName,
    showInitialLoading,
    tagActionLoading,
    tagAnnotated: createForm.tagAnnotated,
    tagDescription: createForm.tagDescription,
    tagName: createForm.tagName,
    tagPresenceFilter,
    tagRefByName,
    tagTreeExpanded,
    toggleGroup,
    toggleTagPresenceFilter,
    updateDeleteOrigin,
    updateRenameDialogValue,
  };
}
