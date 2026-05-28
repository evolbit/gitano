import { summarizeAiErrorForDisplay } from "@/shared/utils/ai-error-summary";

type BranchAiErrorDetailsProps = {
  error: string | null;
  label: string;
  onCopy: (error: string) => void;
};

export function BranchAiErrorDetails({
  error,
  label,
  onCopy,
}: BranchAiErrorDetailsProps) {
  if (!error) return null;
  const displayError = summarizeAiErrorForDisplay(error);

  return (
    <div className="max-w-[34rem] rounded border border-red-500/40 bg-red-500/10 px-2.5 py-1.5 text-xs text-red-100">
      <div className="font-semibold">{label} failed</div>
      <div className="mt-1 whitespace-pre-wrap leading-5">{displayError}</div>
      <div className="mt-2">
        <button
          type="button"
          className="h-7 rounded border border-red-500/40 px-2 text-xs font-semibold text-red-50 transition-colors hover:bg-red-500/20"
          onClick={() => onCopy(error)}
        >
          Copy report data
        </button>
      </div>
    </div>
  );
}
