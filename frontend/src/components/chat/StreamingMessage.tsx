import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { format } from 'date-fns';

interface StreamingMessageProps {
  content: string;
}

export function StreamingMessage({ content }: StreamingMessageProps) {
  return (
    <div className="flex gap-4 mb-6">
      <div className="flex-shrink-0">
        <img src="/logobuho.png" alt="LexAI" className="w-10 h-10 object-contain" />
      </div>

      <div className="flex-1 max-w-3xl">
        <div className="rounded-2xl px-4 py-3 bg-white dark:bg-claude-gray-800 text-claude-text dark:text-claude-gray-200 border border-claude-gray-200 dark:border-claude-gray-700">
          
          
          <div className="prose prose-sm max-w-none prose-gray prose-headings:text-gray-900 dark:prose-invert">
            <ReactMarkdown 
              remarkPlugins={[remarkGfm]}
              components={{
                h2: ({node, ...props}) => <h2 className="text-xl font-bold mt-4 mb-2" {...props} />,
                h3: ({node, ...props}) => <h3 className="text-lg font-semibold mt-3 mb-2" {...props} />,
                ul: ({node, ...props}) => <ul className="list-disc pl-6 my-2" {...props} />,
                li: ({node, ...props}) => <li className="mb-1" {...props} />,
                blockquote: ({node, ...props}) => (
                  <blockquote className="border-l-4 border-[#64c27b] pl-4 my-4 italic bg-green-50 dark:bg-green-900/20 p-3 rounded" {...props} />
                ),
                strong: ({node, ...props}) => <strong className="font-semibold text-claude-text dark:text-white" {...props} />,
              }}
            >
              {content}
            </ReactMarkdown>
            
            {/* Cursor parpadeante */}
            <span className="inline-block w-2 h-4 bg-[#64c27b] ml-1 animate-pulse"></span>
          </div>
          
          <div className="text-xs mt-2 opacity-70 text-left">
            Escribiendo... {format(new Date(), 'HH:mm')}
          </div>
        </div>
      </div>
    </div>
  );
}