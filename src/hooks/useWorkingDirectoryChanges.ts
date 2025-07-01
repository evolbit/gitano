import { core } from "@tauri-apps/api";
import { useCallback, useEffect, useRef, useState } from "react";
import { FileChange } from "../types/git";

interface UseWorkingDirectoryChangesOptions {
  pollInterval?: number; // Intervalo en milisegundos para el polling
  enabled?: boolean; // Si el polling está habilitado
  pauseOnInactive?: boolean; // (No se usará)
  cacheKey?: string; // Clave única para cachear resultados
  showNotifications?: boolean; // (No se usará)
}

export const useWorkingDirectoryChanges = (
  repoPath: string | undefined,
  options: UseWorkingDirectoryChangesOptions = {}
) => {
  const { pollInterval = 2000, enabled = true } = options;

  const [changes, setChanges] = useState<FileChange[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isMountedRef = useRef(true);

  // Asegura que isMountedRef.current sea true al montar
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  // Función para obtener los cambios
  const fetchChanges = useCallback(async () => {
    console.log("[useWorkingDirectoryChanges] Polling repoPath:", repoPath);
    if (!repoPath) return;
    setLoading(true);
    setError(null);
    console.log("[useWorkingDirectoryChanges] Fetching changes");
    try {
      const result: FileChange[] = await core.invoke(
        "get_working_directory_changes",
        {
          path: repoPath,
        }
      );
      console.log(
        "[useWorkingDirectoryChanges] Working directory changes:",
        result,
        isMountedRef.current
      );
      if (isMountedRef.current) {
        setChanges(result);
      }
    } catch (err) {
      if (isMountedRef.current) {
        setError(String(err));
        setChanges([]);
        console.error("[useWorkingDirectoryChanges] Error:", err);
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [repoPath]);

  // Polling automático
  useEffect(() => {
    if (!repoPath || !enabled) {
      setChanges([]);
      return;
    }
    fetchChanges(); // Carga inicial
    intervalRef.current = setInterval(fetchChanges, pollInterval);
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [repoPath, enabled, pollInterval, fetchChanges]);

  return {
    changes,
    loading,
    error,
  };
};
