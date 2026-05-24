import { type ReactNode, useEffect, useId, useRef } from "react";
import ReactDOM from "react-dom";
import { IconX } from "../icons/icons";

export type ConfirmModalVariant = "default" | "danger";

type ConfirmModalProps = {
  open: boolean;
  title: string;
  description?: ReactNode;
  details?: ReactNode;
  confirmLabel?: string;
  loadingLabel?: string;
  cancelLabel?: string;
  variant?: ConfirmModalVariant;
  loading?: boolean;
  confirmDisabled?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmModal({
  open,
  title,
  description,
  details,
  confirmLabel = "Confirm",
  loadingLabel = "Working...",
  cancelLabel = "Cancel",
  variant = "default",
  loading = false,
  confirmDisabled = false,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();

  useEffect(() => {
    if (!open) return;

    const previousActiveElement = document.activeElement;
    cancelButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCancel();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      if (previousActiveElement instanceof HTMLElement) {
        previousActiveElement.focus();
      }
    };
  }, [onCancel, open]);

  if (!open) return null;

  const confirmButtonClass =
    variant === "danger"
      ? "border-red-500/50 bg-red-500/20 text-red-100 hover:bg-red-500/30"
      : "border-blue-500/50 bg-blue-500/20 text-blue-100 hover:bg-blue-500/30";

  return ReactDOM.createPortal(
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/65 px-4"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onCancel();
        }
      }}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="w-full max-w-sm overflow-hidden rounded-xl border border-border bg-background shadow-2xl"
        onMouseDown={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-border bg-background-emphasis px-4 py-3">
          <h2
            id={titleId}
            className="min-w-0 truncate text-sm font-semibold text-foreground">
            {title}
          </h2>
          <button
            type="button"
            className="ml-3 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-zinc-800 hover:text-zinc-100"
            aria-label="Close"
            onClick={onCancel}
            disabled={loading}>
            <IconX size={16} />
          </button>
        </div>

        <div className="px-4 py-4">
          {description ? (
            <div className="text-sm leading-5 text-zinc-200">{description}</div>
          ) : null}
          {details ? (
            <div className="mt-3 whitespace-normal break-words rounded border border-border bg-background-emphasis px-3 py-2 text-xs leading-5 text-muted-foreground">
              {details}
            </div>
          ) : null}
        </div>

        <div className="flex justify-end gap-2 border-t border-border bg-background-emphasis px-4 py-3">
          <button
            ref={cancelButtonRef}
            type="button"
            className="h-8 rounded border border-border bg-background px-3 text-xs text-zinc-300 transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
            onClick={onCancel}
            disabled={loading}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className={`inline-flex h-8 items-center justify-center gap-2 rounded border px-3 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${confirmButtonClass}`}
            onClick={onConfirm}
            disabled={loading || confirmDisabled}>
            {loading ? (
              <>
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current/30 border-t-current" />
                {loadingLabel}
              </>
            ) : (
              confirmLabel
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
