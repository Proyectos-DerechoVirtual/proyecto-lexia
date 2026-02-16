import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Message } from '@/types';

interface GuestChatStore {
  guestMessages: Message[];
  questionCount: number;
  hasReachedLimit: boolean;
  streamingMessage: string;
  processingStep: { message: string; step: number; total: number; estimated?: string } | null;
  
  addGuestMessage: (message: Message) => void;
  incrementQuestionCount: () => void;
  checkLimit: () => boolean;
  resetGuestData: () => void;
  sendGuestMessage: (content: string) => Promise<void>;
  sendGuestMessageStream: (content: string) => Promise<void>;
}

export const useGuestChatStore = create<GuestChatStore>()(
  persist(
    (set, get) => ({
      guestMessages: [],
      questionCount: 0,
      hasReachedLimit: false,
      streamingMessage: '',
      processingStep: null,

      addGuestMessage: (message: Message) => {
        set((state) => ({
          guestMessages: [...state.guestMessages, message]
        }));
      },

      incrementQuestionCount: () => {
        set((state) => {
          const newCount = state.questionCount + 1;
          return {
            questionCount: newCount,
            hasReachedLimit: newCount >= 2
          };
        });
      },

      checkLimit: () => {
        const state = get();
        return state.questionCount >= 2;
      },

      resetGuestData: () => {
        set({
          guestMessages: [],
          questionCount: 0,
          hasReachedLimit: false,
          streamingMessage: '',
          processingStep: null
        });
      },

      sendGuestMessage: async (content: string) => {
        const { checkLimit, incrementQuestionCount, addGuestMessage } = get();
        
        if (checkLimit()) {
          return;
        }

        // Obtener mensajes previos antes de agregar el nuevo
        const previousMessages = get().guestMessages;

        // Agregar mensaje del usuario
        const userMessage: Message = {
          id: `guest-${Date.now()}`,
          content,
          role: 'user',
          conversationId: 'guest',
          timestamp: new Date(),
        };
        addGuestMessage(userMessage);

        try {
          const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
          
          // Serializar mensajes correctamente para evitar [object Object]
          const serializedMessages = previousMessages.map(msg => ({
            id: msg.id,
            content: msg.content,
            role: msg.role,
            conversationId: msg.conversationId,
            timestamp: msg.timestamp instanceof Date ? msg.timestamp.toISOString() : msg.timestamp
          }));

          const response = await fetch(`${apiUrl}/guest-message`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ 
              content,
              messages: serializedMessages
            }),
          });

          if (!response.ok) {
            throw new Error('Error al enviar mensaje');
          }

          const data = await response.json();
          
          // Agregar respuesta del asistente
          const assistantMessage: Message = {
            id: `guest-${Date.now() + 1}`,
            content: data.response,
            role: 'assistant',
            conversationId: 'guest',
            timestamp: new Date(),
          };
          addGuestMessage(assistantMessage);
          
          // Incrementar contador de preguntas
          incrementQuestionCount();
        } catch (error) {
          console.error('Error sending guest message:', error);
        }
      },

      sendGuestMessageStream: async (content: string) => {
        const { checkLimit, incrementQuestionCount, addGuestMessage } = get();
        
        if (checkLimit()) {
          return;
        }

        // Obtener mensajes previos antes de agregar el nuevo
        const previousMessages = get().guestMessages;

        // Agregar mensaje del usuario inmediatamente
        const userMessage: Message = {
          id: `guest-${Date.now()}`,
          content,
          role: 'user',
          conversationId: 'guest',
          timestamp: new Date(),
        };
        addGuestMessage(userMessage);

        set({ streamingMessage: '', processingStep: null });

        try {
          const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
          
          // Serializar mensajes correctamente para evitar [object Object]
          const serializedMessages = previousMessages.map(msg => ({
            id: msg.id,
            content: msg.content,
            role: msg.role,
            conversationId: msg.conversationId,
            timestamp: msg.timestamp instanceof Date ? msg.timestamp.toISOString() : msg.timestamp
          }));

          const response = await fetch(`${apiUrl}/guest-message-stream`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ 
              content,
              messages: serializedMessages
            }),
          });

          if (!response.ok || !response.body) {
            throw new Error('Error al enviar mensaje');
          }

          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let fullContent = '';

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value);
            const lines = chunk.split('\n');

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const data = line.slice(6);
                if (data === '[DONE]') {
                  // Agregar mensaje completo del asistente
                  const assistantMessage: Message = {
                    id: `guest-${Date.now() + 1}`,
                    content: fullContent,
                    role: 'assistant',
                    conversationId: 'guest',
                    timestamp: new Date(),
                  };
                  addGuestMessage(assistantMessage);
                  set({ streamingMessage: '', processingStep: null });
                  
                  // Incrementar contador de preguntas
                  incrementQuestionCount();
                } else {
                  try {
                    const parsed = JSON.parse(data);
                    
                    if (parsed.type === 'progress') {
                      set({ processingStep: parsed.data });
                    } else if (parsed.type === 'content') {
                      fullContent += parsed.data;
                      set({ streamingMessage: fullContent });
                    }
                  } catch (e) {
                    console.error('Error parsing SSE data:', e);
                  }
                }
              }
            }
          }
        } catch (error) {
          console.error('Error sending guest message stream:', error);
          set({ streamingMessage: '', processingStep: null });
        }
      },
    }),
    {
      name: 'guest-chat-storage',
      partialize: (state) => ({ 
        guestMessages: state.guestMessages,
        questionCount: state.questionCount,
        hasReachedLimit: state.hasReachedLimit
      }),
    }
  )
);