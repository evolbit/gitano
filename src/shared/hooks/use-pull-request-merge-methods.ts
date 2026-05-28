import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  getProviderRepositoryMergeOptions,
  type PullRequestMergeMethod,
} from "@/shared/api/integrations";
import { enabledMergeMethods } from "@/shared/lib/pull-requests/merge-methods";

export function usePullRequestMergeMethods({
  enabled,
  repoPath,
}: {
  enabled: boolean;
  repoPath: string | null | undefined;
}) {
  const [selectedMergeMethod, setSelectedMergeMethod] =
    useState<PullRequestMergeMethod>("merge");
  const mergeOptionsQuery = useQuery({
    queryKey: ["pull-requests", "github", repoPath, "merge-options"],
    queryFn: () =>
      getProviderRepositoryMergeOptions({
        providerId: "github",
        path: repoPath ?? "",
      }),
    enabled: enabled && Boolean(repoPath),
    staleTime: 60_000,
  });
  const mergeMethods = useMemo(
    () => enabledMergeMethods(mergeOptionsQuery.data ?? null),
    [mergeOptionsQuery.data],
  );

  useEffect(() => {
    if (
      mergeMethods.length > 0 &&
      !mergeMethods.some((option) => option.method === selectedMergeMethod)
    ) {
      setSelectedMergeMethod(mergeMethods[0].method);
    }
  }, [mergeMethods, selectedMergeMethod]);

  return {
    mergeMethods,
    mergeOptionsError:
      mergeOptionsQuery.error instanceof Error
        ? mergeOptionsQuery.error.message
        : mergeOptionsQuery.error
          ? String(mergeOptionsQuery.error)
          : null,
    mergeOptionsLoading: mergeOptionsQuery.isLoading,
    selectedMergeMethod,
    setSelectedMergeMethod,
  };
}
