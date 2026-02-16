import { Message } from '@/types';
import { MessageBubble } from './MessageBubble';
import { TypingIndicator } from './TypingIndicator';
import { ScaleIcon } from '../icons/ScaleIcon';

interface MessageListProps {
  messages: Message[];
  isLoading: boolean;
}

export function MessageList({ messages, isLoading }: MessageListProps) {
  return (
    <div className="py-8">
      {messages.length === 0 && (
        <div className="text-center mt-8">
          {/* Logo de LexIA */}
          <div className="flex items-center justify-center gap-3 mb-6">
            <div className="w-14 h-14 bg-claude-orange rounded-xl flex items-center justify-center shadow-lg hover:shadow-xl transition-all duration-300 group">
              <ScaleIcon className="text-white group-hover:animate-balance" size={28} />
            </div>
            <h1 className="text-2xl font-bold text-claude-text dark:text-white">
              LexIA
            </h1>
          </div>
          
          <p className="text-lg font-medium text-claude-gray-600 dark:text-claude-gray-400 mb-2">¡Bienvenido a LexIA!</p>
          <p className="text-sm text-claude-gray-500 dark:text-claude-gray-400">
            Tu asistente legal inteligente. Haz tu primera pregunta para comenzar.
          </p>
        </div>
      )}
      
      {messages.map((message) => (
        <MessageBubble key={message.id} message={message} />
      ))}
      
      {isLoading && <TypingIndicator />}
    </div>
  );
}