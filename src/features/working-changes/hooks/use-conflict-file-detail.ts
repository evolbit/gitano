import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getMergeConflictFile } from "@/shared/api/git/conflicts";

const CONFLICT_FILE_DETAIL_QUERY_KEY = "working-changes-conflict-file-detail";

export function conflictFileDetailQueryKey(
  repoPath: string | null | undefined,
  filePath: string | null | undefined,
  fileSignature: string | null | undefined,
) {
  return [
    CONFLICT_FILE_DETAIL_QUERY_KEY,
    repoPath ?? null,
    filePath ?? null,
    fileSignature ?? null,
  ] as const;
}

type UseConflictFileDetailOptions = {
  repoPath: string | null | undefined;
  filePath: string | null | undefined;
  fileSignature?: string | null;
  enabled?: boolean;
};

function getErrorMessage(error: unknown) {
  if (!error) return null;
  if (error instanceof Error) return error.message;
  return String(error);
}

export function useConflictFileDetail({
  repoPath,
  filePath,
  fileSignature,
  enabled = true,
}: UseConflictFileDetailOptions) {
  const queryClient = useQueryClient();
  const queryKey = conflictFileDetailQueryKey(
    repoPath,
    filePath,
    fileSignature,
  );
  const canLoad = Boolean(enabled && repoPath && filePath);
  const query = useQuery({
    queryKey,
    enabled: canLoad,
    queryFn: () => getMergeConflictFile(repoPath!, filePath!),
  });

  const invalidate = useCallback(
    () =>
      queryClient.invalidateQueries({
        queryKey,
      }),
    [queryClient, queryKey],
  );

  return {
    detail: query.data ?? null,
    error: getErrorMessage(query.error),
    isError: query.isError,
    isLoading: query.isLoading || query.isFetching,
    refresh: query.refetch,
    invalidate,
  };
}
