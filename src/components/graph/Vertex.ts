import { Branch } from "./Branch";
import { GraphConfig, Point } from "./types";

const SVG_NAMESPACE = "http://www.w3.org/2000/svg";

export type VertexOrNull = Vertex | null;

export class Vertex {
  public readonly id: number;
  private readonly isStash: boolean;
  private x: number = -1;
  private nextX: number = -1;
  private onBranch: Branch | null = null;
  private parents: Vertex[] = [];
  private children: Vertex[] = [];
  private connections: { [x: number]: { vertex: Vertex; branch: Branch } } = {};
  private isCommitted: boolean = true;
  private isCurrent: boolean = false;
  public isNotOnBranch: boolean = false;

  constructor(id: number, isStash: boolean) {
    this.id = id;
    this.isStash = isStash;
  }

  public getId(): number {
    return this.id;
  }

  public getPoint(): Point {
    return { x: this.x, y: this.id };
  }

  public getNextPoint(): Point {
    return { x: this.nextX, y: this.id };
  }

  public getBranch(): Branch | null {
    return this.onBranch;
  }

  public getIsCommitted(): boolean {
    return this.isCommitted;
  }

  public addParent(parent: Vertex) {
    this.parents.push(parent);
  }

  public addChild(child: Vertex) {
    this.children.push(child);
  }

  public getNextParent(): VertexOrNull {
    return this.parents.length > 0 ? this.parents[0] : null;
  }

  public registerUnavailablePoint(x: number, vertex: Vertex, branch: Branch) {
    this.connections[x] = { vertex, branch };
  }

  public getPointConnectingTo(vertex: Vertex, branch: Branch): Point | null {
    for (let x in this.connections) {
      if (
        this.connections[x].vertex === vertex &&
        this.connections[x].branch === branch
      ) {
        return { x: parseInt(x), y: this.id };
      }
    }
    return null;
  }

  public addToBranch(branch: Branch, x: number) {
    this.onBranch = branch;
    this.x = x;
  }

  public setNotCommitted() {
    this.isCommitted = false;
  }

  public setCurrent() {
    this.isCurrent = true;
  }

  public isMerge(): boolean {
    return this.parents.length > 1;
  }

  public registerParentProcessed() {
    this.parents.shift();
  }

  public draw(
    group: SVGGElement,
    config: GraphConfig,
    isExpanded: boolean,
    overListener: (e: MouseEvent) => void,
    outListener: (e: MouseEvent) => void
  ) {
    const point = this.getPoint();
    const circle = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "circle"
    );
    circle.setAttribute(
      "cx",
      (point.x * config.grid.x + config.grid.offsetX).toString()
    );
    circle.setAttribute(
      "cy",
      (point.y * config.grid.y + config.grid.offsetY).toString()
    );
    circle.setAttribute("r", config.grid.radius.toString());
    circle.setAttribute(
      "fill",
      this.isCommitted ? config.colours.commit : config.colours.uncommitted
    );
    circle.setAttribute("stroke", this.isCurrent ? config.colours.current : "");
    circle.setAttribute("stroke-width", this.isCurrent ? "2" : "");
    circle.setAttribute("stroke-dasharray", this.isStash ? "2,2" : "");
    circle.addEventListener("mouseover", overListener);
    circle.addEventListener("mouseout", outListener);
    group.appendChild(circle);
  }

  public getParents(): Vertex[] {
    return this.parents;
  }

  public setX(x: number) {
    this.x = x;
  }
}
