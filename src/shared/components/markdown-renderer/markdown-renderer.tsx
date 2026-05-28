import ReactMarkdown from "react-markdown";
import rehypeSanitize from "rehype-sanitize";
import remarkGfm from "remark-gfm";

const GITHUB_EMOJI_SHORTCODES: Record<string, string> = {
  computer: "💻",
  heavy_check_mark: "✔",
  information_source: "ℹ",
  memo: "📝",
  package: "📦",
  warning: "⚠",
  white_check_mark: "✅",
  x: "❌",
  zap: "⚡",
};

function normalizeGitHubMarkdown(markdown: string) {
  return markdown.replace(/:([a-z0-9_+-]+):/g, (match, shortcode) => {
    return GITHUB_EMOJI_SHORTCODES[shortcode] ?? match;
  });
}

export function MarkdownRenderer({ markdown }: { markdown: string }) {
  if (!markdown.trim()) {
    return (
      <div className="text-sm text-muted-foreground">
        Nothing to preview
      </div>
    );
  }

  return (
    <div className="space-y-3 text-sm leading-6 text-foreground [overflow-wrap:anywhere]">
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
          h1: ({ children }) => (
            <h1 className="text-xl font-semibold leading-7 text-foreground">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-lg font-semibold leading-7 text-foreground">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-base font-semibold leading-6 text-foreground">
              {children}
            </h3>
          ),
          hr: () => <hr className="border-border" />,
          img: ({ ...props }) => (
            <img
              {...props}
              className="my-2 inline-block max-h-56 max-w-full rounded border border-border object-contain"
              loading="lazy"
            />
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
          table: ({ children }) => (
            <div className="my-3 overflow-x-auto rounded border border-border">
              <table className="min-w-full border-collapse text-left text-xs">
                {children}
              </table>
            </div>
          ),
          tbody: ({ children }) => <tbody>{children}</tbody>,
          td: ({ children }) => (
            <td className="border-t border-border px-3 py-2 align-top">
              {children}
            </td>
          ),
          th: ({ children }) => (
            <th className="border-b border-border bg-background-emphasis px-3 py-2 align-top font-semibold text-zinc-200">
              {children}
            </th>
          ),
          thead: ({ children }) => <thead>{children}</thead>,
          tr: ({ children }) => (
            <tr className="border-border even:bg-background-emphasis/35">
              {children}
            </tr>
          ),
          ul: ({ children }) => (
            <ul className="list-disc space-y-1 pl-5">{children}</ul>
          ),
        }}
      >
        {normalizeGitHubMarkdown(markdown)}
      </ReactMarkdown>
    </div>
  );
}
