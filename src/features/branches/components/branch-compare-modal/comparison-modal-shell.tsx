import ReactDOM from "react-dom";
import { useEffect, type ReactNode } from "react";

type ComparisonModalShellProps = {
  children: ReactNode;
  onClose: () => void;
};

export function ComparisonModalShell({
  children,
  onClose,
}: ComparisonModalShellProps) {
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [onClose]);

  return ReactDOM.createPortal(
    <div className="fixed inset-0 z-[10000]">
      <div className="absolute inset-0 bg-black/60" />
      <div className="relative mx-auto my-6 flex h-[96vh] w-[96vw] min-h-0 flex-col overflow-hidden rounded-xl border border-border bg-background shadow-2xl">
        {children}
      </div>
    </div>,
    document.body,
  );
}
