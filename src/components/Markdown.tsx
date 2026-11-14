import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

// Renders model output and Markdown materials as React elements. No raw HTML
// is ever inserted into the page, so text from the model cannot inject markup.
export function Markdown({ text }: { text: string }) {
  return (
    <div className="markdown">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // Wide tables scroll inside their own box instead of widening the chat.
          table: ({ children }) => (
            <div className="overflow-x-auto">
              <table>{children}</table>
            </div>
          ),
          // Links from the model could point anywhere; show them as plain text.
          a: ({ children }) => <span className="underline">{children}</span>,
          img: () => null,
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}
