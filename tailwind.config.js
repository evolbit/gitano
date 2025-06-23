/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx,css}",
    "./src-tauri/**/*.{rs}",
  ],
  safelist: [
    "bg-background",
    "bg-background-emphasis",
    "text-foreground",
    "border-border",
    "bg-primary",
    "text-primary-foreground",
    "bg-secondary",
    "text-secondary-foreground",
    "bg-muted",
    "text-muted-foreground",
    "bg-accent",
    "text-accent-foreground",
    "bg-destructive",
    "text-destructive-foreground",
    "bg-card",
    "text-card-foreground",
    "bg-popover",
    "text-popover-foreground",
    "bg-input",
    "ring-ring",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};
