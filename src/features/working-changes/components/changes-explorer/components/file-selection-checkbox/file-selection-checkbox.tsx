import { memo } from "react";
import { IconCheck } from "@/shared/components/icons/icons";
import { ChangesExplorerCheckboxState } from "../../utils";

type FileSelectionCheckboxProps = {
  checkboxState: ChangesExplorerCheckboxState;
  onToggle: () => void;
};

export const FileSelectionCheckbox = memo(function FileSelectionCheckbox({
  checkboxState,
  onToggle,
}: FileSelectionCheckboxProps) {
  return (
    <button
      type="button"
      className={`ml-2 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-sm border bg-background-emphasis transition-colors ${
        checkboxState === "checked" || checkboxState === "indeterminate"
          ? "border-zinc-600 text-blue-400"
          : "border-zinc-700 text-transparent hover:border-zinc-500"
      }`}
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      aria-checked={
        checkboxState === "indeterminate"
          ? "mixed"
          : checkboxState === "checked"
      }
      aria-label="Toggle file selection"
    >
      {checkboxState === "checked" ? (
        <IconCheck size={11} className="text-blue-400" />
      ) : checkboxState === "indeterminate" ? (
        <span className="block h-0.5 w-1.5 rounded bg-blue-400" />
      ) : null}
    </button>
  );
});
