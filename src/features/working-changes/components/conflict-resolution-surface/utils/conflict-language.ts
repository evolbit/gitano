const LANGUAGE_BY_EXTENSION: Record<string, string> = {
  css: "css",
  go: "go",
  html: "html",
  java: "java",
  js: "javascript",
  json: "json",
  jsx: "javascript",
  md: "markdown",
  php: "php",
  py: "python",
  rs: "rust",
  sh: "shell",
  ts: "typescript",
  tsx: "typescript",
  xml: "xml",
  yaml: "yaml",
  yml: "yaml",
};

export function inferConflictEditorLanguage(filePath: string) {
  const extension = filePath.split(".").pop()?.toLowerCase();
  if (!extension) return "plaintext";

  return LANGUAGE_BY_EXTENSION[extension] ?? "plaintext";
}
