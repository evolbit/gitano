export const TAG_REFS_STALE_TIME_MS = 60_000;

export const tagRefsQueryKeys = {
  all: (repoPath: string) => ["tag-refs", repoPath] as const,
  local: (repoPath: string) => [...tagRefsQueryKeys.all(repoPath), "local"] as const,
  origin: (repoPath: string) => [...tagRefsQueryKeys.all(repoPath), "origin"] as const,
};
