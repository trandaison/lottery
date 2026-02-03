import ReactMarkdown from 'react-markdown';

interface CampaignDescriptionProps {
  description: string | null;
}

/**
 * CampaignDescription Component
 *
 * Renders campaign description as markdown with:
 * - Safe HTML rendering
 * - Styled markdown elements
 *
 * Architecture:
 * - Single responsibility: Render markdown content
 * - Uses react-markdown for safe rendering
 * - Custom styles for markdown elements
 */
export function CampaignDescription({ description }: CampaignDescriptionProps) {
  if (!description) {
    return null;
  }

  return (
    <div className="bg-white rounded-lg border shadow-sm p-6">
      <div className="whitespace-pre-line prose prose-gray max-w-none">
        <ReactMarkdown
          components={{
            h1: ({ children }) => (
              <h1 className="text-2xl font-bold mb-4 text-gray-900">{children}</h1>
            ),
            h2: ({ children }) => (
              <h2 className="text-xl font-bold mb-3 text-gray-900">{children}</h2>
            ),
            h3: ({ children }) => (
              <h3 className="text-lg font-semibold mb-2 text-gray-900">{children}</h3>
            ),
            p: ({ children }) => (
              <p className="mb-4 text-gray-700 leading-relaxed">{children}</p>
            ),
            ul: ({ children }) => (
              <ul className="list-disc list-inside mb-4 space-y-2 text-gray-700">
                {children}
              </ul>
            ),
            ol: ({ children }) => (
              <ol className="list-decimal list-inside mb-4 space-y-2 text-gray-700">
                {children}
              </ol>
            ),
            li: ({ children }) => (
              <li className="ml-4">{children}</li>
            ),
            a: ({ href, children }) => (
              <a
                href={href}
                className="text-blue-600 hover:text-blue-800 underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                {children}
              </a>
            ),
            strong: ({ children }) => (
              <strong className="font-semibold text-gray-900">{children}</strong>
            ),
            em: ({ children }) => (
              <em className="italic">{children}</em>
            ),
            blockquote: ({ children }) => (
              <blockquote className="border-l-4 border-gray-300 pl-4 py-2 mb-4 italic text-gray-600">
                {children}
              </blockquote>
            ),
            code: ({ children }) => (
              <code className="bg-gray-100 px-2 py-1 rounded text-sm font-mono text-gray-800">
                {children}
              </code>
            ),
          }}
        >
          {description}
        </ReactMarkdown>
      </div>
    </div>
  );
}
