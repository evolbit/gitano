function stripTrailingGitSuffix(path: string) {
  return path.replace(/\.git$/, "").replace(/\/+$/, "");
}

function stripLeadingSlashes(path: string) {
  return path.replace(/^\/+/, "");
}

function normalizeWebRemoteUrl(remoteUrl: string): string | null {
  const trimmed = remoteUrl.trim();
  if (!trimmed) return null;

  const scpStyle = trimmed.match(/^git@([^:]+):(.+)$/);
  if (scpStyle) {
    const [, host, path] = scpStyle;
    return `https://${host}/${stripTrailingGitSuffix(path)}`;
  }

  try {
    const url = new URL(trimmed);
    const protocol = url.protocol.toLowerCase();
    const path = stripTrailingGitSuffix(stripLeadingSlashes(url.pathname));

    if (!url.hostname || !path) return null;

    if (protocol === "http:" || protocol === "https:") {
      return `${url.protocol}//${url.hostname}${url.port ? `:${url.port}` : ""}/${path}`;
    }

    if (protocol === "ssh:" || protocol === "git+ssh:") {
      return `https://${url.hostname}/${path}`;
    }
  } catch {
    return null;
  }

  return null;
}

export function buildRemoteCommitUrl(remoteUrl: string, sha: string) {
  const baseUrl = normalizeWebRemoteUrl(remoteUrl);
  const commitSha = sha.trim();

  if (!baseUrl || !commitSha) return null;

  const host = (() => {
    try {
      return new URL(baseUrl).hostname.toLowerCase();
    } catch {
      return "";
    }
  })();
  const encodedSha = encodeURIComponent(commitSha);

  if (host.includes("gitlab")) {
    return `${baseUrl}/-/commit/${encodedSha}`;
  }

  if (host.includes("bitbucket")) {
    return `${baseUrl}/commits/${encodedSha}`;
  }

  return `${baseUrl}/commit/${encodedSha}`;
}
