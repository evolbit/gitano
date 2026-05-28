import { Split } from "@gfazioli/mantine-split-pane";
import type { ReactNode } from "react";

type ComparisonWorkspaceProps = {
  errorMessage?: string | null;
  explorer: ReactNode;
  children: ReactNode;
};

export function ComparisonWorkspace({
  children,
  errorMessage = null,
  explorer,
}: ComparisonWorkspaceProps) {
  return (
    <>
      {errorMessage ? (
        <div className="border-b border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-200">
          {errorMessage}
        </div>
      ) : null}

      <Split className="flex h-full min-h-0 w-full flex-1">
        <Split.Pane initialWidth={360} minWidth={260} maxWidth={540}>
          {explorer}
        </Split.Pane>
        <Split.Resizer className="!bg-border hover:!bg-primary [--split-resizer-size:1px]" />
        <Split.Pane grow className="min-h-0 bg-background">
          {children}
        </Split.Pane>
      </Split>
    </>
  );
}
