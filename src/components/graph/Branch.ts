import { GraphConfig, Line, Point } from "./types";

const SVG_NAMESPACE = "http://www.w3.org/2000/svg";

export class Branch {
  private color: string;
  private end: number = 0;
  private lines: Line[] = [];
  private numUncommitted: number = 0;

  constructor(color: string) {
    this.color = color;
  }

  public addLine(p1: Point, p2: Point, isCommitted: boolean = true) {
    this.lines.push({ p1, p2, isCommitted });
  }

  public getColour(): string {
    return this.color;
  }

  public setEnd(end: number) {
    this.end = end;
  }

  public draw(group: SVGGElement, config: GraphConfig) {
    this.lines.forEach((line) => {
      const path = document.createElementNS(SVG_NAMESPACE, "path");
      const d = this.getPathD(line, config);
      path.setAttribute("d", d);
      path.setAttribute("stroke", this.color);
      path.setAttribute("stroke-width", "2");
      path.setAttribute("fill", "none");
      path.setAttribute("stroke-dasharray", line.isCommitted ? "none" : "5,5");
      group.appendChild(path);
    });
  }

  private getPathD(line: Line, config: GraphConfig): string {
    const x1 = line.p1.x * config.grid.x + config.grid.offsetX;
    const y1 = line.p1.y * config.grid.y + config.grid.offsetY;
    const x2 = line.p2.x * config.grid.x + config.grid.offsetX;
    const y2 = line.p2.y * config.grid.y + config.grid.offsetY;

    if (config.style === "angular") {
      return `M ${x1} ${y1} L ${x2} ${y1} L ${x2} ${y2}`;
    } else {
      const midX = (x1 + x2) / 2;
      return `M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`;
    }
  }
}
