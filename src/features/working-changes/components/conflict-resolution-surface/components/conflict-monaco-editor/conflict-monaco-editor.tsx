import { Component, lazy, Suspense } from "react";
import type { ErrorInfo, ReactNode } from "react";
import type { EditorProps } from "@monaco-editor/react";
import { registerMonacoThemes } from "@/shared/lib/monaco";

const MonacoEditor = lazy(async () => {
  const [monaco, editorModule] = await Promise.all([
    import("monaco-editor"),
    import("@monaco-editor/react"),
  ]);

  registerMonacoThemes(monaco);
  editorModule.loader.config({ monaco });

  return { default: editorModule.default };
});

type EditorErrorBoundaryProps = {
  resetKey: string;
  fallback: ReactNode;
  children: ReactNode;
};

type EditorErrorBoundaryState = {
  hasError: boolean;
};

class EditorErrorBoundary extends Component<
  EditorErrorBoundaryProps,
  EditorErrorBoundaryState
> {
  state: EditorErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidUpdate(previousProps: EditorErrorBoundaryProps) {
    if (
      previousProps.resetKey !== this.props.resetKey &&
      this.state.hasError
    ) {
      this.setState({ hasError: false });
    }
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error("Conflict editor failed to load", error, info);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }

    return this.props.children;
  }
}

type ConflictMonacoEditorProps = Pick<
  EditorProps,
  "height" | "language" | "onChange" | "onMount" | "options" | "theme" | "value"
> & {
  ariaLabel: string;
  className?: string;
  fallbackMessage: string;
  loadingMessage?: string;
  resetKey: string;
};

export function ConflictMonacoEditor({
  ariaLabel,
  className,
  fallbackMessage,
  height,
  language,
  loadingMessage = "Loading editor",
  onChange,
  onMount,
  options,
  resetKey,
  theme,
  value,
}: ConflictMonacoEditorProps) {
  return (
    <div className={`min-w-0 ${className ?? ""}`}>
      <EditorErrorBoundary
        resetKey={resetKey}
        fallback={
          <div className="flex h-full items-center justify-center px-4 text-center text-sm text-muted-foreground">
            {fallbackMessage}
          </div>
        }
      >
        <Suspense
          fallback={
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              {loadingMessage}
            </div>
          }
        >
          <MonacoEditor
            height={height}
            language={language}
            theme={theme}
            value={value}
            onChange={onChange}
            onMount={onMount}
            options={{ ...options, ariaLabel }}
          />
        </Suspense>
      </EditorErrorBoundary>
    </div>
  );
}
