import { core } from "@tauri-apps/api";
import { useCallback, useEffect, useRef, useState } from "react";
import { FileChangeWithHunks } from "../types/git";

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

  const [changes, setChanges] = useState<FileChangeWithHunks[]>([]);
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

  // Función para obtener los cambios y los hunks
  const fetchChanges = useCallback(async () => {
    if (!repoPath) return;
    setLoading(true);
    setError(null);
    try {
      const result: FileChangeWithHunks[] = await core.invoke(
        "get_working_directory_changes",
        {
          path: repoPath,
        }
      );
      if (isMountedRef.current) {
        setChanges(result);
      }
    } catch (err) {
      if (isMountedRef.current) {
        setError(String(err));
        setChanges([]);
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
