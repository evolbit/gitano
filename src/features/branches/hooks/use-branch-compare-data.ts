import { useEffect, useMemo, useRef, useState } from "react";
import {
  type BranchComparisonMode,
  getBranchComparisonFileDiff,
  getBranchComparisonFiles,
} from "@/shared/api/git/diffs";
import type { LocalAiBranchReviewFinding } from "@/shared/api/local-ai";
import type { DiffHunk, FileChange } from "@/shared/types/git";
import { getBranches } from "../api";

export function useBranchLists(repoPath: string) {
  const [localBranches, setLocalBranches] = useState<string[]>([]);
  const [remoteBranches, setRemoteBranches] = useState<string[]>([]);
  const [branchLoading, setBranchLoading] = useState(false);
  const [branchError, setBranchError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setBranchLoading(true);
    setBranchError(null);

    Promise.all([getBranches(repoPath, "local"), getBranches(repoPath, "remote")])
      .then(([local, remote]) => {
        if (cancelled) return;
        setLocalBranches(local);
        setRemoteBranches(remote);
      })
      .catch((error) => {
        if (cancelled) return;
        setBranchError(String(error));
      })
      .finally(() => {
        if (!cancelled) setBranchLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [repoPath]);

  return {
    localBranches,
    remoteBranches,
    branchLoading,
    branchError,
  };
}

export function useBranchComparisonData({
  repoPath,
  sourceBranch,
  targetBranch,
  comparisonReady,
  comparisonMode,
  contextLines,
}: {
  repoPath: string;
  sourceBranch: string | null;
  targetBranch: string | null;
  comparisonReady: boolean;
  comparisonMode: BranchComparisonMode;
  contextLines: number;
}) {
  const [files, setFiles] = useState<FileChange[]>([]);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [filesLoading, setFilesLoading] = useState(false);
  const [filesError, setFilesError] = useState<string | null>(null);
  const [hunks, setHunks] = useState<DiffHunk[]>([]);
  const [hunksLoading, setHunksLoading] = useState(false);
  const [hunksError, setHunksError] = useState<string | null>(null);
  const filesRequestId = useRef(0);
  const hunksRequestId = useRef(0);

  useEffect(() => {
    if (!comparisonReady || !sourceBranch || !targetBranch) {
      filesRequestId.current += 1;
      hunksRequestId.current += 1;
      setFiles([]);
      setSelectedPath(null);
      setHunks([]);
      setHunksLoading(false);
      setHunksError(null);
      setFilesLoading(false);
      setFilesError(null);
      return;
    }

    const requestId = filesRequestId.current + 1;
    filesRequestId.current = requestId;
    hunksRequestId.current += 1;
    setFilesLoading(true);
    setFilesError(null);
    setFiles([]);
    setSelectedPath(null);
    setHunks([]);

    getBranchComparisonFiles({
      path: repoPath,
      baseRef: targetBranch,
      headRef: sourceBranch,
      comparisonMode,
    })
      .then((nextFiles) => {
        if (requestId !== filesRequestId.current) return;
        setFiles(nextFiles);
        setSelectedPath(nextFiles[0]?.path ?? null);
      })
      .catch((error) => {
        if (requestId === filesRequestId.current) setFilesError(String(error));
      })
      .finally(() => {
        if (requestId === filesRequestId.current) setFilesLoading(false);
      });
  }, [comparisonMode, comparisonReady, repoPath, sourceBranch, targetBranch]);

  useEffect(() => {
    if (!comparisonReady || !sourceBranch || !targetBranch || !selectedPath) {
      hunksRequestId.current += 1;
      setHunks([]);
      setHunksLoading(false);
      setHunksError(null);
      return;
    }

    const requestId = hunksRequestId.current + 1;
    hunksRequestId.current = requestId;
    setHunksLoading(true);
    setHunksError(null);
    setHunks([]);

    getBranchComparisonFileDiff({
      path: repoPath,
      baseRef: targetBranch,
      headRef: sourceBranch,
      filePath: selectedPath,
      context: contextLines,
      comparisonMode,
    })
      .then((nextHunks) => {
        if (requestId === hunksRequestId.current) setHunks(nextHunks);
      })
      .catch((error) => {
        if (requestId === hunksRequestId.current) setHunksError(String(error));
      })
      .finally(() => {
        if (requestId === hunksRequestId.current) setHunksLoading(false);
      });
  }, [
    comparisonMode,
    comparisonReady,
    contextLines,
    repoPath,
    selectedPath,
    sourceBranch,
    targetBranch,
  ]);

  const selectedFile = useMemo(
    () => files.find((file) => file.path === selectedPath) ?? null,
    [files, selectedPath],
  );

  return {
    files,
    selectedPath,
    setSelectedPath,
    selectedFile,
    filesLoading,
    filesError,
    hunks,
    hunksLoading,
    hunksError,
  };
}

export function useBranchReviewHunks({
  repoPath,
  sourceBranch,
  targetBranch,
  comparisonReady,
  findings,
  comparisonMode,
  contextLines,
}: {
  repoPath: string;
  sourceBranch: string | null;
  targetBranch: string | null;
  comparisonReady: boolean;
  findings: LocalAiBranchReviewFinding[];
  comparisonMode: BranchComparisonMode;
  contextLines: number;
}) {
  const [reviewHunksByPath, setReviewHunksByPath] = useState<
    Record<string, DiffHunk[]>
  >({});
  const [reviewHunksLoading, setReviewHunksLoading] = useState(false);

  useEffect(() => {
    if (!comparisonReady || !sourceBranch || !targetBranch || !findings.length) {
      setReviewHunksByPath({});
      setReviewHunksLoading(false);
      return;
    }

    const filePaths = [...new Set(findings.map((finding) => finding.filePath))];
    let cancelled = false;
    setReviewHunksLoading(true);

    Promise.all(
      filePaths.map(async (filePath) => {
        const fileHunks = await getBranchComparisonFileDiff({
          path: repoPath,
          baseRef: targetBranch,
          headRef: sourceBranch,
          filePath,
          context: contextLines,
          comparisonMode,
        });
        return [filePath, fileHunks] as const;
      }),
    )
      .then((entries) => {
        if (!cancelled) {
          setReviewHunksByPath(Object.fromEntries(entries));
        }
      })
      .catch(() => {
        if (!cancelled) setReviewHunksByPath({});
      })
      .finally(() => {
        if (!cancelled) setReviewHunksLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [
    comparisonMode,
    comparisonReady,
    contextLines,
    findings,
    repoPath,
    sourceBranch,
    targetBranch,
  ]);

  return {
    reviewHunksByPath,
    setReviewHunksByPath,
    reviewHunksLoading,
  };
}
