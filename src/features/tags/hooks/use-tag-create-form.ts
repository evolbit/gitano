import { useCallback, useEffect, useRef, useState } from "react";
import { createTag, searchTagCommits } from "@/shared/api/git/tags";
import { APP_EVENTS } from "@/shared/config/events";
import type { TagCommitOption } from "@/shared/types/git";

type UseTagCreateFormOptions = {
  repoPath: string;
  requiresInitialCommit: boolean;
  refreshTags: () => Promise<void>;
};

export function useTagCreateForm({
  repoPath,
  requiresInitialCommit,
  refreshTags,
}: UseTagCreateFormOptions) {
  const [addPanelOpen, setAddPanelOpen] = useState(false);
  const [tagName, setTagName] = useState("");
  const [tagDescription, setTagDescription] = useState("");
  const [tagAnnotated, setTagAnnotated] = useState(false);
  const [commitSearch, setCommitSearch] = useState("");
  const [debouncedCommitSearch, setDebouncedCommitSearch] = useState("");
  const [commitOptions, setCommitOptions] = useState<TagCommitOption[]>([]);
  const [selectedCommit, setSelectedCommit] = useState<TagCommitOption | null>(null);
  const [commitDropdownOpen, setCommitDropdownOpen] = useState(false);
  const [commitLoading, setCommitLoading] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const commitSearchRequestRef = useRef(0);

  useEffect(() => {
    if (!addPanelOpen) return;

    const timeout = window.setTimeout(() => {
      setDebouncedCommitSearch(commitSearch);
    }, 180);

    return () => window.clearTimeout(timeout);
  }, [addPanelOpen, commitSearch]);

  useEffect(() => {
    if (!addPanelOpen) return;

    const requestId = commitSearchRequestRef.current + 1;
    commitSearchRequestRef.current = requestId;
    setCommitLoading(true);

    searchTagCommits(repoPath, debouncedCommitSearch)
      .then((commits) => {
        if (commitSearchRequestRef.current !== requestId) return;
        setCommitOptions(commits);
        setSelectedCommit((current) => current ?? commits[0] ?? null);
      })
      .catch((commitError) => {
        if (commitSearchRequestRef.current !== requestId) return;
        setCreateError(String(commitError));
        setCommitOptions([]);
      })
      .finally(() => {
        if (commitSearchRequestRef.current === requestId) {
          setCommitLoading(false);
        }
      });
  }, [addPanelOpen, debouncedCommitSearch, repoPath]);

  const resetCreateForm = useCallback(() => {
    setAddPanelOpen(false);
    setTagName("");
    setTagDescription("");
    setTagAnnotated(false);
    setCommitSearch("");
    setDebouncedCommitSearch("");
    setSelectedCommit(null);
    setCommitDropdownOpen(false);
    setCommitOptions([]);
    setCreateError(null);
  }, []);

  useEffect(() => {
    resetCreateForm();
  }, [repoPath, resetCreateForm]);

  useEffect(() => {
    if (requiresInitialCommit) {
      setAddPanelOpen(false);
    }
  }, [requiresInitialCommit]);

  const openAddPanel = useCallback(() => {
    if (requiresInitialCommit) {
      setCreateError("Create the initial commit before adding tags.");
      return;
    }

    setAddPanelOpen(true);
    setCommitDropdownOpen(false);
    setCreateError(null);
  }, [requiresInitialCommit]);

  const handleCreateTag = useCallback(async () => {
    if (!tagName.trim() || !selectedCommit || createLoading) return;

    setCreateLoading(true);
    setCreateError(null);

    try {
      await createTag(
        repoPath,
        tagName.trim(),
        selectedCommit.sha,
        tagAnnotated,
        tagAnnotated ? tagDescription.trim() : null,
      );

      resetCreateForm();
      window.dispatchEvent(new CustomEvent(APP_EVENTS.repoRefsRefresh));
      window.dispatchEvent(new CustomEvent(APP_EVENTS.commitsRefresh));
      await refreshTags();
    } catch (tagError) {
      setCreateError(String(tagError));
    } finally {
      setCreateLoading(false);
    }
  }, [
    createLoading,
    refreshTags,
    repoPath,
    resetCreateForm,
    selectedCommit,
    tagAnnotated,
    tagDescription,
    tagName,
  ]);

  return {
    addPanelOpen,
    closeAddPanel: resetCreateForm,
    commitDropdownOpen,
    commitLoading,
    commitOptions,
    commitSearch,
    createError,
    createLoading,
    handleCreateTag,
    openAddPanel,
    selectedCommit,
    setCommitDropdownOpen,
    setCommitSearch,
    setSelectedCommit,
    setTagAnnotated,
    setTagDescription,
    setTagName,
    tagAnnotated,
    tagDescription,
    tagName,
  };
}
