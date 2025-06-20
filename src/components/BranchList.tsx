import {
  IconChevronDown,
  IconChevronRight,
  IconCloud,
  IconDeviceFloppy,
  IconDotsVertical,
  IconFolder,
  IconGitBranch,
  IconGitMerge,
} from "@tabler/icons-react";
import { core } from "@tauri-apps/api";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import ReactDOM from "react-dom";
import { useRepoStore } from "../store/repo";

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

function BranchIcon({ name, selected }: { name: string; selected: boolean }) {
  const lower = name.toLowerCase();
  return (
    <span className="inline-flex items-center justify-center w-5 h-5">
      {["master", "main", "dev", "develop"].includes(lower) ? (
        <IconGitMerge
          size={18}
          className={selected ? "text-zinc-800" : "text-lime-400"}
        />
      ) : (
        <IconGitBranch
          size={18}
          className={selected ? "text-zinc-800" : "text-blue-400"}
        />
      )}
    </span>
  );
}

export function BranchList() {
  const repoPath = useRepoStore((s) => s.currentRepo);
  const setSelectedBranch = useRepoStore((s) => s.setSelectedBranch);
  const [branches, setBranches] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [type, setType] = useState<"local" | "remote">("local");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [selectedBranchFull, setSelectedBranchFull] = useState<string | null>(
    null
  );
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    node: any | null;
  } | null>(null);
  const [menuPos, setMenuPos] = useState<{ x: number; y: number } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [showOther, setShowOther] = useState(false);
  const [submenuLeft, setSubmenuLeft] = useState(true);
  const [submenuDirection, setSubmenuDirection] = useState<"down" | "up">(
    "down"
  );
  const otherRef = useRef<HTMLDivElement>(null);
  const submenuTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Limpiar timeout al desmontar (debe estar en el cuerpo principal, no en renderContextMenu)
  useEffect(() => {
    return () => {
      if (submenuTimeout.current) clearTimeout(submenuTimeout.current);
    };
  }, []);

  // Cerrar menú contextual al hacer click fuera
  useEffect(() => {
    if (!contextMenu) return;
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setContextMenu(null);
      }
    }
    window.addEventListener("mousedown", handleClick);
    return () => window.removeEventListener("mousedown", handleClick);
  }, [contextMenu]);

  useEffect(() => {
    if (!repoPath) return;
    setLoading(true);
    setError(null);
    const command = type === "local" ? "get_branches" : "get_remote_branches";
    core
      .invoke<string[]>(command, { path: repoPath })
      .then((allBranches) => {
        if (type === "local") {
          // Solo oculta ramas que empiezan con <remoto>/ (ej: origin/feature/foo), pero NO las locales con /
          setBranches(
            allBranches.filter(
              (b) =>
                !/^\w+\//.test(b) ||
                b.startsWith("feature/") ||
                b.startsWith("hotfix/") ||
                b.startsWith("release/") ||
                b.startsWith("bugfix/") ||
                b.startsWith("chore/") ||
                b.startsWith("test/") ||
                b.startsWith("fix/") ||
                b.startsWith("refactor/") ||
                b.startsWith("task/")
            )
          );
        } else {
          // Solo incluye ramas que empiezan con <remoto>/
          setBranches(allBranches.filter((b) => /^\w+\//.test(b)));
        }
      })
      .catch((e) => setError(e.toString()))
      .finally(() => setLoading(false));
  }, [repoPath, type]);

  const grouped = groupBranches(branches);

  // Ajustar posición del menú contextual si se sale por abajo
  useLayoutEffect(() => {
    if (!contextMenu || !menuRef.current || !menuPos) return;
    const rect = menuRef.current.getBoundingClientRect();
    const winH = window.innerHeight;
    let newY = menuPos.y;
    if (menuPos.y + rect.height > winH - 8) {
      newY = Math.max(8, menuPos.y - rect.height);
    }
    if (newY !== menuPos.y) setMenuPos({ x: menuPos.x, y: newY });
  }, [contextMenu, menuPos]);

  // Detectar si el submenú se sale del viewport derecho o inferior
  useLayoutEffect(() => {
    if (!showOther || !otherRef.current) return;
    const rect = otherRef.current.getBoundingClientRect();
    const submenuWidth = 200; // ancho estimado del submenú
    const submenuHeight = 220; // alto estimado del submenú (ajusta si tienes más/menos opciones)
    // Izquierda/derecha
    if (rect.right + submenuWidth > window.innerWidth - 8) {
      setSubmenuLeft(false); // abrir hacia la izquierda
    } else {
      setSubmenuLeft(true); // abrir hacia la derecha
    }
    // Arriba/abajo
    if (rect.bottom + submenuHeight > window.innerHeight - 8) {
      setSubmenuDirection("up");
    } else {
      setSubmenuDirection("down");
    }
  }, [showOther]);

  function renderTree(nodes: any[], level = 0) {
    return (
      <ul className={`select-none`}>
        {nodes.map((node) => {
          if (node.type === "group") {
            const isOpen = expanded[node.full] ?? true;
            return (
              <li
                key={node.full}
                className="mb-0.5 group">
                <div
                  className="flex items-center gap-1 cursor-pointer hover:bg-zinc-700 rounded px-1 py-0.5 text-xs text-zinc-300"
                  style={{ fontSize: "13px", fontWeight: 500 }}
                  onClick={() =>
                    setExpanded((exp) => ({ ...exp, [node.full]: !isOpen }))
                  }
                  onContextMenu={(e) => {
                    e.preventDefault();
                    setContextMenu({ x: e.clientX, y: e.clientY, node });
                    setMenuPos({ x: e.clientX, y: e.clientY });
                  }}>
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
                  <span className="inline-flex items-center justify-center w-5 h-5">
                    <IconFolder
                      size={18}
                      className="text-blue-300"
                    />
                  </span>
                  <span>{node.name}</span>
                  <button
                    className="ml-auto p-1 rounded hover:bg-zinc-600 transition-colors invisible group-hover:visible"
                    title="Más acciones"
                    type="button"
                    tabIndex={-1}
                    onClick={(e) => {
                      e.stopPropagation();
                      const rect = (
                        e.currentTarget as HTMLElement
                      ).getBoundingClientRect();
                      setContextMenu({ x: rect.right, y: rect.bottom, node });
                      setMenuPos({ x: rect.right, y: rect.bottom });
                    }}>
                    <IconDotsVertical size={16} />
                  </button>
                </div>
                {isOpen && (
                  <div className="pl-5 border-l border-zinc-700 ml-2">
                    {renderTree(node.children, level + 1)}
                  </div>
                )}
              </li>
            );
          } else {
            const selected = selectedBranchFull === node.full;
            return (
              <li
                key={node.full}
                className={`flex items-center gap-1 px-1 py-0.5 rounded cursor-pointer text-xs group ${
                  selected
                    ? "bg-blue-400 text-zinc-900 font-bold"
                    : "hover:bg-zinc-700 text-zinc-200"
                }`}
                style={{ fontSize: "13px" }}
                tabIndex={0}
                onClick={() => setSelectedBranch(node.full)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setContextMenu({ x: e.clientX, y: e.clientY, node });
                  setMenuPos({ x: e.clientX, y: e.clientY });
                }}>
                <span className="inline-flex items-center justify-center w-5 h-5">
                  <BranchIcon
                    selected={selected}
                    name={node.name}
                  />
                </span>
                <span className="truncate">{node.name}</span>
                <button
                  className="ml-auto p-1 rounded hover:bg-zinc-600 transition-colors invisible group-hover:visible"
                  title="Más acciones"
                  type="button"
                  tabIndex={-1}
                  onClick={(e) => {
                    e.stopPropagation();
                    const rect = (
                      e.currentTarget as HTMLElement
                    ).getBoundingClientRect();
                    setContextMenu({ x: rect.right, y: rect.bottom, node });
                    setMenuPos({ x: rect.right, y: rect.bottom });
                  }}>
                  <IconDotsVertical size={16} />
                </button>
              </li>
            );
          }
        })}
      </ul>
    );
  }

  // Renderiza el menú contextual
  function renderContextMenu() {
    if (!contextMenu || !menuPos) return null;
    const { node } = contextMenu;
    const branchName = node.full || node.name;

    // Helper para cerrar ambos menús
    function closeMenus() {
      setContextMenu(null);
      setShowOther(false);
    }

    // Handler para mouseleave con retardo (grace period)
    function handleMenuMouseLeave(e: React.MouseEvent) {
      const relatedTarget = e.relatedTarget as HTMLElement;
      if (relatedTarget?.closest(".submenu")) return;
      submenuTimeout.current = setTimeout(() => {
        closeMenus();
      }, 500);
    }
    function handleSubmenuMouseEnter() {
      if (submenuTimeout.current) {
        clearTimeout(submenuTimeout.current);
        submenuTimeout.current = null;
      }
      setShowOther(true);
    }
    function handleSubmenuMouseLeave() {
      submenuTimeout.current = setTimeout(() => {
        setShowOther(false);
      }, 500);
    }

    return ReactDOM.createPortal(
      <div
        ref={menuRef}
        style={{
          position: "fixed",
          top: menuPos.y,
          left: menuPos.x,
          zIndex: 99999,
        }}
        className="flex"
        onMouseLeave={handleMenuMouseLeave}>
        {/* Menú principal */}
        <div className="bg-zinc-900/95 border border-zinc-600 rounded shadow-lg py-1 text-xs text-zinc-200 select-none backdrop-blur z-[99999] min-w-[320px]">
          {/* Remote actions, Branch operations, Worktree, Branching, Danger zone */}
          <div className="text-[9px] text-zinc-500 uppercase font-semibold px-4 pt-2 pb-1 tracking-wide">
            Remote actions
          </div>
          <div
            className="px-4 py-2 hover:bg-zinc-700 cursor-pointer"
            onClick={() => {
              closeMenus();
            }}>
            Pull (fast-forward if possible)
          </div>
          <div
            className="px-4 py-2 hover:bg-zinc-700 cursor-pointer"
            onClick={() => {
              closeMenus();
            }}>
            Push
          </div>
          <div
            className="px-4 py-2 hover:bg-zinc-700 cursor-pointer"
            onClick={() => {
              closeMenus();
            }}>
            Set Upstream
          </div>
          <div className="my-1 border-t border-zinc-700" />
          <div className="text-[9px] text-zinc-500 uppercase font-semibold px-4 pt-2 pb-1 tracking-wide">
            Branch operations
          </div>
          <div
            className="px-4 py-2 hover:bg-zinc-700 cursor-pointer"
            onClick={() => {
              closeMenus();
            }}>
            Fast-forward {branchName} to ...
          </div>
          <div
            className="px-4 py-2 hover:bg-zinc-700 cursor-pointer"
            onClick={() => {
              closeMenus();
            }}>
            Merge ... into {branchName}
          </div>
          <div
            className="px-4 py-2 hover:bg-zinc-700 cursor-pointer"
            onClick={() => {
              closeMenus();
            }}>
            Rebase ... onto {branchName}
          </div>
          <div className="my-1 border-t border-zinc-700" />
          <div className="text-[9px] text-zinc-500 uppercase font-semibold px-4 pt-2 pb-1 tracking-wide">
            Worktree
          </div>
          <div
            className="px-4 py-2 hover:bg-zinc-700 cursor-pointer"
            onClick={() => {
              closeMenus();
            }}>
            Checkout {branchName}
          </div>
          <div
            className="px-4 py-2 hover:bg-zinc-700 cursor-pointer"
            onClick={() => {
              closeMenus();
            }}>
            Create worktree from {branchName}
          </div>
          <div className="my-1 border-t border-zinc-700" />
          <div className="text-[9px] text-zinc-500 uppercase font-semibold px-4 pt-2 pb-1 tracking-wide">
            Branching
          </div>
          <div
            className="px-4 py-2 hover:bg-zinc-700 cursor-pointer"
            onClick={() => {
              closeMenus();
            }}>
            Create branch here
          </div>
          <div
            className="px-4 py-2 hover:bg-zinc-700 cursor-pointer"
            onClick={() => {
              closeMenus();
            }}>
            Cherry pick commit
          </div>
          <div
            className="px-4 py-2 hover:bg-zinc-700 cursor-pointer"
            onClick={() => {
              closeMenus();
            }}>
            Reset ... to this commit
          </div>
          <div
            className="px-4 py-2 hover:bg-zinc-700 cursor-pointer"
            onClick={() => {
              closeMenus();
            }}>
            Revert commit
          </div>

          <div className="my-1 border-t border-zinc-700" />
          {/* Compare fuera del submenú */}
          <div className="text-[9px] text-zinc-500 uppercase font-semibold px-4 pt-2 pb-1 tracking-wide">
            Compare
          </div>
          <div
            className="px-4 py-2 hover:bg-zinc-700 cursor-pointer"
            onClick={() => {
              closeMenus();
            }}>
            Compare commit against working directory
          </div>
          <div className="my-1 border-t border-zinc-700" />
          {/* Otros (dropdown) */}
          <div
            className="relative"
            ref={otherRef}>
            <div
              className="px-4 py-2 hover:bg-zinc-700 cursor-pointer flex items-center gap-2"
              onMouseEnter={() => setShowOther(true)}
              onClick={() => setShowOther((v) => !v)}
              tabIndex={0}>
              Otras acciones
              <IconChevronRight size={14} />
            </div>
            {/* Submenú Otros */}
            {showOther && (
              <div
                className={`submenu bg-zinc-900/95 border border-zinc-600 rounded shadow-lg py-1 text-xs text-zinc-200 select-none min-w-[180px] z-[100000] absolute ${
                  submenuDirection === "down" ? "top-0" : "bottom-0"
                } ${submenuLeft ? "left-full ml-1" : "right-full mr-1"}`}
                onMouseEnter={handleSubmenuMouseEnter}
                onMouseLeave={handleSubmenuMouseLeave}>
                <div
                  className="px-4 py-2 hover:bg-zinc-700 cursor-pointer"
                  onClick={() => {
                    closeMenus();
                  }}>
                  Copy branch name
                </div>
                <div
                  className="px-4 py-2 hover:bg-zinc-700 cursor-pointer"
                  onClick={() => {
                    closeMenus();
                  }}>
                  Copy commit sha
                </div>
                <div
                  className="px-4 py-2 hover:bg-zinc-700 cursor-pointer"
                  onClick={() => {
                    closeMenus();
                  }}>
                  Hide
                </div>
                <div
                  className="px-4 py-2 hover:bg-zinc-700 cursor-pointer"
                  onClick={() => {
                    closeMenus();
                  }}>
                  Solo
                </div>
                <div
                  className="px-4 py-2 hover:bg-zinc-700 cursor-pointer"
                  onClick={() => {
                    closeMenus();
                  }}>
                  Create tag here
                </div>
                <div
                  className="px-4 py-2 hover:bg-zinc-700 cursor-pointer"
                  onClick={() => {
                    closeMenus();
                  }}>
                  Create annotated tag here
                </div>
              </div>
            )}
          </div>
          <div className="my-1 border-t border-zinc-700" />
          <div className="text-[9px] text-zinc-500 uppercase font-semibold px-4 pt-2 pb-1 tracking-wide">
            Danger zone
          </div>
          <div
            className="px-4 py-2 hover:bg-zinc-700 cursor-pointer"
            onClick={() => {
              closeMenus();
            }}>
            Rename {branchName}
          </div>
          <div
            className="px-4 py-2 hover:bg-zinc-700 cursor-pointer text-red-400"
            onClick={() => {
              closeMenus();
            }}>
            Delete {branchName}
          </div>
        </div>
      </div>,
      document.body
    );
  }

  if (!repoPath) return null;

  return (
    <div className="p-1 my-2 h-full flex flex-col relative">
      <div className="font-bold mb-2 flex items-center gap-2 text-sm">
        <div className="flex gap-1">
          <button
            className={`px-2 py-1 rounded flex items-center gap-1 text-sm ${
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
            className={`px-2 py-1 rounded flex items-center gap-1 text-sm ${
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
      {loading && <div className="text-sm text-zinc-400">Cargando...</div>}
      {error && <div className="text-sm text-red-400">{error}</div>}
      <div className="flex-1 min-h-0 mt-2">
        <div
          className="overflow-y-auto max-h-[55vh] pr-1"
          style={{ height: "100%" }}>
          {renderTree(grouped)}
          {renderContextMenu()}
        </div>
      </div>
    </div>
  );
}
