import { PullStrategy } from "../../store/workspaceUi";

export type ToolbarDropdownProps = {
  searchValue: string;
  onSearchChange: (value: string) => void;
  children: React.ReactNode;
};

export type RemoteNotice = {
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

export type TopToolbarProps = {
  selectorRegionWidth?: number;
};

export type PullStrategyOption = {
  value: PullStrategy;
  label: string;
};
