import { useEffect, useRef } from 'react';
import { useChatStore } from '@/stores/supabaseChatStore';
import { MessageList } from './MessageList';
import { InputArea } from './InputArea';
import { EmptyState } from './EmptyState';
import { ProcessingIndicator } from './ProcessingIndicator';
import { StreamingMessage } from './StreamingMessage';

export function ChatInterface(): JSX.Element {
  const { 
    currentConversation, 
    messages, 
    sendMessageStream,
    streamingMessage,
    processingStep
  } = useChatStore();
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Solo hacer scroll automático cuando se envía un nuevo mensaje
  useEffect(() => {
    // Solo scroll si el usuario está cerca del final (no está leyendo arriba)
    const chatContainer = messagesEndRef.current?.parentElement;
    if (chatContainer) {
      const isNearBottom = chatContainer.scrollHeight - chatContainer.scrollTop - chatContainer.clientHeight < 200;
      if (isNearBottom) {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }
    }
  }, [messages.length]); // Solo cuando cambia el número de mensajes

  const handleSendMessage = (content: string) => {
    sendMessageStream(content);
  };

  // Mostrar EmptyState si no hay conversación actual
  if (!currentConversation) {
    return <EmptyState />;
  }

  return (
    <div className="flex flex-col flex-1 bg-claude-beige dark:bg-claude-gray-900 relative">
      
      {/* Header simplificado */}
      <div className="border-b border-claude-gray-200 dark:border-claude-gray-700 p-4">
        <div className="max-w-4xl mx-auto">
          <h2 className="font-semibold text-claude-text dark:text-claude-gray-200">
            {currentConversation?.title || 'Nueva conversación'}
          </h2>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <MessageList messages={messages} isLoading={false} />
          
          {/* Mostrar indicador de procesamiento */}
          {processingStep && (
            <ProcessingIndicator step={processingStep} />
          )}
          
          {/* Mostrar mensaje streaming */}
          {streamingMessage && (
            <StreamingMessage content={streamingMessage} />
          )}
        </div>
        <div ref={messagesEndRef} />
      </div>
      
      <InputArea 
        onSendMessage={handleSendMessage} 
        disabled={!!processingStep}
      />
    </div>
  );
}