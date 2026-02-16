import { useState, useRef, useEffect, FormEvent } from 'react';
import { PaperAirplaneIcon } from '@heroicons/react/24/solid';

interface InputAreaProps {
  onSendMessage: (message: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function InputArea({ onSendMessage, disabled, placeholder }: InputAreaProps) {
  const [message, setMessage] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [message]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (message.trim() && !disabled) {
      onSendMessage(message.trim());
      setMessage('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div className="border-t border-claude-gray-200 dark:border-claude-gray-700 bg-claude-beige dark:bg-claude-gray-800">
      <div className="max-w-4xl mx-auto">
        <form onSubmit={handleSubmit} className="px-4 py-4">
          <div className="max-w-3xl mx-auto">
            <div className="relative">
              <textarea
                ref={textareaRef}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={placeholder || "Pregúntame sobre legislación, artículos legales, oposiciones de justicia..."}
                disabled={disabled}
                rows={1}
                className="w-full bg-white dark:bg-claude-gray-700 border border-claude-gray-300 dark:border-claude-gray-600 rounded-2xl px-5 py-4 pr-16 outline-none resize-none max-h-32 text-claude-text dark:text-claude-gray-200 placeholder-claude-gray-400 dark:placeholder-claude-gray-500 focus:border-claude-orange focus:ring-2 focus:ring-claude-orange/20 transition-all scrollbar-hide overflow-y-auto"
                style={{ 
                  scrollbarWidth: 'none', 
                  msOverflowStyle: 'none',
                  minHeight: '56px' // Altura fija para el botón
                }}
              />
              
              <button
                type="submit"
                disabled={!message.trim() || disabled}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-2.5 bg-[#64c27b] text-white rounded-xl hover:bg-[#52a068] disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200 shadow-sm flex items-center justify-center"
              >
                <PaperAirplaneIcon className="w-4 h-4" />
              </button>
            </div>
            
          </div>
        </form>
      </div>
    </div>
  );
}