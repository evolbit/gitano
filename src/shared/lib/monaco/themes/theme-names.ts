export const MONACO_THEME = {
  AyuDark: "gitano-ayu-dark",
} as const;

export type MonacoThemeName =
  (typeof MONACO_THEME)[keyof typeof MONACO_THEME];

export const DEFAULT_MONACO_THEME = MONACO_THEME.AyuDark;
