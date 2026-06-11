import {
  DEFAULT_MONACO_THEME,
  registerMonacoThemes,
} from "./themes";
import type { MonacoApi } from "./themes";

let configuredMonacoPromise: Promise<MonacoApi> | null = null;

export function loadConfiguredMonaco() {
  configuredMonacoPromise ??= import("monaco-editor").then((monaco) => {
    registerMonacoThemes(monaco);
    monaco.editor.setTheme(DEFAULT_MONACO_THEME);
    return monaco;
  });

  return configuredMonacoPromise;
}
