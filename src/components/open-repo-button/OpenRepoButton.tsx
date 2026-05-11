import { core } from "@tauri-apps/api";
import { open } from "@tauri-apps/plugin-dialog";
import { useState } from "react";
import { IconFolderPlus } from "../icons";

export function OpenRepoButton() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const handleOpenRepo = async () => {
    setLoading(true);
    setResult(null);
    const selected = await open({ directory: true });
    if (selected && typeof selected === "string") {
      try {
        const res = await core.invoke<string>("open_local_repo", {
          path: selected,
        });
        setResult(res);
      } catch (e: any) {
        setResult(e.toString());
      }
    }
    setLoading(false);
  };

  return (
    <div className="p-4">
      <button
        className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-zinc-400 disabled:opacity-50"
        onClick={handleOpenRepo}
        disabled={loading}>
        <IconFolderPlus className="w-5 h-5" />
        {loading ? "Abriendo..." : "Abrir repositorio local"}
      </button>
      {result && <div className="mt-2 text-xs text-gray-300">{result}</div>}
    </div>
  );
}
