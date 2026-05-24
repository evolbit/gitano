import {
  useCallback,
  useMemo,
} from "react";
import {
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  getLocalTagRefs,
  getOriginTagRefs,
} from "@/shared/api/git/tags";
import { groupNames } from "@/shared/lib/tree/branch-tree";
import type { GitTagRef } from "@/shared/types/git";
import {
  mergeTagRefs,
  splitTagRefsByLocation,
} from "../components/tags-panel/tag-list-state";
import {
  TAG_REFS_STALE_TIME_MS,
  tagRefsQueryKeys,
} from "../utils/tag-query-keys";

function getErrorMessage(error: unknown) {
  return error ? String(error) : null;
}

export function useTagRefsState(repoPath: string, search: string) {
  const queryClient = useQueryClient();
  const localTagsQuery = useQuery({
    queryKey: tagRefsQueryKeys.local(repoPath),
    queryFn: () => getLocalTagRefs(repoPath),
    staleTime: TAG_REFS_STALE_TIME_MS,
  });
  const originTagsQuery = useQuery({
    queryKey: tagRefsQueryKeys.origin(repoPath),
    queryFn: () => getOriginTagRefs(repoPath),
    staleTime: TAG_REFS_STALE_TIME_MS,
  });

  const localTags = localTagsQuery.data ?? [];
  const originTags = originTagsQuery.data ?? [];
  const originAvailable = originTagsQuery.data !== undefined;
  const tagRefs = useMemo(
    () => mergeTagRefs(localTags, originTags, originAvailable),
    [localTags, originAvailable, originTags],
  );
  const hasLoadedOnce = localTagsQuery.data !== undefined;
  const originError =
    originTagsQuery.error && !originAvailable
      ? getErrorMessage(originTagsQuery.error)
      : null;
  const error = getErrorMessage(localTagsQuery.error);

  const refreshTags = useCallback(async () => {
    await queryClient.refetchQueries({
      queryKey: tagRefsQueryKeys.all(repoPath),
      type: "active",
    });
  }, [queryClient, repoPath]);

  const updateTagRefs = useCallback(
    (updater: (currentTags: GitTagRef[]) => GitTagRef[]) => {
      const currentLocalTags =
        queryClient.getQueryData<GitTagRef[]>(tagRefsQueryKeys.local(repoPath)) ??
        [];
      const currentOriginTags =
        queryClient.getQueryData<GitTagRef[]>(tagRefsQueryKeys.origin(repoPath)) ??
        [];
      const currentOriginAvailable =
        queryClient.getQueryData(tagRefsQueryKeys.origin(repoPath)) !== undefined;
      const currentTags = mergeTagRefs(
        currentLocalTags,
        currentOriginTags,
        currentOriginAvailable,
      );
      const nextTags = updater(currentTags);
      const { localTags: nextLocalTags, originTags: nextOriginTags } =
        splitTagRefsByLocation(nextTags);

      queryClient.setQueryData(tagRefsQueryKeys.local(repoPath), nextLocalTags);
      queryClient.setQueryData(tagRefsQueryKeys.origin(repoPath), nextOriginTags);
    },
    [queryClient, repoPath],
  );

  const tagRefByName = useMemo(
    () => new Map(tagRefs.map((tag) => [tag.name, tag])),
    [tagRefs],
  );
  const filteredTagRefs = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    if (!normalizedSearch) return tagRefs;
    return tagRefs.filter((tag) => tag.name.toLowerCase().includes(normalizedSearch));
  }, [search, tagRefs]);
  const groupedTags = useMemo(
    () => groupNames(filteredTagRefs.map((tag) => tag.name)),
    [filteredTagRefs],
  );
  const loading = localTagsQuery.isFetching || originTagsQuery.isFetching;

  return {
    error,
    groupedTags,
    hasLoadedOnce,
    loading,
    originError,
    refreshTags,
    showInitialLoading: localTagsQuery.isLoading && !hasLoadedOnce,
    tagRefByName,
    updateTagRefs,
  };
}
