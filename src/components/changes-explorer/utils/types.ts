import { type StagedLinesState } from "../../../store/staging";

export type ChangesExplorerCheckboxState =
  | "checked"
  | "indeterminate"
  | "unchecked";

export type ChangesExplorerStagedLinesState = StagedLinesState["stagedLines"];
