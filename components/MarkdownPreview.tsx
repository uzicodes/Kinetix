'use client';

import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface MarkdownPreviewProps {
  content: string;
}

export const MarkdownPreview = React.memo(function MarkdownPreview({ content }: MarkdownPreviewProps) {
  if (!content.trim()) {
    return (
      <div className="flex items-center justify-center h-full text-zinc-600 text-sm italic">
        Empty document. Start typing markdown to see preview...
      </div>
    );
  }

  return (
    <div className="w-full text-zinc-200 text-sm leading-relaxed space-y-4">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h1 className="text-2xl font-bold text-zinc-100 border-b border-zinc-800 pb-2 mt-6 mb-3 first:mt-0">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-xl font-semibold text-zinc-100 border-b border-zinc-800/60 pb-1.5 mt-5 mb-2.5">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-lg font-medium text-zinc-200 mt-4 mb-2">
              {children}
            </h3>
          ),
          h4: ({ children }) => (
            <h4 className="text-base font-medium text-zinc-200 mt-3 mb-1">
              {children}
            </h4>
          ),
          p: ({ children }) => (
            <p className="text-zinc-300 leading-relaxed my-2">{children}</p>
          ),
          ul: ({ children }) => (
            <ul className="list-disc list-inside space-y-1 my-2 text-zinc-300 pl-2">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal list-inside space-y-1 my-2 text-zinc-300 pl-2">
              {children}
            </ol>
          ),
          li: ({ children }) => <li className="text-zinc-300">{children}</li>,
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-emerald-500/60 pl-4 py-1 italic bg-zinc-900/50 rounded-r text-zinc-400 my-3">
              {children}
            </blockquote>
          ),
          code: ({ className, children, ...props }) => {
            const isInline = !className;
            return isInline ? (
              <code
                className="px-1.5 py-0.5 rounded bg-zinc-800 text-emerald-400 font-mono text-xs border border-zinc-700/50"
                {...props}
              >
                {children}
              </code>
            ) : (
              <code
                className="block p-4 rounded-xl bg-zinc-900/90 border border-zinc-800 text-zinc-200 font-mono text-xs overflow-x-auto my-3 leading-relaxed"
                {...props}
              >
                {children}
              </code>
            );
          },
          pre: ({ children }) => <pre className="my-2">{children}</pre>,
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-emerald-400 hover:text-emerald-300 underline underline-offset-4 transition-colors"
            >
              {children}
            </a>
          ),
          table: ({ children }) => (
            <div className="overflow-x-auto my-4 border border-zinc-800 rounded-lg">
              <table className="min-w-full divide-y divide-zinc-800 text-left text-xs">
                {children}
              </table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-zinc-900/80 text-zinc-300 font-medium">{children}</thead>
          ),
          tbody: ({ children }) => (
            <tbody className="divide-y divide-zinc-800/60 text-zinc-400">{children}</tbody>
          ),
          tr: ({ children }) => <tr>{children}</tr>,
          th: ({ children }) => <th className="px-3 py-2 font-semibold">{children}</th>,
          td: ({ children }) => <td className="px-3 py-2">{children}</td>,
          hr: () => <hr className="my-6 border-zinc-800" />,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
});

