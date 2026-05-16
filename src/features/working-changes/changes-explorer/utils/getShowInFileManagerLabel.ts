export function getShowInFileManagerLabel() {
  if (typeof navigator === "undefined") {
    return "Show in File Manager";
  }

  const platform = navigator.userAgent.toLowerCase();

  if (platform.includes("mac")) {
    return "Show in Finder";
  }

  if (platform.includes("win")) {
    return "Show in Explorer";
  }

  return "Show in File Manager";
}
