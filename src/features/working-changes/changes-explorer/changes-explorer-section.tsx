import { memo, type ReactNode } from "react";
import { SectionMode, SectionName } from "./types";

type ChangesExplorerSectionProps = {
  name: SectionName;
  sectionMode: SectionMode;
  children: ReactNode;
};

export const ChangesExplorerSection = memo(function ChangesExplorerSection({
  name,
  sectionMode,
  children,
}: ChangesExplorerSectionProps) {
  return (
    <section>
      {sectionMode === "tracked-untracked" ? (
        <div className="px-2 pb-1 pt-2 text-[11px] font-medium text-zinc-500/90">
          {name}
        </div>
      ) : null}
      <div>{children}</div>
    </section>
  );
});
