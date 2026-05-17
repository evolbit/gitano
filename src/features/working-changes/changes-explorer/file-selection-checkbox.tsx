import { memo } from "react";
import { IconCheck } from "@/components/icons";
import { ChangesExplorerCheckboxState } from "./utils";

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
      className={`ml-3 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded border transition-colors ${
        checkboxState === "checked" || checkboxState === "indeterminate"
          ? "border-blue-500 bg-blue-600 text-white"
          : "border-zinc-600 bg-transparent text-transparent"
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
        <IconCheck size={12} className="text-white" />
      ) : checkboxState === "indeterminate" ? (
        <span className="block h-0.5 w-2 rounded bg-white" />
      ) : null}
    </button>
  );
});
