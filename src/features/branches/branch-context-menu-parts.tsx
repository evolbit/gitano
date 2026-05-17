import type { ReactNode } from "react";

type BranchContextMenuItemProps = {
  children: ReactNode;
  className: string;
  title?: string;
  onClick: () => void;
};

export function BranchContextMenuItem({
  children,
  className,
  title,
  onClick,
}: BranchContextMenuItemProps) {
  return (
    <div className={className} title={title} onClick={onClick}>
      {children}
    </div>
  );
}

export function BranchContextMenuSectionTitle({ children }: { children: ReactNode }) {
  return (
    <div className="px-4 pt-2 pb-1 text-[9px] font-semibold tracking-wide text-zinc-500 uppercase">
      {children}
    </div>
  );
}

export function BranchContextMenuSeparator() {
  return <div className="my-1 border-t border-zinc-700" />;
}
