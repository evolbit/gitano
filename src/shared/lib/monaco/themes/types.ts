import type * as Monaco from "monaco-editor";
import type { MonacoThemeName } from "./theme-names";

export type MonacoApi = typeof Monaco;

export type GitanoMonacoTheme = {
  name: MonacoThemeName;
  definition: Monaco.editor.IStandaloneThemeData;
};
