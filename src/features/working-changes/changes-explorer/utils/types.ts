import { type StagedLinesState } from "@/features/working-changes/stores/stagingStore";

export type ChangesExplorerCheckboxState =
  | "checked"
  | "indeterminate"
  | "unchecked";

export type ChangesExplorerStagedLinesState = StagedLinesState["stagedLines"];
