import type { ReactNode } from "react";

export type RepoInfo = {
  path: string;
  name: string;
  branch: string | null;
  hasCommits: boolean | null;
  isUnborn: boolean;
  isDetached: boolean;
  loading: boolean;
  error: string | null;
};

export type SectionProps = {
  title: string;
  children: ReactNode;
  actions?: ReactNode;
};
