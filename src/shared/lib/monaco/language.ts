const LANGUAGE_BY_EXTENSION: Record<string, string> = {
  c: "c",
  cc: "cpp",
  cpp: "cpp",
  cs: "csharp",
  css: "css",
  go: "go",
  h: "c",
  hpp: "cpp",
  html: "html",
  java: "java",
  js: "javascript",
  json: "json",
  jsx: "javascript",
  kt: "kotlin",
  kts: "kotlin",
  less: "less",
  md: "markdown",
  php: "php",
  py: "python",
  rb: "ruby",
  rs: "rust",
  sass: "scss",
  scss: "scss",
  sh: "shell",
  sql: "sql",
  swift: "swift",
  toml: "toml",
  ts: "typescript",
  tsx: "typescript",
  xml: "xml",
  yaml: "yaml",
  yml: "yaml",
  zsh: "shell",
};

const LANGUAGE_BY_BASENAME: Record<string, string> = {
  dockerfile: "dockerfile",
  makefile: "makefile",
};

export const MONACO_PLAINTEXT_LANGUAGE = "plaintext";

export function inferMonacoLanguage(filePath: string) {
  const fileName = filePath.split(/[\\/]/).pop()?.toLowerCase() ?? "";
  const basenameLanguage = LANGUAGE_BY_BASENAME[fileName];

  if (basenameLanguage) return basenameLanguage;

  const extension = fileName.split(".").pop();
  if (!extension || extension === fileName) return MONACO_PLAINTEXT_LANGUAGE;

  return LANGUAGE_BY_EXTENSION[extension] ?? MONACO_PLAINTEXT_LANGUAGE;
}
