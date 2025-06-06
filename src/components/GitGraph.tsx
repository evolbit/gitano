import { Gitgraph, templateExtend, TemplateName } from "@gitgraph/react";
import { useEffect, useState } from "react";

interface CommitNode {
  id: string;
  parents: string[];
  message: string;
  author: string;
  branches: string[];
  is_head: boolean;
  tags: string[];
  date?: string;
}

declare global {
  interface Window {
    core: any;
  }
}

export function GitGraph({ repoPath }: { repoPath: string }) {
  const [commits, setCommits] = useState<CommitNode[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedCommit, setSelectedCommit] = useState<CommitNode | null>(null);
  const [hoveredCommit, setHoveredCommit] = useState<CommitNode | null>(null);

  useEffect(() => {
    if (!repoPath) return;
    setLoading(true);
    setError(null);
    (window.core?.invoke || Promise.reject)("get_commit_graph", {
      path: repoPath,
    })
      .then((data: CommitNode[]) => {
        setCommits(data);
      })
      .catch((e: any) => setError(e.toString()))
      .finally(() => setLoading(false));
  }, [repoPath]);

  if (!repoPath) return null;

  // Adaptar los datos a GitgraphJS
  const commitMap = new Map(commits.map((c) => [c.id, c]));
  const branchHeads: Record<string, string> = {};
  commits.forEach((c) => {
    if (c.is_head && c.branches && c.branches.length > 0) {
      c.branches.forEach((b) => {
        branchHeads[b] = c.id;
      });
    }
  });

  // Template oscuro mejorado
  const darkTemplate = templateExtend(TemplateName.Metro, {
    colors: [
      "#1976d2",
      "#43a047",
      "#fbc02d",
      "#e64a19",
      "#8e24aa",
      "#00838f",
      "#c62828",
      "#6d4c41",
    ],
    commit: {
      message: {
        color: "#fff",
        display: false, // ocultar mensaje por defecto, lo mostramos en tooltip
      },
      dot: {
        size: 7,
        strokeColor: "#fff",
        strokeWidth: 2,
      },
    },
    branch: {
      label: {
        color: "#fff",
      },
    },
  });

  // Tooltip para commit
  const Tooltip = ({ commit }: { commit: CommitNode }) => (
    <div
      style={{
        position: "absolute",
        left: 20,
        top: 20,
        background: "#222",
        color: "#fff",
        borderRadius: 8,
        padding: 12,
        boxShadow: "0 2px 8px #0008",
        zIndex: 1000,
        minWidth: 220,
        fontSize: 14,
      }}>
      <div style={{ fontWeight: 600, marginBottom: 4 }}>{commit.message}</div>
      <div>
        Autor: <b>{commit.author}</b>
      </div>
      {commit.date && (
        <div>
          Fecha: <b>{new Date(commit.date).toLocaleString()}</b>
        </div>
      )}
      {commit.branches.length > 0 && (
        <div>
          Ramas: <b>{commit.branches.join(", ")}</b>
        </div>
      )}
      {commit.tags.length > 0 && (
        <div>
          Tags: <b>{commit.tags.join(", ")}</b>
        </div>
      )}
      <div style={{ fontSize: 12, color: "#aaa", marginTop: 4 }}>
        SHA: {commit.id}
      </div>
    </div>
  );

  // Panel de detalles al hacer clic
  const DetailsPanel = ({ commit }: { commit: CommitNode }) => (
    <div
      style={{
        position: "absolute",
        right: 20,
        top: 20,
        background: "#222",
        color: "#fff",
        borderRadius: 8,
        padding: 16,
        boxShadow: "0 2px 8px #0008",
        zIndex: 1000,
        minWidth: 260,
        fontSize: 15,
      }}>
      <div style={{ fontWeight: 700, fontSize: 17, marginBottom: 8 }}>
        {commit.message}
      </div>
      <div>
        Autor: <b>{commit.author}</b>
      </div>
      {commit.date && (
        <div>
          Fecha: <b>{new Date(commit.date).toLocaleString()}</b>
        </div>
      )}
      {commit.branches.length > 0 && (
        <div>
          Ramas: <b>{commit.branches.join(", ")}</b>
        </div>
      )}
      {commit.tags.length > 0 && (
        <div>
          Tags: <b>{commit.tags.join(", ")}</b>
        </div>
      )}
      <div style={{ fontSize: 13, color: "#aaa", marginTop: 6 }}>
        SHA: {commit.id}
      </div>
      <button
        style={{
          marginTop: 12,
          background: "#1976d2",
          color: "#fff",
          border: 0,
          borderRadius: 4,
          padding: "6px 14px",
          cursor: "pointer",
        }}
        onClick={() => setSelectedCommit(null)}>
        Cerrar
      </button>
    </div>
  );

  return (
    <div
      style={{
        width: "100%",
        height: "80vh",
        background: "#18181b",
        overflow: "auto",
        position: "relative",
      }}>
      {loading && (
        <div className="text-xs text-zinc-400 p-4">Cargando grafo...</div>
      )}
      {error && <div className="text-xs text-red-400 p-4">{error}</div>}
      {!loading &&
        !error &&
        (commits.length > 0 ? (
          <Gitgraph
            options={{
              template: darkTemplate,
              orientation: "vertical" as any,
            }}>
            {(gitgraph) => {
              const createdCommits: Record<string, any> = {};
              const branches: Record<string, any> = {};
              // Crear ramas para cada branch head
              const branchNames = Object.keys(branchHeads);
              if (branchNames.length === 0) {
                // Si no hay ramas, crear master por defecto
                branches["master"] = gitgraph.branch({ name: "master" });
              } else {
                branchNames.forEach((branchName) => {
                  branches[branchName] = gitgraph.branch({ name: branchName });
                });
              }
              // Crear commits (en orden inverso para que los padres existan antes)
              commits
                .slice()
                .reverse()
                .forEach((c) => {
                  let branch = null;
                  if (c.branches && c.branches.length > 0) {
                    branch = branches[c.branches[0]];
                  } else {
                    branch = branches[branchNames[0]] || branches["master"];
                  }
                  if (!branch) return; // Evitar errores si no hay rama
                  if (createdCommits[c.id]) return;
                  // HEAD resaltado
                  const isHead = c.is_head;
                  const dotColor = isHead ? "#fbc02d" : undefined;
                  const commitInstance = branch.commit({
                    subject: c.message,
                    author: c.author,
                    hash: c.id.substring(0, 7),
                    style: {
                      dot: { color: dotColor },
                    },
                    onMouseOver: () => setHoveredCommit(c),
                    onMouseOut: () => setHoveredCommit(null),
                    onClick: () => setSelectedCommit(c),
                  });
                  createdCommits[c.id] = commitInstance;
                });
              return null;
            }}
          </Gitgraph>
        ) : (
          <Gitgraph
            options={{
              template: darkTemplate,
              orientation: "vertical" as any,
            }}>
            {(gitgraph) => {
              const master = gitgraph.branch("master");
              master.commit({ subject: "Initial commit", author: "Demo" });
              master.commit({ subject: "Second commit", author: "Demo" });
              const develop = gitgraph.branch("develop");
              develop.commit({ subject: "Feature commit", author: "Dev" });
              master.merge(develop, "Merge feature");
              return null;
            }}
          </Gitgraph>
        ))}
      {/* Tooltip al pasar el mouse */}
      {hoveredCommit && <Tooltip commit={hoveredCommit} />}
      {/* Panel de detalles al hacer clic */}
      {selectedCommit && <DetailsPanel commit={selectedCommit} />}
    </div>
  );
}
