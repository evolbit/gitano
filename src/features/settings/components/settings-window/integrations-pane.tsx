import { useCallback, useEffect, useRef, useState } from "react";
import {
  type GitHubAccessMethod,
  type GitHubOAuthStartResponse,
  type ProviderIntegration,
} from "@/shared/api/integrations";
import { openExternalUrl } from "@/shared/platform/tauri/opener";
import {
  ActionButton,
  SectionLabel,
  SettingsRow,
  ValuePill,
  type MaybePromise,
} from "./settings-controls";

type IntegrationsPaneProps = {
  providers: ProviderIntegration[];
  loading: boolean;
  error: string | null;
  busyProviderIds: Record<string, boolean>;
  onCompleteGitHubOAuth: (
    deviceCode: string,
    options?: { silent?: boolean },
  ) => MaybePromise;
  onDisconnectProvider: (providerId: string) => MaybePromise;
  onSetGitHubAccessMethod: (accessMethod: GitHubAccessMethod) => MaybePromise;
  onStartGitHubOAuth: () => Promise<GitHubOAuthStartResponse>;
  onVerifyProvider: (providerId: string) => MaybePromise;
};

function providerDescription(provider: ProviderIntegration) {
  if (provider.id === "github") {
    return "Connect GitHub to list pull requests, review changes, approve, and request changes from Gitano.";
  }

  return `${provider.displayName} integration provider.`;
}

function ProviderStatus({ provider }: { provider: ProviderIntegration }) {
  if (provider.status === "connected") {
    return (
      <ValuePill>
        {provider.connection?.accountLogin
          ? `Connected as ${provider.connection.accountLogin}`
          : "Connected"}
      </ValuePill>
    );
  }

  return <ValuePill>Disconnected</ValuePill>;
}

const GITHUB_ACCESS_METHOD_LABELS: Record<GitHubAccessMethod, string> = {
  autoFallback: "Automatic fallback",
  oauth: "OAuth",
  ghCli: "GitHub CLI",
};

function GitHubAccessMethodSelector({
  busy,
  provider,
  onSetAccessMethod,
}: {
  busy: boolean;
  provider: ProviderIntegration;
  onSetAccessMethod: (accessMethod: GitHubAccessMethod) => MaybePromise;
}) {
  const selected = provider.selectedAccessMethod ?? "autoFallback";

  return (
    <div className="w-full rounded border border-border bg-background px-3 py-2 text-xs text-zinc-300">
      <div className="mb-2 text-[11px] font-semibold uppercase tracking-normal text-zinc-500">
        Access method
      </div>
      <div className="grid gap-1">
        {(["autoFallback", "oauth", "ghCli"] as GitHubAccessMethod[]).map(
          (method) => (
            <label
              key={method}
              className="flex items-center gap-2 rounded px-2 py-1.5 transition-colors hover:bg-zinc-800"
            >
              <input
                type="radio"
                name="github-access-method"
                value={method}
                checked={selected === method}
                disabled={busy}
                onChange={() => {
                  void onSetAccessMethod(method);
                }}
              />
              <span>{GITHUB_ACCESS_METHOD_LABELS[method]}</span>
            </label>
          ),
        )}
      </div>
    </div>
  );
}

function GitHubAccessStatuses({ provider }: { provider: ProviderIntegration }) {
  const oauth = provider.oauth;
  const ghCli = provider.ghCli;
  const oauthLabel =
    oauth?.status === "connected"
      ? oauth.connection?.accountLogin
        ? `Connected as ${oauth.connection.accountLogin}`
        : "Connected"
      : "Disconnected";
  const ghCliLabel = (() => {
    if (!ghCli) return "Unknown";
    if (ghCli.availability === "ready") {
      return ghCli.connection?.accountLogin
        ? `Ready as ${ghCli.connection.accountLogin}`
        : "Ready";
    }
    if (ghCli.availability === "notAuthenticated") {
      return "Installed, not authenticated";
    }
    return "Not installed";
  })();
  const ghCliDetails = (() => {
    if (!ghCli) return null;
    if (ghCli.availability === "notInstalled") {
      return ghCli.message ?? "Install GitHub CLI externally to use this method.";
    }
    if (ghCli.availability === "notAuthenticated") {
      return ghCli.message ?? "Authenticate with `gh auth login`.";
    }
    return ghCli.version ? `Version ${ghCli.version}` : null;
  })();

  return (
    <div className="w-full rounded border border-border bg-background px-3 py-2 text-xs leading-5 text-zinc-300">
      <div className="grid gap-2 md:grid-cols-2">
        <div>
          <div className="text-[11px] uppercase tracking-normal text-zinc-500">
            OAuth
          </div>
          <div className="font-medium text-zinc-100">{oauthLabel}</div>
          {oauth?.lastError ? (
            <div className="mt-1 text-red-200">{oauth.lastError}</div>
          ) : null}
        </div>
        <div>
          <div className="text-[11px] uppercase tracking-normal text-zinc-500">
            GitHub CLI
          </div>
          <div className="font-medium text-zinc-100">{ghCliLabel}</div>
          {ghCliDetails ? (
            <div className="mt-1 text-zinc-400">{ghCliDetails}</div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

type GitHubOAuthSession = GitHubOAuthStartResponse & {
  expiresAt: number;
};

function isPendingOAuthError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes("authorization is still pending");
}

function isSlowDownOAuthError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes("poll more slowly");
}

async function copyTextToClipboard(value: string) {
  if (window.navigator.clipboard?.writeText) {
    await window.navigator.clipboard.writeText(value);
    return;
  }

  const textArea = document.createElement("textarea");
  textArea.value = value;
  textArea.setAttribute("readonly", "");
  textArea.style.position = "fixed";
  textArea.style.opacity = "0";
  document.body.appendChild(textArea);
  textArea.select();
  document.execCommand("copy");
  document.body.removeChild(textArea);
}

function GitHubOAuthConnect({
  busy,
  onComplete,
  onStart,
}: {
  busy: boolean;
  onComplete: (deviceCode: string, options?: { silent?: boolean }) => MaybePromise;
  onStart: () => Promise<GitHubOAuthStartResponse>;
}) {
  const [session, setSession] = useState<GitHubOAuthSession | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const completionInFlightRef = useRef(false);

  const completeAuthorization = useCallback(async () => {
    if (!session) return;
    if (completionInFlightRef.current) return;

    completionInFlightRef.current = true;
    setError(null);
    try {
      setStatus("Checking GitHub authorization...");
      await onComplete(session.deviceCode, { silent: true });
      setSession(null);
      setStatus(null);
    } catch (completeError) {
      if (isSlowDownOAuthError(completeError)) {
        setStatus("Waiting for GitHub authorization...");
        setSession((current) =>
          current?.deviceCode === session.deviceCode
            ? { ...current, interval: current.interval + 5 }
            : current,
        );
        return;
      }

      if (isPendingOAuthError(completeError)) {
        setStatus("Waiting for GitHub authorization...");
        return;
      }

      setError(
        completeError instanceof Error
          ? completeError.message
          : String(completeError),
      );
      setSession(null);
    } finally {
      completionInFlightRef.current = false;
    }
  }, [onComplete, session]);

  const startAuthorization = useCallback(async () => {
    setError(null);
    setStatus(null);
    try {
      const response = await onStart();
      setSession({
        ...response,
        expiresAt: Date.now() + response.expiresIn * 1000,
      });
      setStatus("Waiting for GitHub authorization...");
      void openExternalUrl(response.verificationUri).catch((openError) =>
        setError(
          openError instanceof Error ? openError.message : String(openError),
        ),
      );
    } catch (startError) {
      setError(startError instanceof Error ? startError.message : String(startError));
    }
  }, [onStart]);

  useEffect(() => {
    if (!session) return undefined;

    const delayMs = Math.max(session.interval, 1) * 1000;
    const intervalId = window.setInterval(() => {
      if (Date.now() > session.expiresAt) {
        setSession(null);
        setStatus(null);
        setError("GitHub authorization expired. Start the connection flow again.");
        return;
      }

      void completeAuthorization();
    }, delayMs);

    return () => window.clearInterval(intervalId);
  }, [completeAuthorization, session]);

  return (
    <div className="flex w-full flex-col items-stretch gap-2 md:w-[300px]">
      {session ? (
        <div className="rounded border border-border bg-background px-3 py-2 text-xs leading-5 text-zinc-300">
          <div className="text-[11px] uppercase tracking-wide text-zinc-500">
            GitHub code
          </div>
          <div
            aria-label="GitHub user code"
            className="select-all text-base font-semibold"
          >
            {session.userCode}
          </div>
          <div className="mt-1 break-all text-zinc-400">
            {session.verificationUri}
          </div>
          {status ? <div className="mt-2 text-zinc-400">{status}</div> : null}
          {error ? (
            <div role="alert" className="mt-2 text-red-200">
              {error}
            </div>
          ) : null}
        </div>
      ) : null}
      <div className="flex justify-end">
        {session ? (
          <div className="flex flex-wrap justify-end gap-2">
            <ActionButton
              disabled={busy}
              onClick={() => {
                void openExternalUrl(session.verificationUri).catch((openError) =>
                  setError(
                    openError instanceof Error
                      ? openError.message
                      : String(openError),
                  ),
                );
              }}
            >
              Open GitHub
            </ActionButton>
            <ActionButton
              disabled={busy}
              onClick={() => {
                void copyTextToClipboard(session.userCode)
                  .then(() => setStatus("Code copied. Waiting for GitHub authorization..."))
                  .catch((copyError) =>
                    setError(
                      copyError instanceof Error
                        ? copyError.message
                        : String(copyError),
                    ),
                  );
              }}
            >
              Copy code
            </ActionButton>
            <ActionButton
              disabled={busy}
              onClick={() => {
                setSession(null);
                setError(null);
                setStatus(null);
              }}
            >
              Cancel
            </ActionButton>
          </div>
        ) : (
          <ActionButton
            disabled={busy}
            onClick={() => {
              void startAuthorization();
            }}
          >
            {busy ? "Starting" : "Connect"}
          </ActionButton>
        )}
      </div>
    </div>
  );
}

function ConnectedProviderActions({
  provider,
  busy,
  onDisconnect,
  onVerify,
}: {
  provider: ProviderIntegration;
  busy: boolean;
  onDisconnect: (providerId: string) => MaybePromise;
  onVerify: (providerId: string) => MaybePromise;
}) {
  return (
    <div className="flex flex-wrap justify-end gap-2">
      <ActionButton disabled={busy} onClick={() => onVerify(provider.id)}>
        {busy ? "Checking" : "Verify"}
      </ActionButton>
      <ActionButton
        disabled={busy}
        variant="danger"
        onClick={() => onDisconnect(provider.id)}
      >
        Disconnect
      </ActionButton>
    </div>
  );
}

export function IntegrationsPane({
  providers,
  loading,
  error,
  busyProviderIds,
  onCompleteGitHubOAuth,
  onDisconnectProvider,
  onSetGitHubAccessMethod,
  onStartGitHubOAuth,
  onVerifyProvider,
}: IntegrationsPaneProps) {
  return (
    <div>
      <SectionLabel>Providers</SectionLabel>
      <div className="rounded border border-border bg-background-emphasis px-4 py-3 text-xs leading-5 text-zinc-300">
        Provider connections are configured here and reused by Gitano workflows
        such as pull request review.
      </div>
      {loading ? (
        <div className="mt-4 rounded border border-border bg-background-emphasis px-3 py-2 text-xs text-zinc-300">
          Loading integrations...
        </div>
      ) : null}
      {error ? (
        <div
          role="alert"
          className="mt-4 rounded border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs leading-5 text-red-100"
        >
          {error}
        </div>
      ) : null}
      {providers.map((provider) => {
        const busy = Boolean(busyProviderIds[provider.id]);
        const connected = provider.status === "connected";
        return (
          <SettingsRow
            key={provider.id}
            title={provider.displayName}
            description={providerDescription(provider)}
            warning={provider.lastError}
          >
            <div className="flex w-full flex-col items-stretch gap-2 md:w-auto md:items-end">
              <ProviderStatus provider={provider} />
              {provider.id === "github" ? (
                <>
                  <GitHubAccessMethodSelector
                    busy={busy}
                    provider={provider}
                    onSetAccessMethod={onSetGitHubAccessMethod}
                  />
                  <GitHubAccessStatuses provider={provider} />
                </>
              ) : null}
              {provider.id === "github" && !connected ? (
                <GitHubOAuthConnect
                  busy={busy}
                  onComplete={onCompleteGitHubOAuth}
                  onStart={onStartGitHubOAuth}
                />
              ) : null}
              {connected ? (
                <ConnectedProviderActions
                  provider={provider}
                  busy={busy}
                  onDisconnect={onDisconnectProvider}
                  onVerify={onVerifyProvider}
                />
              ) : null}
            </div>
          </SettingsRow>
        );
      })}
      {!loading && providers.length === 0 ? (
        <div className="mt-4 rounded border border-border bg-background-emphasis px-3 py-2 text-xs text-zinc-400">
          No integrations are available.
        </div>
      ) : null}
    </div>
  );
}
