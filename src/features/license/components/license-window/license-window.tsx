import {
  getLicenseStatus,
  importLicenseFile,
  refreshLicenseValidation,
  type LicenseStatus,
} from "@/shared/api/license";
import { IconCloud, IconFolder, IconX } from "@/shared/components/icons/icons";
import { openLicenseFileDialog } from "@/shared/platform/tauri/dialog";
import { useCallback, useEffect, useMemo, useState } from "react";
import ReactDOM from "react-dom";

type LicenseWindowProps = {
  open: boolean;
  onClose: () => void;
};

const DATE_FORMATTER = new Intl.DateTimeFormat(undefined, {
  year: "numeric",
  month: "short",
  day: "numeric",
});

function formatDate(value: number | null) {
  if (!value) return "Not available";
  return DATE_FORMATTER.format(new Date(value));
}

function statusLabel(status: LicenseStatus | null) {
  if (!status) return "Checking";
  if (status.aiEntitled) return "Premium";
  if (status.state === "validationRequired") return "Validation required";
  if (status.state === "revoked") return "License revoked";
  if (status.state === "expired") return "License expired";
  if (status.state === "wrongMachine") return "Wrong machine";
  return "Free";
}

export function LicenseWindow({ open, onClose }: LicenseWindowProps) {
  const [status, setStatus] = useState<LicenseStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadStatus = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setStatus(await getLicenseStatus());
    } catch (error) {
      setError(error instanceof Error ? error.message : String(error));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      void loadStatus();
    }
  }, [open, loadStatus]);

  const handleImport = async () => {
    const path = await openLicenseFileDialog();
    if (!path) return;
    setLoading(true);
    setError(null);
    try {
      setStatus(await importLicenseFile({ path }));
    } catch (error) {
      setError(error instanceof Error ? error.message : String(error));
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setLoading(true);
    setError(null);
    try {
      setStatus(await refreshLicenseValidation({ force: true }));
    } catch (error) {
      setError(error instanceof Error ? error.message : String(error));
    } finally {
      setLoading(false);
    }
  };

  const statusTone = useMemo(
    () =>
      status?.aiEntitled
        ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
        : "border-zinc-700 bg-background-emphasis text-zinc-200",
    [status],
  );

  if (!open) return null;

  return ReactDOM.createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
      <div className="flex max-h-[86vh] w-full max-w-[560px] flex-col overflow-hidden rounded border border-border bg-background text-foreground shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <div>
            <h2 className="text-sm font-semibold text-white">License</h2>
            <p className="mt-1 text-xs text-zinc-400">
              Manage premium AI access for this machine.
            </p>
          </div>
          <button
            type="button"
            className="rounded p-1 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white"
            onClick={onClose}
            aria-label="Close license window"
          >
            <IconX size={18} />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
          <div className={`rounded border p-4 ${statusTone}`}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-xs uppercase text-zinc-400">
                  Current plan
                </div>
                <div className="mt-1 text-lg font-semibold">
                  {statusLabel(status)}
                </div>
              </div>
            </div>
            {status?.reason ? (
              <p className="mt-3 text-sm text-zinc-300">{status.reason}</p>
            ) : null}
          </div>

          <div className="grid gap-3 text-sm sm:grid-cols-2">
            <InfoRow label="License ID" value={status?.licenseId ?? "None"} />
            <InfoRow label="Customer" value={status?.customerEmail ?? "None"} />
            <InfoRow
              label="Expires"
              value={formatDate(status?.expiresAtMs ?? null)}
            />
            <InfoRow
              label="Validation due"
              value={formatDate(status?.validationRequiredAtMs ?? null)}
            />
          </div>

          {error ? (
            <div className="rounded border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
              {error}
            </div>
          ) : null}
        </div>

        <div className="flex flex-col gap-2 border-t border-border px-5 py-4 sm:flex-row sm:justify-end">
          <button
            type="button"
            className="inline-flex items-center justify-center gap-2 rounded border border-border px-3 py-2 text-sm text-zinc-200 transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
            onClick={handleRefresh}
            disabled={loading || !status?.licenseId}
          >
            <IconCloud size={16} />
            Refresh
          </button>
          <button
            type="button"
            className="inline-flex items-center justify-center gap-2 rounded bg-blue-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
            onClick={handleImport}
            disabled={loading}
          >
            <IconFolder size={16} />
            Import file
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-border bg-background-emphasis px-3 py-2">
      <div className="text-xs text-zinc-500">{label}</div>
      <div className="mt-1 truncate text-zinc-200">{value}</div>
    </div>
  );
}
