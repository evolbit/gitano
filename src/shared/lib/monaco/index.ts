export {
  MONACO_EDITOR_FONT_FAMILY,
  MONACO_EDITOR_FONT_SIZE,
  MONACO_EDITOR_LINE_HEIGHT,
} from "./constants";
export {
  inferMonacoLanguage,
  MONACO_PLAINTEXT_LANGUAGE,
} from "./language";
export { loadConfiguredMonaco } from "./load-configured-monaco";
export {
  DEFAULT_MONACO_THEME,
  MONACO_THEME,
  registerMonacoThemes,
} from "./themes";
export type { GitanoMonacoTheme, MonacoApi, MonacoThemeName } from "./themes";
