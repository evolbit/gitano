import type { ReactNode } from "react";

export function BranchName({ children }: { children: ReactNode }) {
  return <span className="font-semibold">{children}</span>;
}
