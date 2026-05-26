import React, { createContext, useContext } from "react";
import type { DiffLine } from "../../types";

export type DiffLineSide = "old" | "new";

export type DiffLineAnchor = {
  filePath: string;
  hunkIdx: number;
  lineIdx: number;
  side: DiffLineSide;
  oldLine: number | null;
  newLine: number | null;
  kind: DiffLine["kind"];
};

export type DiffFileAnchor = {
  filePath: string;
};

export type DiffInteractionContextValue = {
  renderFileHeaderBelow?: (anchor: DiffFileAnchor) => React.ReactNode;
  renderLineAccessory?: (anchor: DiffLineAnchor) => React.ReactNode;
  renderLineBelow?: (anchor: DiffLineAnchor) => React.ReactNode;
  renderLineBelowFullWidth?: (anchor: DiffLineAnchor) => React.ReactNode;
};

const DiffInteractionContext = createContext<DiffInteractionContextValue>({});

export function DiffInteractionProvider({
  value,
  children,
}: {
  value: DiffInteractionContextValue;
  children: React.ReactNode;
}) {
  return (
    <DiffInteractionContext.Provider value={value}>
      {children}
    </DiffInteractionContext.Provider>
  );
}

export function useDiffInteraction() {
  return useContext(DiffInteractionContext);
}

export function createDiffLineAnchor({
  filePath,
  hunkIdx,
  lineIdx,
  line,
  side,
}: {
  filePath: string;
  hunkIdx: number;
  lineIdx: number;
  line: DiffLine;
  side?: DiffLineSide;
}): DiffLineAnchor {
  return {
    filePath,
    hunkIdx,
    lineIdx,
    side: side ?? (line.kind === "Del" ? "old" : "new"),
    oldLine: line.old_lineno,
    newLine: line.new_lineno,
    kind: line.kind,
  };
}
