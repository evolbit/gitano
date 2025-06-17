export type Point = {
  x: number;
  y: number;
};

export type Pixel = {
  x: number;
  y: number;
};

export type Line = {
  p1: Point;
  p2: Point;
  isCommitted: boolean;
};

export type PlacedLine = {
  p1: Pixel;
  p2: Pixel;
  isCommitted: boolean;
};

export type GraphConfig = {
  style: "angular" | "curved";
  grid: {
    x: number;
    y: number;
    offsetX: number;
    offsetY: number;
    radius: number;
  };
  colours: {
    commit: string;
    uncommitted: string;
    current: string;
  };
  uncommittedChanges: "open-circle" | "closed-circle";
};

export enum GraphStyle {
  Angular = "angular",
  Curved = "curved",
}

export enum GraphUncommittedChangesStyle {
  OpenCircleAtTheCheckedOutCommit = "open-circle",
  ClosedCircleAtTheCheckedOutCommit = "closed-circle",
}

export const NULL_VERTEX_ID = -1;
export const UNCOMMITTED = "uncommitted";
