import { useState, useRef, useEffect, FormEvent } from 'react';
import { BookOpenIcon, AcademicCapIcon, ExclamationTriangleIcon, ChatBubbleLeftRightIcon } from '@heroicons/react/24/outline';
import { PaperAirplaneIcon } from '@heroicons/react/24/solid';
import { useChatStore } from '@/stores/supabaseChatStore';

const suggestions = [
  {
    icon: BookOpenIcon,
    title: 'Legislación',
    category: 'legislacion' as const,
    example: '¿Qué establece la Ley Orgánica 3/2007 para la igualdad efectiva de mujeres y hombres?',
  },
  {
    icon: AcademicCapIcon,
    title: 'Temario de Clases',
    category: 'clases' as const,
    example: '¿Cuáles son los principios fundamentales de la Constitución Española?',
  },
  {
    icon: ExclamationTriangleIcon,
    title: 'Preguntas Trampa',
    category: 'preguntas_trampa' as const,
    example: '¿Cuál es la diferencia entre dolo directo y dolo eventual?',
  },
  {
    icon: ChatBubbleLeftRightIcon,
    title: 'Consulta General',
    category: 'otro' as const,
    example: '¿Cómo debo estudiar para las oposiciones de justicia?',
  },
];

export function EmptyState() {
  const { createConversation, sendMessageStream } = useChatStore();
  const [message, setMessage] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [message]);

  const handleSuggestionClick = async (suggestion: typeof suggestions[0]) => {
    try {
      await createConversation(suggestion.title, suggestion.category);
      // Pequeña pausa para asegurar que la conversación se creó
      await new Promise(resolve => setTimeout(resolve, 100));
      // Enviar automáticamente la pregunta de ejemplo
      await sendMessageStream(suggestion.example);
    } catch (error) {
      console.error('Error creating conversation:', error);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (message.trim()) {
      try {
        // Crear una conversación general si es necesario
        await createConversation('Consulta General', 'otro');
        // Pequeña pausa para asegurar que la conversación se creó
        await new Promise(resolve => setTimeout(resolve, 100));
        // Enviar el mensaje
        await sendMessageStream(message.trim());
        setMessage('');
      } catch (error) {
        console.error('Error sending message:', error);
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e as any);
    }
  };
  return (
    <div className="flex-1 flex items-center justify-center p-8 bg-claude-beige dark:bg-claude-gray-900">
      <div className="max-w-3xl w-full">
        <div className="text-center mb-8">
          {/* Logo de LexIA */}
          <div className="flex items-center justify-center gap-3 mb-6">
            <img src="/logobuho.png" alt="LexAI" className="w-16 h-16 object-contain" />
            <h1 className="text-2xl font-bold text-claude-text dark:text-white">
              LexAI
            </h1>
          </div>
          
          <h2 className="text-xl font-semibold text-claude-gray-600 dark:text-claude-gray-400 mb-2">
            ¡Bienvenido a LexAI!
          </h2>
          <p className="text-base text-claude-gray-500 dark:text-claude-gray-400">
            ¡La primera IA para Opositores de Justicia!
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {suggestions.map((suggestion, index) => (
            <div
              key={index}
              onClick={() => handleSuggestionClick(suggestion)}
              className="group p-4 bg-white dark:bg-claude-gray-800 rounded-lg hover:bg-claude-gray-100 dark:hover:bg-claude-gray-700 transition-all cursor-pointer border border-claude-gray-200 dark:border-claude-gray-700 hover:shadow-md"
            >
              <div className="flex items-start gap-3">
                <div className="relative">
                  <suggestion.icon className={`w-6 h-6 text-claude-orange flex-shrink-0 mt-0.5 transition-transform
                    ${index === 0 ? 'group-hover:animate-pulse-scale' : ''}
                    ${index === 1 ? 'group-hover:animate-float' : ''}
                    ${index === 2 ? 'group-hover:animate-shake' : ''}
                    ${index === 3 ? 'group-hover:animate-balance' : ''}
                  `} />
                </div>
                <div>
                  <h3 className="font-semibold text-claude-text dark:text-white mb-1">
                    {suggestion.title}
                  </h3>
                  <p className="text-sm text-claude-gray-600 dark:text-claude-gray-400">
                    {suggestion.example}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Campo de entrada de chat */}
        <div className="mt-8">
          <form onSubmit={handleSubmit} className="max-w-2xl mx-auto">
            <div className="relative">
              <textarea
                ref={textareaRef}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="O escribe tu pregunta aquí..."
                rows={1}
                className="w-full bg-white dark:bg-claude-gray-800 border border-claude-gray-300 dark:border-claude-gray-600 rounded-2xl px-5 py-4 pr-16 outline-none resize-none max-h-32 text-claude-text dark:text-claude-gray-200 placeholder-claude-gray-400 dark:placeholder-claude-gray-500 focus:border-claude-orange focus:ring-2 focus:ring-claude-orange/20 transition-all scrollbar-hide overflow-y-auto shadow-sm"
                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
              />
              
              <button
                type="submit"
                disabled={!message.trim()}
                className="absolute right-3 bottom-4 p-2.5 bg-claude-orange text-white rounded-xl hover:bg-claude-darkOrange disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200 shadow-sm flex items-center justify-center"
              >
                <PaperAirplaneIcon className="w-4 h-4" />
              </button>
            </div>
            
            <p className="text-xs text-claude-gray-400 dark:text-claude-gray-500 mt-3 text-center">
              Presiona Enter para enviar • Shift+Enter para nueva línea
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}