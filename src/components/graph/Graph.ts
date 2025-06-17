import { Branch } from "./Branch";
import { GraphConfig, UNCOMMITTED } from "./types";
import { Vertex } from "./Vertex";

const SVG_NAMESPACE = "http://www.w3.org/2000/svg";

export type Commit = {
  hash: string;
  parents: string[];
  branch: string;
  stash?: any;
};

export class Graph {
  private config: GraphConfig;
  private vertices: { [id: number]: Vertex } = {};
  private branches: { [name: string]: Branch } = {};
  private currentCommit: string | null = null;
  private expandedCommit: string | null = null;
  private onlyFollowFirstParent: boolean = false;
  private commits: Commit[] = [];
  private commitLookup: { [hash: string]: number } = {};
  private container: HTMLElement;
  private svg: SVGElement;
  private group: SVGGElement | null = null;
  private branchXMap: { [branch: string]: number } = {};
  private branchCount = 0;

  constructor(id: string, container: HTMLElement, config: GraphConfig) {
    this.config = config;
    this.container = container;

    // Create SVG element
    this.svg = document.createElementNS(SVG_NAMESPACE, "svg");
    this.svg.setAttribute("width", "100%");
    this.svg.setAttribute("height", "100%");
    this.svg.style.overflow = "visible";

    // Create mask for gradient effect
    const defs = this.svg.appendChild(
      document.createElementNS(SVG_NAMESPACE, "defs")
    );

    const linearGradient = defs.appendChild(
      document.createElementNS(SVG_NAMESPACE, "linearGradient")
    );
    linearGradient.setAttribute("id", "GraphGradient");

    const stop1 = linearGradient.appendChild(
      document.createElementNS(SVG_NAMESPACE, "stop")
    );
    stop1.setAttribute("stop-color", "white");

    const stop2 = linearGradient.appendChild(
      document.createElementNS(SVG_NAMESPACE, "stop")
    );
    stop2.setAttribute("stop-color", "black");

    const mask = defs.appendChild(
      document.createElementNS(SVG_NAMESPACE, "mask")
    );
    mask.setAttribute("id", "GraphMask");

    const maskRect = mask.appendChild(
      document.createElementNS(SVG_NAMESPACE, "rect")
    );
    maskRect.setAttribute("fill", "white");
    maskRect.setAttribute("width", "100%");
    maskRect.setAttribute("height", "100%");

    container.appendChild(this.svg);
  }

  public updateConfig(config: Partial<GraphConfig>) {
    this.config = { ...this.config, ...config };
  }

  public loadCommits(
    commits: Commit[],
    commitHead: string | null,
    commitLookup: { [hash: string]: number },
    onlyFollowFirstParent: boolean
  ) {
    this.commits = commits;
    this.currentCommit = commitHead;
    this.commitLookup = commitLookup;
    this.onlyFollowFirstParent = onlyFollowFirstParent;
    this.vertices = {};
    this.branches = {};

    if (commits.length === 0) return;

    // Create vertices for each commit
    commits.forEach((commit, index) => {
      this.vertices[index] = new Vertex(index, commit.stash !== undefined);
    });

    // Connect vertices (padres e hijos)
    commits.forEach((commit, index) => {
      const vertex = this.vertices[index];
      if (!vertex) return;
      const parentHashes = this.onlyFollowFirstParent
        ? [commit.parents[0]]
        : commit.parents;
      parentHashes.forEach((parentHash) => {
        const parentIndex = this.commitLookup[parentHash];
        if (parentIndex !== undefined) {
          const parentVertex = this.vertices[parentIndex];
          if (parentVertex) {
            vertex.addParent(parentVertex);
            parentVertex.addChild(vertex);
          }
        }
      });
    });

    // Asignar lanes dinámicamente (como vscode-git-graph)
    this.assignLanes(commits, this.commitLookup, this.vertices);

    // Handle uncommitted changes
    if (commits[0].hash === UNCOMMITTED) {
      this.vertices[0].setNotCommitted();
      if (this.config.uncommittedChanges === "open-circle") {
        this.vertices[0].setCurrent();
      }
    } else if (
      commitHead !== null &&
      typeof commitLookup[commitHead] === "number"
    ) {
      this.vertices[commitLookup[commitHead]].setCurrent();
    }

    // Determine paths for all vertices
    Object.keys(this.vertices).forEach((index) => {
      const vertex = this.vertices[parseInt(index)];
      if (vertex.getNextParent() !== null || vertex.isNotOnBranch) {
        this.determinePath(parseInt(index));
      }
    });
  }

  private determinePath(vertexIndex: number) {
    const vertex = this.vertices[vertexIndex];
    if (!vertex) return;

    const branch = vertex.getBranch();
    if (!branch) return;

    // Conectar a todos los padres
    vertex.getParents().forEach((parent) => {
      branch.addLine(
        vertex.getPoint(),
        parent.getPoint(),
        vertex.getIsCommitted()
      );
    });
  }

  private getBranchColor(branchName: string): string {
    // TODO: Implement branch color assignment
    return "#000000";
  }

  private getBranchX(branchName: string): number {
    if (!(branchName in this.branchXMap)) {
      this.branchXMap[branchName] = this.branchCount++;
    }
    return this.branchXMap[branchName];
  }

  public addBranch(name: string, color: string): Branch {
    const branch = new Branch(color);
    this.branches[name] = branch;
    return branch;
  }

  public setExpandedCommit(hash: string | null) {
    this.expandedCommit = hash;
  }

  public setOnlyFollowFirstParent(value: boolean) {
    this.onlyFollowFirstParent = value;
  }

  public render(container: HTMLElement) {
    // Clear previous content
    if (this.group) {
      this.svg.removeChild(this.group);
    }

    // Create new group
    this.group = document.createElementNS(SVG_NAMESPACE, "g");
    this.group.setAttribute("mask", "url(#GraphMask)");

    // Draw branches
    Object.values(this.branches).forEach((branch) => {
      branch.draw(this.group!, this.config);
    });

    // Draw vertices
    Object.values(this.vertices).forEach((vertex) => {
      const isExpanded = this.expandedCommit === vertex.getId().toString();
      vertex.draw(
        this.group!,
        this.config,
        isExpanded,
        (e: MouseEvent) => this.showTooltip(e, vertex),
        () => this.hideTooltip()
      );
    });

    // Add group to SVG
    this.svg.appendChild(this.group);
  }

  private showTooltip(event: MouseEvent, vertex: Vertex) {
    // TODO: Implement tooltip
  }

  private hideTooltip() {
    // TODO: Implement tooltip hiding
  }

  // Algoritmo de lanes dinámicas
  private assignLanes(
    commits: Commit[],
    commitLookup: { [hash: string]: number },
    vertices: { [id: number]: Vertex }
  ) {
    const activeLanes: (number | null)[] = [];
    const commitLane: number[] = new Array(commits.length).fill(-1);
    // Crear una Branch para cada lane
    const laneBranches: Branch[] = [];

    for (let i = 0; i < commits.length; i++) {
      // Buscar si alguno de los padres ya está en una lane activa
      let lane = -1;
      for (let l = 0; l < activeLanes.length; l++) {
        if (activeLanes[l] !== null) {
          const parentIdx = activeLanes[l]!;
          if (commits[i].parents.includes(commits[parentIdx].hash)) {
            lane = l;
            break;
          }
        }
      }
      // Si no está, busca el primer slot libre
      if (lane === -1) {
        lane = activeLanes.indexOf(null);
        if (lane === -1) {
          lane = activeLanes.length;
          activeLanes.push(null);
          // Crear nueva Branch para la nueva lane
          laneBranches.push(new Branch(this.getBranchColor(`lane${lane}`)));
        }
      }
      // Si la branch para esta lane no existe aún, créala
      if (!laneBranches[lane]) {
        laneBranches[lane] = new Branch(this.getBranchColor(`lane${lane}`));
      }
      // Asigna la lane al commit
      commitLane[i] = lane;
      activeLanes[lane] = i;
      vertices[i].setX(lane);
      // Asocia el vértice a la branch de la lane
      vertices[i].addToBranch(laneBranches[lane], lane);
      // Guarda la branch en this.branches para que se dibuje
      this.branches[`lane${lane}`] = laneBranches[lane];

      // Si el commit ya no tiene hijos, libera la lane
      const isLast = !commits
        .slice(i + 1)
        .some((c) => c.parents.includes(commits[i].hash));
      if (isLast) {
        activeLanes[lane] = null;
      }
    }
  }
}
