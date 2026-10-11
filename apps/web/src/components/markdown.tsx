import { cn } from "cn";
import ReactMarkdown from "react-markdown";

/** Review text: a safe markdown subset (no raw HTML, links open in a new tab) */
export function Markdown({ children, className }: { children: string; className?: string }) {
  return (
    <div className={cn("prose-review", className)}>
      <ReactMarkdown
        allowedElements={[
          "p",
          "em",
          "strong",
          "del",
          "a",
          "ul",
          "ol",
          "li",
          "blockquote",
          "code",
          "br",
          "h3",
          "h4",
        ]}
        unwrapDisallowed
        components={{
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noreferrer nofollow"
              className="underline underline-offset-2 hover:text-white"
            >
              {children}
            </a>
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
