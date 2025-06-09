import {
  IconChevronDown,
  IconChevronRight,
  IconCloud,
  IconDeviceFloppy,
  IconGitBranch,
  IconGitMerge,
} from "@tabler/icons-react";
import { core } from "@tauri-apps/api";
import { useEffect, useState } from "react";

// Helper para agrupar ramas por prefijo
function groupBranches(branches: string[]): any[] {
  const tree: any = {};
  branches.forEach((branch) => {
    const parts = branch.split("/");
    let current = tree;
    parts.forEach((part, idx) => {
      if (!current[part]) {
        current[part] = idx === parts.length - 1 ? null : {};
      }
      if (idx < parts.length - 1) current = current[part];
    });
  });
  function toArray(obj: any, prefix = ""): any[] {
    return Object.entries(obj).map(([key, value]) => {
      const full = prefix ? `${prefix}/${key}` : key;
      if (value === null) {
        return { type: "branch", name: key, full };
      } else {
        return {
          type: "group",
          name: key,
          full,
          children: toArray(value, full),
        };
      }
    });
  }
  return toArray(tree);
}

function BranchIcon({ name }: { name: string }) {
  const lower = name.toLowerCase();
  return (
    <span className="inline-flex items-center justify-center w-5 h-5">
      {["master", "main", "dev", "develop"].includes(lower) ? (
        <IconGitMerge
          size={18}
          className="text-green-400"
        />
      ) : (
        <IconGitBranch
          size={18}
          className="text-blue-400"
        />
      )}
    </span>
  );
}

export function BranchList({ repoPath }: { repoPath: string }) {
  const [branches, setBranches] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [type, setType] = useState<"local" | "remote">("local");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!repoPath) return;
    setLoading(true);
    setError(null);
    const command = type === "local" ? "get_branches" : "get_remote_branches";
    core
      .invoke<string[]>(command, { path: repoPath })
      .then(setBranches)
      .catch((e) => setError(e.toString()))
      .finally(() => setLoading(false));
  }, [repoPath, type]);

  const grouped = groupBranches(branches);

  function renderTree(nodes: any[], level = 0) {
    return (
      <ul className={`pl-${level * 2} select-none`}>
        {nodes.map((node) => {
          if (node.type === "group") {
            const isOpen = expanded[node.full] ?? true;
            return (
              <li
                key={node.full}
                className="mb-0.5">
                <div
                  className="flex items-center gap-1 cursor-pointer hover:bg-zinc-700 rounded px-1 py-0.5 text-xs text-zinc-300"
                  style={{ fontSize: "13px", fontWeight: 500 }}
                  onClick={() =>
                    setExpanded((exp) => ({ ...exp, [node.full]: !isOpen }))
                  }>
                  <span className="inline-flex items-center justify-center w-5 h-5">
                    {isOpen ? (
                      <IconChevronDown
                        size={18}
                        className="align-middle"
                      />
                    ) : (
                      <IconChevronRight
                        size={18}
                        className="align-middle"
                      />
                    )}
                  </span>
                  <span>{node.name}</span>
                </div>
                {isOpen && (
                  <div className="pl-3">
                    {renderTree(node.children, level + 1)}
                  </div>
                )}
              </li>
            );
          } else {
            return (
              <li
                key={node.full}
                className="flex items-center gap-1 px-1 py-0.5 rounded hover:bg-zinc-700 cursor-pointer text-xs text-zinc-200"
                style={{ fontSize: "13px" }}
                tabIndex={0}
                onClick={() => {
                  /* Aquí puedes manejar la selección de rama */
                }}>
                <BranchIcon name={node.name} />
                <span className="truncate">{node.name}</span>
              </li>
            );
          }
        })}
      </ul>
    );
  }

  if (!repoPath) return null;

  return (
    <div className="p-4 h-full flex flex-col">
      <div className="font-bold mb-2 flex items-center gap-2 text-sm">
        <span className="inline-flex items-center justify-center w-5 h-5">
          <IconGitBranch
            className="w-5 h-5 align-middle"
            size={18}
          />
        </span>
        Ramas
        <div className="ml-auto flex gap-1">
          <button
            className={`px-2 py-1 rounded flex items-center gap-1 text-xs ${
              type === "local"
                ? "bg-blue-600 text-white"
                : "bg-zinc-800 text-zinc-400"
            }`}
            onClick={() => setType("local")}
            title="Locales"
            type="button">
            <span className="inline-flex items-center justify-center w-5 h-5">
              <IconDeviceFloppy
                size={18}
                className="align-middle"
              />
            </span>
            Locales
          </button>
          <button
            className={`px-2 py-1 rounded flex items-center gap-1 text-xs ${
              type === "remote"
                ? "bg-blue-600 text-white"
                : "bg-zinc-800 text-zinc-400"
            }`}
            onClick={() => setType("remote")}
            title="Remotas"
            type="button">
            <span className="inline-flex items-center justify-center w-5 h-5">
              <IconCloud
                size={18}
                className="align-middle"
              />
            </span>
            Remotas
          </button>
        </div>
      </div>
      {loading && <div className="text-xs text-zinc-400">Cargando...</div>}
      {error && <div className="text-xs text-red-400">{error}</div>}
      <div className="flex-1 min-h-0">
        <div
          className="overflow-y-auto max-h-[55vh] pr-1"
          style={{ height: "100%" }}>
          {renderTree(grouped)}
        </div>
      </div>
    </div>
  );
}
