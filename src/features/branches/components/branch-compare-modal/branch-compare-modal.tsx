import {
  BranchCompare,
  type BranchCompareProps,
} from "../branch-compare/branch-compare";
import { ComparisonModalShell } from "./comparison-modal-shell";

export type BranchCompareModalProps = BranchCompareProps;

export function BranchCompareModal(props: BranchCompareModalProps) {
  return (
    <ComparisonModalShell onClose={props.onClose}>
      <BranchCompare {...props} />
    </ComparisonModalShell>
  );
}
