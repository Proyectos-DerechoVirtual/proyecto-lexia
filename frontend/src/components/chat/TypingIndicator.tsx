export function TypingIndicator() {
  return (
    <div className="flex gap-4 mb-6">
      <div className="flex-shrink-0">
        <div className="w-8 h-8 bg-gradient-to-br from-legal-gold to-legal-bronze rounded-lg flex items-center justify-center shadow-sm">
          <span className="text-white font-bold text-sm">⚖</span>
        </div>
      </div>
      
      <div className="bg-white dark:bg-claude-gray-800 text-claude-gray-700 dark:text-claude-gray-200 border border-claude-gray-200 dark:border-claude-gray-700 rounded-2xl px-4 py-3">
        <div className="flex items-center gap-2 py-2">
          <div className="flex gap-1">
            <div className="w-2 h-2 bg-claude-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
            <div className="w-2 h-2 bg-claude-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
            <div className="w-2 h-2 bg-claude-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
          </div>
          <span className="text-sm text-claude-gray-500">LexIA está escribiendo...</span>
        </div>
      </div>
    </div>
  );
}