import { Box, Group, Text } from "@mantine/core";
import { IconGitBranch, IconGitCommit, IconTag } from "@tabler/icons-react";
import { core } from "@tauri-apps/api";
import { useEffect, useRef, useState } from "react";

interface GitCommit {
  hash: string;
  message: string;
  author: string;
  tags: string[];
  heads: string[];
}

interface GitTag {
  name: string;
  commitHash: string;
}

interface GitRemote {
  name: string;
  branches: string[];
}

interface GitStash {
  hash: string;
  message: string;
}

interface GitCommitData {
  commits: GitCommit[];
  tags: GitTag[];
  remotes: GitRemote[];
  stashes: GitStash[];
  moreCommitsAvailable: boolean;
}

interface CommitListProps {
  repoPath: string;
}

export function CommitList({ repoPath }: CommitListProps) {
  const [commitData, setCommitData] = useState<GitCommitData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const observerTarget = useRef<HTMLDivElement>(null);
  const COMMITS_PER_PAGE = 50;

  const loadCommits = async (pageNum: number) => {
    if (loading) return;
    setLoading(true);
    setError(null);

    try {
      const data = await core.invoke<GitCommitData>("get_formatted_commits", {
        path: repoPath,
        branches: null,
        authors: null,
        maxCommits: COMMITS_PER_PAGE,
        showTags: true,
        showRemoteBranches: true,
        includeCommitsMentionedByReflogs: false,
        onlyFollowFirstParent: false,
        commitOrdering: "Date",
        remotes: ["origin"],
        hideRemotes: [],
        stashes: [],
      });

      console.log("Git commits data:", data);

      if (pageNum === 1) {
        setCommitData(data);
      } else {
        setCommitData((prev) => {
          if (!prev) return data;
          return {
            ...data,
            commits: [...prev.commits, ...data.commits],
          };
        });
      }

      setHasMore(data.moreCommitsAvailable);
    } catch (e: any) {
      setError(e.toString());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (repoPath) {
      setPage(1);
      loadCommits(1);
    }
  }, [repoPath]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading) {
          setPage((prev) => prev + 1);
          loadCommits(page + 1);
        }
      },
      { threshold: 0.1 }
    );

    if (observerTarget.current) {
      observer.observe(observerTarget.current);
    }

    return () => observer.disconnect();
  }, [hasMore, loading, page]);

  if (error) {
    return (
      <Box className="p-4">
        <Text color="red">Error: {error}</Text>
      </Box>
    );
  }

  return (
    <Box className="p-4">
      {commitData?.commits.map((commit) => (
        <Box
          key={commit.hash}
          className="mb-4 p-4 bg-zinc-800 rounded-lg hover:bg-zinc-700 transition-colors">
          <Group
            justify="space-between"
            mb={8}>
            <Group gap={8}>
              <IconGitCommit className="w-5 h-5 text-blue-500" />
              <Text className="font-mono text-sm">{commit.hash}</Text>
            </Group>
            <Group gap={8}>
              {commit.tags.map((tag) => (
                <Group
                  key={tag}
                  gap={4}>
                  <IconTag className="w-4 h-4 text-blue-400" />
                  <Text
                    size="sm"
                    className="text-blue-400">
                    {tag}
                  </Text>
                </Group>
              ))}
              {commit.heads.map((head) => (
                <Group
                  key={head}
                  gap={4}>
                  <IconGitBranch className="w-4 h-4 text-green-400" />
                  <Text
                    size="sm"
                    className="text-green-400">
                    {head}
                  </Text>
                </Group>
              ))}
            </Group>
          </Group>
          <Text className="font-medium mb-2">{commit.message}</Text>
          <Text
            size="sm"
            className="text-zinc-400">
            Author: {commit.author}
          </Text>
        </Box>
      ))}
      <div
        ref={observerTarget}
        className="h-4"
      />
      {loading && (
        <Box className="text-center py-4">
          <Text>Loading more commits...</Text>
        </Box>
      )}
    </Box>
  );
}
