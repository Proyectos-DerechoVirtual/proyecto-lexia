import { useEffect, useRef } from 'react';
import { useWidgetChatStore } from '@/stores/widgetChatStore';
import { InputArea } from './InputArea';
import { ProcessingIndicator } from './ProcessingIndicator';
import { StreamingMessage } from './StreamingMessage';
import { MessageBubble } from './MessageBubble';

export function WidgetChatInterface() {
  const {
    messages,
    sendMessageStream,
    streamingMessage,
    processingStep,
    isLoading,
    initializeWidget,
    showPendingProactiveMessages
  } = useWidgetChatStore();
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // Función para hacer scroll al final
  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  };

  useEffect(() => {
    // Solo hacer auto-scroll si el usuario está cerca del final del chat
    if (chatContainerRef.current) {
      const container = chatContainerRef.current;
      const isNearBottom = container.scrollTop + container.clientHeight >= container.scrollHeight - 100;

      if (isNearBottom) {
        scrollToBottom();
      }
    }
  }, [messages, streamingMessage]);

  // Inicializar widget al montar
  useEffect(() => {
    if (messages.length === 0) {
      initializeWidget();
    }

    // Hacer scroll al final cuando el componente se monta
    setTimeout(() => {
      scrollToBottom('instant');
    }, 100);
  }, []);

  // Cuando el usuario abre el chat manualmente (clic en el widget)
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === 'LEXAI_CHAT_OPENED') {
        // Mostrar los mensajes proactivos pendientes (datos curiosos, tests, lecciones)
        // que aparecieron en la nubecita mientras el chat estaba cerrado
        showPendingProactiveMessages();

        // Hacer scroll al final
        setTimeout(() => {
          scrollToBottom('smooth');
        }, 150);
      }
    };

    window.addEventListener('message', handleMessage);

    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, [showPendingProactiveMessages]);

  const handleSendMessage = async (content: string) => {
    await sendMessageStream(content);
  };

  return (
    <div className="flex flex-col h-full bg-claude-beige dark:bg-claude-gray-900">
      <div ref={chatContainerRef} className="flex-1 overflow-y-auto px-4 py-8">
        
        {messages.map((message, index) => {
          // Determinar si este es el último mensaje del asistente
          const isLatestAssistant =
            message.role === 'assistant' &&
            !messages.slice(index + 1).some(m => m.role === 'assistant');

          return (
            <MessageBubble
              key={message.id}
              message={{
                ...message,
                conversationId: 'widget'
              }}
              isLatestAssistantMessage={isLatestAssistant}
            />
          );
        })}
        
        {processingStep && !streamingMessage && (
          <ProcessingIndicator step={processingStep} />
        )}
        
        {streamingMessage && (
          <StreamingMessage content={streamingMessage} />
        )}
        
        <div ref={messagesEndRef} />
      </div>
      
      <div className="sticky bottom-0">
        <InputArea 
          onSendMessage={handleSendMessage} 
          disabled={isLoading}
          placeholder="Haz tu primera pregunta"
        />
      </div>
    </div>
  );
}