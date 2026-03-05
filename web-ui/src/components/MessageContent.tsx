import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSanitize from 'rehype-sanitize';

interface MessageContentProps {
  message: string;
  extras?: Record<string, any>;
}

export default function MessageContent({ message, extras }: MessageContentProps) {
  // Check if message should be rendered as markdown
  const isMarkdown = extras?.['client::display']?.contentType === 'text/markdown';

  if (isMarkdown) {
    return (
      <div className="prose prose-sm dark:prose-invert max-w-none">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[rehypeSanitize]}
          components={{
            // Style tables to match Gotify
            table: ({ node, ...props }) => (
              <table className="min-w-full border-collapse border border-gray-300 dark:border-gray-600" {...props} />
            ),
            thead: ({ node, ...props }) => (
              <thead className="bg-gray-100 dark:bg-gray-700" {...props} />
            ),
            th: ({ node, ...props }) => (
              <th className="border border-gray-300 dark:border-gray-600 px-3 py-2 text-left font-semibold" {...props} />
            ),
            td: ({ node, ...props }) => (
              <td className="border border-gray-300 dark:border-gray-600 px-3 py-2" {...props} />
            ),
            // Style other elements
            h1: ({ node, ...props }) => (
              <h1 className="text-2xl font-bold mb-2" {...props} />
            ),
            h2: ({ node, ...props }) => (
              <h2 className="text-xl font-bold mb-2" {...props} />
            ),
            h3: ({ node, ...props }) => (
              <h3 className="text-lg font-bold mb-1" {...props} />
            ),
            p: ({ node, ...props }) => (
              <p className="mb-2" {...props} />
            ),
            ul: ({ node, ...props }) => (
              <ul className="list-disc list-inside mb-2" {...props} />
            ),
            ol: ({ node, ...props }) => (
              <ol className="list-decimal list-inside mb-2" {...props} />
            ),
            code: ({ node, inline, ...props }: any) =>
              inline ? (
                <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded text-sm" {...props} />
              ) : (
                <code className="block bg-gray-100 dark:bg-gray-700 p-2 rounded text-sm overflow-x-auto" {...props} />
              ),
            blockquote: ({ node, ...props }) => (
              <blockquote className="border-l-4 border-gray-300 dark:border-gray-600 pl-4 italic" {...props} />
            ),
            a: ({ node, ...props }) => (
              <a className="text-blue-600 dark:text-blue-400 hover:underline" target="_blank" rel="noopener noreferrer" {...props} />
            ),
            strong: ({ node, ...props }) => (
              <strong className="font-bold" {...props} />
            ),
            em: ({ node, ...props }) => (
              <em className="italic" {...props} />
            ),
          }}
        >
          {message}
        </ReactMarkdown>
      </div>
    );
  }

  // Fallback to plain text with preserved whitespace
  return (
    <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
      {message}
    </p>
  );
}
