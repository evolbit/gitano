import { AYU_DARK_MONACO_THEME } from "./ayu-dark-theme";
import type { GitanoMonacoTheme, MonacoApi } from "./types";

const GITANO_MONACO_THEMES: readonly GitanoMonacoTheme[] = [
  AYU_DARK_MONACO_THEME,
];

export function registerMonacoThemes(monaco: MonacoApi) {
  GITANO_MONACO_THEMES.forEach(({ name, definition }) => {
    monaco.editor.defineTheme(name, definition);
  });
}
