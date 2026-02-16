import { format } from 'date-fns';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Message } from '@/types';
import { useAuthStore } from '@/stores/supabaseAuthStore';
import { useWidgetChatStore } from '@/stores/widgetChatStore';
import { SuggestedFollowUps } from './SuggestedFollowUps';
import clsx from 'clsx';
import { useState } from 'react';

interface MessageBubbleProps {
  message: Message & { isTyping?: boolean };
  isLatestAssistantMessage?: boolean;
}

export function MessageBubble({ message, isLatestAssistantMessage = false }: MessageBubbleProps) {
  const isUser = message.role === 'user';
  const { user } = useAuthStore();
  const { requestSchema, schemaSending, schemaSuccess, schemaError, resetSchemaState, userEmail, suggestedFollowUps, loadingSuggestions, sendMessageStream } = useWidgetChatStore();
  const [schemaRequested, setSchemaRequested] = useState(false);

  // Obtener la primera letra del nombre del usuario
  const getUserInitial = () => {
    if (!user?.name) return 'U';
    return user.name.charAt(0).toUpperCase();
  };

  // Determinar si es un mensaje explicativo (contenido educativo, no saludos)
  const isExplanatoryMessage = () => {
    if (isUser || message.isTyping || !isLatestAssistantMessage) return false;
    const content = message.content.toLowerCase();

    // No mostrar para saludos o mensajes cortos
    const greetingPatterns = [
      'soy lexai', '¿en qué puedo ayudarte', 'hola', 'bienvenid',
      '¿cómo puedo ayudarte', 'estoy aquí para', 'un placer',
      '¿qué necesitas', '¿en qué te ayudo', 'buenos días', 'buenas tardes'
    ];
    if (greetingPatterns.some(pattern => content.includes(pattern))) return false;

    // Debe ser una respuesta sustancial (más de 400 caracteres)
    if (message.content.length < 400) return false;

    // Debe contener indicadores de explicación/contenido educativo
    const explanationIndicators = [
      'significa', 'consiste en', 'se define', 'es decir', 'por ejemplo',
      'en resumen', 'fundamentalmente', 'básicamente', 'artículo', 'ley',
      'según', 'establece que', 'regulado', 'competencia', 'función',
      'procedimiento', 'tribunal', 'jurídico', 'derecho', 'legal',
      'concepto', 'definición', 'características', 'requisitos', 'tipos de'
    ];

    return explanationIndicators.some(indicator => content.includes(indicator));
  };

  // Extraer el tema principal del mensaje para el esquema
  const extractTopic = () => {
    const content = message.content;
    // Buscar títulos en markdown (## o ###)
    const titleMatch = content.match(/^##?\s*(.+)$/m);
    if (titleMatch) return titleMatch[1].replace(/\*\*/g, '').trim();
    // Buscar texto en negrita al principio
    const boldMatch = content.match(/^\*\*(.+?)\*\*/);
    if (boldMatch) return boldMatch[1].trim();
    // Usar las primeras palabras significativas
    const firstLine = content.split('\n')[0].replace(/[#*]/g, '').trim();
    return firstLine.length > 50 ? firstLine.substring(0, 50) + '...' : firstLine;
  };

  const handleRequestSchema = async () => {
    setSchemaRequested(true);
    resetSchemaState();
    const topic = extractTopic();
    await requestSchema(topic, message.content);
  };

  return (
    <div className={clsx('flex gap-4 mb-6', isUser && 'flex-row-reverse')}>
      <div className="flex-shrink-0">
        {isUser ? (
          <div className="w-8 h-8 bg-[#64c27b] rounded-lg flex items-center justify-center shadow-sm">
            <span className="text-white font-bold text-sm">{getUserInitial()}</span>
          </div>
        ) : (
          <img src="/logobuho.png" alt="LexAI" className="w-10 h-10 object-contain" />
        )}
      </div>

      <div className={clsx('flex-1 max-w-3xl', isUser && 'flex justify-end')}>
        <div
          className={clsx(
            'rounded-2xl px-4 py-3',
            isUser
              ? 'bg-[#64c27b] text-white'
              : 'bg-white dark:bg-claude-gray-800 text-claude-text dark:text-claude-gray-200 border border-claude-gray-200 dark:border-claude-gray-700'
          )}
        >
          
          {message.isTyping ? (
            <div className="flex items-center gap-2 py-2">
              <div className="flex gap-1">
                <div className="w-2 h-2 bg-claude-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                <div className="w-2 h-2 bg-claude-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                <div className="w-2 h-2 bg-claude-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
              </div>
              <span className="text-sm text-claude-text">LexIA está escribiendo...</span>
            </div>
          ) : (
            <div className={clsx(
              'prose prose-sm max-w-none',
              isUser && 'prose-invert',
              !isUser && 'prose-gray prose-headings:text-gray-900 dark:prose-invert'
            )}>
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
              {message.content}
            </ReactMarkdown>
            </div>
          )}
          
          {!message.isTyping && (
            <div className={clsx('text-xs mt-2 opacity-70', isUser ? 'text-right' : 'text-left')}>
              {format(new Date(message.timestamp), 'HH:mm')}
            </div>
          )}

          {/* Sugerencias de follow-up */}
          {isLatestAssistantMessage && !isUser && !message.isTyping && loadingSuggestions && (
            <div className="mt-3 flex items-center gap-2 text-xs text-gray-400">
              <div className="flex gap-1">
                <div className="w-1.5 h-1.5 bg-[#64c27b] rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                <div className="w-1.5 h-1.5 bg-[#64c27b] rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                <div className="w-1.5 h-1.5 bg-[#64c27b] rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
              </div>
              <span>Generando sugerencias...</span>
            </div>
          )}
          {isLatestAssistantMessage && !isUser && !message.isTyping && !loadingSuggestions && suggestedFollowUps.length > 0 && (
            <div className="mt-3">
              <SuggestedFollowUps
                suggestions={suggestedFollowUps}
                onSelect={(text) => sendMessageStream(text)}
              />
            </div>
          )}

          {/* Botón de esquema para mensajes explicativos del asistente */}
          {isExplanatoryMessage() && userEmail && !schemaRequested && (
            <div className="mt-4">
              <button
                onClick={handleRequestSchema}
                className="w-full text-center text-sm text-white font-medium py-3 px-4 rounded-xl bg-gradient-to-r from-[#64c27b] to-[#52a068] hover:from-[#52a068] hover:to-[#478f5a] transition-all duration-200 shadow-md hover:shadow-lg flex items-center justify-center gap-2"
              >
                <span>📊</span>
                <span>¿Quieres que te mande un esquema a tu correo?</span>
              </button>
              <p className="text-xs text-gray-400 text-center mt-1">⏱️ Puede tardar ~2 minutos en generarse</p>
            </div>
          )}

          {/* Estado de envío del esquema */}
          {schemaRequested && schemaSending && (
            <div className="mt-3 text-sm text-gray-600 flex flex-col items-center gap-2 py-3 px-3 rounded-lg bg-gray-50 border border-gray-200">
              <div className="flex items-center gap-2">
                <div className="animate-spin w-4 h-4 border-2 border-[#64c27b] border-t-transparent rounded-full"></div>
                <span>Generando y enviando tu esquema...</span>
              </div>
              <p className="text-xs text-gray-400">⏱️ Esto puede tardar ~2 minutos, no cierres esta ventana</p>
            </div>
          )}

          {schemaRequested && schemaSuccess && (
            <div className="mt-3 text-sm text-green-700 flex items-center gap-2 py-2 px-3 rounded-lg bg-green-50 border border-green-200">
              <span>✅</span>
              <span>¡Esquema enviado! Revisa tu correo electrónico.</span>
            </div>
          )}

          {schemaRequested && schemaError && (
            <div className="mt-3 text-sm text-red-600 flex items-center gap-2 py-2 px-3 rounded-lg bg-red-50 border border-red-200">
              <span>❌</span>
              <span>{schemaError}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}