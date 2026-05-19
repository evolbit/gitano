import type { MouseEvent, ReactNode } from "react";

export type TabType = {
  id: string;
  label?: string;
  icon?: ReactNode;
};

export type RepoTabType = TabType & { repoPath?: string };

export type TabBarProps = {
  tabs: RepoTabType[];
  activeTab: string;
  onTabClose: (id: string, event: MouseEvent) => void;
  onAddTab: () => void;
  onOpenSettings: () => void;
};
