export function TagsPanelProgressBar() {
  return (
    <div
      className="pointer-events-none absolute left-0 right-0 top-0 z-30 h-0.5 overflow-hidden bg-blue-500/10"
      role="progressbar"
      aria-label="Refreshing tags"
    >
      <div
        className="h-full w-1/3 rounded-r bg-blue-400/90"
        style={{ animation: "panel-progress 1.1s ease-in-out infinite" }}
      />
    </div>
  );
}
