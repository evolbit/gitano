export function TagsPanelState({ message }: { message: string }) {
  return (
    <div className="flex min-h-0 flex-1 items-center justify-center px-4 text-center text-sm text-muted-foreground">
      {message}
    </div>
  );
}
