import { useState } from "react";
import { openLocalRepository } from "@/shared/api/repositories";
import { openDirectoryDialog } from "@/shared/platform/tauri/dialog";
import { IconFolderPlus } from "../icons/icons";

export function OpenRepoButton() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const handleOpenRepo = async () => {
    setLoading(true);
    setResult(null);
    const selected = await openDirectoryDialog();
    if (selected) {
      try {
        const res = await openLocalRepository(selected);
        setResult(res);
      } catch (error) {
        setResult(String(error));
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
