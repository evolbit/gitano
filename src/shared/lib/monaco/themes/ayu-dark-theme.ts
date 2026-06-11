import { MONACO_THEME } from "./theme-names";
import type { GitanoMonacoTheme } from "./types";

const AYU_DARK_PALETTE = {
  Accent: "E6B450",
  Background: "0B0E14",
  Border: "1F2430",
  Comment: "5C6773",
  Cyan: "95E6CB",
  Foreground: "B3B1AD",
  Green: "AAD94C",
  Highlight: "11151C",
  LineNumber: "3D424D",
  Orange: "FF8F40",
  Purple: "D2A6FF",
  Selection: "253340",
  Widget: "101521",
} as const;

const ayuColor = (color: string) => `#${color}`;

export const AYU_DARK_MONACO_THEME: GitanoMonacoTheme = {
  name: MONACO_THEME.AyuDark,
  definition: {
    base: "vs-dark",
    inherit: true,
    rules: [
      {
        token: "",
        foreground: AYU_DARK_PALETTE.Foreground,
        background: AYU_DARK_PALETTE.Background,
      },
      { token: "comment", foreground: AYU_DARK_PALETTE.Comment },
      { token: "constant", foreground: AYU_DARK_PALETTE.Orange },
      { token: "delimiter", foreground: AYU_DARK_PALETTE.Foreground },
      { token: "function", foreground: AYU_DARK_PALETTE.Accent },
      { token: "identifier", foreground: AYU_DARK_PALETTE.Foreground },
      { token: "keyword", foreground: AYU_DARK_PALETTE.Orange },
      { token: "number", foreground: AYU_DARK_PALETTE.Purple },
      { token: "operator", foreground: AYU_DARK_PALETTE.Orange },
      { token: "regexp", foreground: AYU_DARK_PALETTE.Cyan },
      { token: "string", foreground: AYU_DARK_PALETTE.Green },
      { token: "type", foreground: AYU_DARK_PALETTE.Cyan },
      { token: "variable", foreground: AYU_DARK_PALETTE.Foreground },
    ],
    colors: {
      "activityBar.background": ayuColor(AYU_DARK_PALETTE.Background),
      "editor.background": ayuColor(AYU_DARK_PALETTE.Background),
      "editor.findMatchBackground": "#E6B45040",
      "editor.findMatchHighlightBackground": "#E6B45026",
      "editor.foreground": ayuColor(AYU_DARK_PALETTE.Foreground),
      "editor.lineHighlightBackground": ayuColor(AYU_DARK_PALETTE.Highlight),
      "editor.selectionBackground": ayuColor(AYU_DARK_PALETTE.Selection),
      "editorCursor.foreground": ayuColor(AYU_DARK_PALETTE.Accent),
      "editorGutter.background": ayuColor(AYU_DARK_PALETTE.Background),
      "editorLineNumber.activeForeground": ayuColor(AYU_DARK_PALETTE.Accent),
      "editorLineNumber.foreground": ayuColor(AYU_DARK_PALETTE.LineNumber),
      "editorWidget.background": ayuColor(AYU_DARK_PALETTE.Widget),
      "editorWidget.border": ayuColor(AYU_DARK_PALETTE.Border),
      "input.background": ayuColor(AYU_DARK_PALETTE.Widget),
      "input.border": ayuColor(AYU_DARK_PALETTE.Border),
      "list.activeSelectionBackground": ayuColor(AYU_DARK_PALETTE.Selection),
      "list.hoverBackground": ayuColor(AYU_DARK_PALETTE.Highlight),
      "scrollbarSlider.activeBackground": "#E6B45066",
      "scrollbarSlider.background": "#E6B45033",
      "scrollbarSlider.hoverBackground": "#E6B4504D",
    },
  },
};
