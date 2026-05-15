import { PullStrategy } from "../../store/workspaceUi";

export type ToolbarDropdownProps = {
  searchValue: string;
  onSearchChange: (value: string) => void;
  placeholder?: string;
  children: React.ReactNode;
};

export type GitActionNotice = {
  kind: "success" | "error";
  title: string;
  details: string;
  expanded: boolean;
};

export type RemoteActionButtonProps = {
  label: string;
  icon: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  loading?: boolean;
  tooltip?: string;
  rightSlot?: React.ReactNode;
};

export type TopToolbarProps = Record<string, never>;

export type PullStrategyOption = {
  value: PullStrategy;
  label: string;
};
