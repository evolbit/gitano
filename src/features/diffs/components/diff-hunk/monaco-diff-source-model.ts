import type { DiffLine, SplitRow } from "../../types";

export type MonacoDiffSourceSide = "unified" | "old" | "new";

export type MonacoDiffSourceLine = {
  content: string;
  lineIdx: number | null;
  kind: DiffLine["kind"] | "Empty";
  oldLine: number | null;
  newLine: number | null;
  side: MonacoDiffSourceSide;
};

export type MonacoDiffSourceModel = {
  value: string;
  lines: MonacoDiffSourceLine[];
};

export function buildUnifiedMonacoDiffSource(
  lines: DiffLine[],
): MonacoDiffSourceModel {
  const sourceLines = lines.map((line, lineIdx): MonacoDiffSourceLine => ({
    content: line.content,
    lineIdx,
    kind: line.kind,
    oldLine: line.old_lineno,
    newLine: line.new_lineno,
    side: "unified",
  }));

  return buildModel(sourceLines);
}

export function buildSplitMonacoDiffSource(
  rows: SplitRow[],
  side: Extract<MonacoDiffSourceSide, "old" | "new">,
): MonacoDiffSourceModel {
  const sourceLines = rows.map((row): MonacoDiffSourceLine => {
    const cell = side === "old" ? row.left : row.right;

    if (!cell) {
      return {
        content: "",
        lineIdx: null,
        kind: "Empty",
        oldLine: null,
        newLine: null,
        side,
      };
    }

    return {
      content: cell.line.content,
      lineIdx: cell.lineIdx,
      kind: cell.line.kind,
      oldLine: cell.line.old_lineno,
      newLine: cell.line.new_lineno,
      side,
    };
  });

  return buildModel(sourceLines);
}

function buildModel(lines: MonacoDiffSourceLine[]): MonacoDiffSourceModel {
  return {
    value: lines.map((line) => line.content).join("\n"),
    lines,
  };
}
