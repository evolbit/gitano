import { FileChange } from "@/shared/types/git";

export type DiffFileListProps = {
  files: FileChange[];
  onSelect: (file: FileChange, idx: number) => void;
  onAction?: (file: FileChange, idx: number) => void;
  selectedIndex: number;
  autoFocusSearch?: boolean;
  showSearch?: boolean;
  rowBgColor?: string;
  rowHighlightColor?: string;
  rowTextColor?: string;
  highlightSelected?: boolean;
  rowDividerColor?: string;
  rowPadding?: string;
  showFileCheckboxes?: boolean;
};
