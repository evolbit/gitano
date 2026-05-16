import { createTheme } from "@mantine/core";

export const appTheme = createTheme({
  fontFamily: '"IBM Plex Sans", sans-serif',
  fontFamilyMonospace: '"IBM Plex Mono", monospace',
  fontSizes: {
    xs: "var(--ui-font-size-xs)",
    sm: "var(--ui-font-size-sm)",
    md: "var(--ui-font-size-md)",
    lg: "var(--ui-font-size-lg)",
    xl: "var(--ui-font-size-xl)",
  },
  headings: {
    fontFamily: '"IBM Plex Sans", sans-serif',
  },
  components: {
    Tooltip: {
      defaultProps: {
        withArrow: false,
        openDelay: 140,
        offset: 8,
      },
      styles: {
        tooltip: {
          backgroundColor: "rgba(46, 49, 56, 0.96)",
          color: "rgb(212, 212, 216)",
          border: "1px solid rgba(113, 113, 122, 0.45)",
          borderRadius: "14px",
          padding: "10px 14px",
          fontSize: "13px",
          fontWeight: 500,
          lineHeight: 1.15,
          boxShadow: "0 12px 32px rgba(0, 0, 0, 0.45)",
          backdropFilter: "blur(6px)",
        },
      },
    },
  },
});
