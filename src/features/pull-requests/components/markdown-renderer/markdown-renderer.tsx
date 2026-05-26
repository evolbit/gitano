import ReactMarkdown from "react-markdown";
import rehypeSanitize from "rehype-sanitize";
import remarkGfm from "remark-gfm";

export function MarkdownRenderer({ markdown }: { markdown: string }) {
  if (!markdown.trim()) {
    return (
      <div className="text-sm text-muted-foreground">
        Nothing to preview
      </div>
    );
  }

  return (
    <div className="space-y-2 text-sm leading-6 text-foreground">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeSanitize]}
        components={{
          a: ({ children, ...props }) => (
            <a
              {...props}
              className="text-blue-300 underline underline-offset-2"
              target="_blank"
              rel="noreferrer"
            >
              {children}
            </a>
          ),
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-border pl-3 text-muted-foreground">
              {children}
            </blockquote>
          ),
          code: ({ children }) => (
            <code className="rounded border border-border bg-background-emphasis px-1 py-0.5 font-mono text-[0.92em]">
              {children}
            </code>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal space-y-1 pl-5">{children}</ol>
          ),
          p: ({ children }) => <p>{children}</p>,
          pre: ({ children }) => (
            <pre className="overflow-x-auto rounded border border-border bg-background-emphasis p-3 font-mono text-xs">
              {children}
            </pre>
          ),
          ul: ({ children }) => (
            <ul className="list-disc space-y-1 pl-5">{children}</ul>
          ),
        }}
      >
        {markdown}
      </ReactMarkdown>
    </div>
  );
}
