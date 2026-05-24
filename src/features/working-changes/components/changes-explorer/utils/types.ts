import { type StagedLinesState } from "@/features/working-changes/stores/staging-store";

export type ChangesExplorerCheckboxState =
  | "checked"
  | "indeterminate"
  | "unchecked";

export type ChangesExplorerStagedLinesState = StagedLinesState["stagedLines"];
