export function encodeRefPath(refName: string) {
  return refName.split("/").map(encodeURIComponent).join("/");
}

export function normalizeRemoteUrl(remoteUrl: string) {
  const trimmed = remoteUrl.trim();
  const scpStyle = trimmed.match(/^git@([^:]+):(.+)$/);

  if (scpStyle) {
    return `https://${scpStyle[1]}/${scpStyle[2].replace(/\.git$/, "")}`;
  }

  try {
    const url = new URL(trimmed);
    const path = url.pathname.replace(/^\/+/, "").replace(/\.git$/, "");
    return `https://${url.hostname}/${path}`;
  } catch {
    return trimmed.replace(/\.git$/, "");
  }
}

export function buildRemoteTagUrl(remoteUrl: string, tagName: string) {
  const baseUrl = normalizeRemoteUrl(remoteUrl).replace(/\/+$/, "");
  const host = (() => {
    try {
      return new URL(baseUrl).hostname.toLowerCase();
    } catch {
      return "";
    }
  })();
  const encodedTag = encodeRefPath(tagName);

  if (host.includes("gitlab")) {
    return `${baseUrl}/-/tags/${encodedTag}`;
  }

  if (host.includes("bitbucket")) {
    return `${baseUrl}/src/${encodedTag}`;
  }

  return `${baseUrl}/tree/${encodedTag}`;
}

