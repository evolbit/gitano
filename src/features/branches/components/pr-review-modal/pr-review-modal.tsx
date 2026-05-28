import { PrReview, type PrReviewProps } from "../pr-review/pr-review";
import { ComparisonModalShell } from "../branch-compare-modal/comparison-modal-shell";

export type PrReviewModalProps = PrReviewProps;

export function PrReviewModal(props: PrReviewModalProps) {
  return (
    <ComparisonModalShell onClose={props.onClose}>
      <PrReview {...props} />
    </ComparisonModalShell>
  );
}
