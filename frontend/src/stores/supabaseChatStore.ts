import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import { DbMessage } from '@/lib/supabase';
import { Conversation, Message } from '@/types';

interface ChatStore {
  conversations: Conversation[];
  currentConversation: Conversation | null;
  messages: Message[];
  isLoading: boolean;
  error: string | null;
  streamingMessage: string;
  processingStep: { message: string; step: number; total: number; estimated?: string } | null;
  
  loadConversations: () => Promise<void>;
  createConversation: (title?: string, category?: string) => Promise<void>;
  selectConversation: (conversationId: string) => Promise<void>;
  deleteConversation: (conversationId: string) => Promise<void>;
  sendMessage: (content: string) => Promise<void>;
  sendMessageStream: (content: string) => Promise<void>;
  updateConversationTitle: (conversationId: string, title: string) => Promise<void>;
  clearError: () => void;
  subscribeToMessages: () => () => void;
}

export const useChatStore = create<ChatStore>((set, get) => ({
  conversations: [],
  currentConversation: null,
  messages: [],
  isLoading: false,
  error: null,
  streamingMessage: '',
  processingStep: null,

  loadConversations: async () => {
    set({ isLoading: true, error: null });
    try {
      // Obtener token de sesión
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session?.access_token) {
        console.error('Session error:', sessionError);
        throw new Error('No hay sesión activa');
      }

      // Usar la API del backend para cargar conversaciones
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const response = await fetch(`${apiUrl}/conversations`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.text();
        console.error('API error loading conversations:', errorData);
        throw new Error('Error al cargar conversaciones');
      }

      const { data } = await response.json();
      console.log('Conversations loaded via API:', data);

      const conversations: Conversation[] = data.map((conv: any) => ({
        id: conv.id,
        title: conv.title,
        category: conv.category,
        userId: conv.user_id,
        createdAt: new Date(conv.created_at),
        updatedAt: new Date(conv.updated_at),
      }));

      set({ conversations, isLoading: false });
    } catch (error: any) {
      console.error('Error loading conversations:', error);
      set({ error: error.message || 'Error al cargar conversaciones', isLoading: false });
    }
  },

  createConversation: async (title?: string, category?: string) => {
    set({ isLoading: true, error: null });
    try {
      console.log('Creating conversation with:', { title, category });
      
      // Obtener token de sesión
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session?.access_token) {
        console.error('Session error:', sessionError);
        throw new Error('No hay sesión activa');
      }

      console.log('User authenticated, creating via API');

      // Usar la API del backend para crear la conversación
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const response = await fetch(`${apiUrl}/conversations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          title: title || 'Nueva consulta legal',
          category: category || 'otro',
        }),
      });

      if (!response.ok) {
        const errorData = await response.text();
        console.error('API error creating conversation:', errorData);
        throw new Error('Error al crear conversación');
      }

      const { data } = await response.json();
      console.log('Conversation created via API:', data);

      const conversation: Conversation = {
        id: data.id,
        title: data.title,
        category: data.category,
        userId: data.user_id,
        createdAt: new Date(data.created_at),
        updatedAt: new Date(data.updated_at),
      };

      set((state) => ({
        conversations: [conversation, ...state.conversations],
        currentConversation: conversation,
        messages: [],
        isLoading: false,
      }));

      console.log('Conversation state updated successfully');
    } catch (error: any) {
      console.error('Error creating conversation:', error);
      set({ error: error.message || 'Error al crear conversación', isLoading: false });
    }
  },

  selectConversation: async (conversationId: string) => {
    set({ isLoading: true, error: null });
    try {
      // Obtener token de sesión
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session?.access_token) {
        console.error('Session error:', sessionError);
        throw new Error('No hay sesión activa');
      }

      // Usar la API del backend para cargar la conversación
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const response = await fetch(`${apiUrl}/conversations/${conversationId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.text();
        console.error('API error loading conversation:', errorData);
        throw new Error('Error al cargar conversación');
      }

      const { data } = await response.json();
      console.log('Conversation loaded via API:', data);

      const conversation: Conversation = {
        id: data.conversation.id,
        title: data.conversation.title,
        category: data.conversation.category,
        userId: data.conversation.user_id,
        createdAt: new Date(data.conversation.created_at),
        updatedAt: new Date(data.conversation.updated_at),
      };

      const messages: Message[] = data.messages.map((msg: any) => ({
        id: msg.id,
        conversationId: msg.conversation_id,
        content: msg.content,
        role: msg.role,
        timestamp: new Date(msg.created_at),
        metadata: msg.metadata,
      }));

      set({
        currentConversation: conversation,
        messages,
        isLoading: false,
      });
    } catch (error: any) {
      console.error('Error loading conversation:', error);
      set({ error: error.message || 'Error al cargar conversación', isLoading: false });
    }
  },

  deleteConversation: async (conversationId: string) => {
    set({ isLoading: true, error: null });
    try {
      const { error } = await supabase
        .from('conversations')
        .delete()
        .eq('id', conversationId);

      if (error) throw error;

      set((state) => ({
        conversations: state.conversations.filter((c) => c.id !== conversationId),
        currentConversation:
          state.currentConversation?.id === conversationId ? null : state.currentConversation,
        messages: state.currentConversation?.id === conversationId ? [] : state.messages,
        isLoading: false,
      }));
    } catch (error: any) {
      set({ error: error.message || 'Error al eliminar conversación', isLoading: false });
    }
  },

  sendMessage: async (content: string) => {
    const { currentConversation } = get();
    if (!currentConversation) return;

    // Mostrar el mensaje del usuario inmediatamente
    const tempUserMessage = {
      id: `temp-${Date.now()}`,
      conversationId: currentConversation.id,
      content,
      role: 'user' as const,
      timestamp: new Date(),
    };

    // En modo no-streaming, solo usar isLoading para el indicador
    // No agregar mensaje temporal del asistente para evitar duplicar indicadores
    set((state) => ({
      messages: [...state.messages, tempUserMessage],
      isLoading: true,
      error: null,
    }));
    
    try {
      // Obtener token de sesión
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session?.access_token) {
        console.error('Session error:', sessionError);
        throw new Error('No hay sesión activa');
      }
      
      console.log('Token obtained, length:', session.access_token.length);
      console.log('Current conversation:', currentConversation.id);
      console.log('Message content:', content);
      
      // Llamar a la API del backend que creará ambos mensajes y generará la respuesta
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const fullUrl = `${apiUrl}/messages`;
      console.log('Making API call to:', fullUrl);
      
      const requestBody = {
        conversationId: currentConversation.id,
        content: content,
      };
      console.log('Request body:', requestBody);
      
      // Crear controller para timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 segundos timeout
      
      const response = await fetch(fullUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);

      console.log('API response status:', response.status);

      if (!response.ok) {
        const errorData = await response.text();
        console.error('API error response:', errorData);
        throw new Error(`Error al generar respuesta: ${response.status} - ${errorData}`);
      }

      const responseJson = await response.json();
      console.log('API response JSON:', responseJson);
      
      if (!responseJson.data) {
        console.error('Invalid response format:', responseJson);
        throw new Error('Respuesta inválida del servidor');
      }
      
      const { data } = responseJson;

      // Reemplazar el mensaje temporal con el real y añadir respuesta del asistente
      set((state) => ({
        messages: [
          // Filtrar el mensaje temporal
          ...state.messages.filter(msg => !msg.id.startsWith('temp-')),
          // Añadir el mensaje real del usuario
          {
            id: data.userMessage.id,
            conversationId: data.userMessage.conversation_id,
            content: data.userMessage.content,
            role: data.userMessage.role,
            timestamp: new Date(data.userMessage.created_at),
          },
          // Añadir respuesta del asistente
          {
            id: data.assistantMessage.id,
            conversationId: data.assistantMessage.conversation_id,
            content: data.assistantMessage.content,
            role: data.assistantMessage.role,
            timestamp: new Date(data.assistantMessage.created_at),
            metadata: data.assistantMessage.metadata,
          }
        ],
        isLoading: false,
      }));

      // Actualizar la conversación
      set((state) => ({
        conversations: state.conversations.map((c) =>
          c.id === currentConversation.id
            ? { ...c, updatedAt: new Date() }
            : c
        ),
      }));
    } catch (error: any) {
      console.error('SendMessage error:', error);
      console.error('Error stack:', error.stack);
      
      let errorMessage = 'Error al enviar mensaje';
      if (error.name === 'AbortError') {
        errorMessage = 'La respuesta tardó demasiado. Intenta de nuevo.';
      } else if (error.message === 'Failed to fetch') {
        errorMessage = 'Error de conexión. Verifica tu conexión a internet.';
      } else {
        errorMessage = error.message || 'Error al enviar mensaje';
      }
      
      // Remover mensaje temporal en caso de error
      set((state) => ({
        messages: state.messages.filter(msg => !msg.id.startsWith('temp-')),
        error: errorMessage,
        isLoading: false,
      }));
    }
  },

  subscribeToMessages: () => {
    const { currentConversation } = get();
    if (!currentConversation) return () => {};

    const subscription = supabase
      .channel(`messages:${currentConversation.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${currentConversation.id}`,
        },
        (payload) => {
          const newMessage = payload.new as DbMessage;
          set((state) => ({
            messages: [...state.messages, {
              id: newMessage.id,
              conversationId: newMessage.conversation_id,
              content: newMessage.content,
              role: newMessage.role,
              timestamp: new Date(newMessage.created_at),
              metadata: newMessage.metadata,
            }],
          }));
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  },

  updateConversationTitle: async (conversationId: string, title: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('No hay sesión activa');
      }

      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const response = await fetch(`${apiUrl}/conversations/${conversationId}/title`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ title }),
      });

      if (!response.ok) {
        throw new Error('Error al actualizar título');
      }

      // Actualizar el título localmente
      set((state) => ({
        conversations: state.conversations.map((c) =>
          c.id === conversationId ? { ...c, title } : c
        ),
        currentConversation: state.currentConversation?.id === conversationId
          ? { ...state.currentConversation, title }
          : state.currentConversation
      }));
    } catch (error: any) {
      console.error('Error updating conversation title:', error);
    }
  },

  clearError: () => set({ error: null }),

  sendMessageStream: async (content: string) => {
    const { currentConversation } = get();
    if (!currentConversation) return;

    // Mostrar mensaje del usuario inmediatamente
    const tempUserMessage = {
      id: `temp-${Date.now()}`,
      conversationId: currentConversation.id,
      content,
      role: 'user' as const,
      timestamp: new Date(),
    };

    set((state) => ({
      messages: [...state.messages, tempUserMessage],
      isLoading: true,
      error: null,
      streamingMessage: '',
      processingStep: { message: 'Iniciando...', step: 0, total: 6 }
    }));

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('No hay sesión activa');
      }

      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      
      // Usar fetch con streaming en lugar de EventSource
      const response = await fetch(`${apiUrl}/messages-stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          conversationId: currentConversation.id,
          content: content,
        }),
      });

      if (!response.body) {
        throw new Error('No response body');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              
              switch (data.type) {
                case 'status':
                  set({ processingStep: data.data });
                  break;
                  
                case 'user_message':
                  set((state) => ({
                    messages: [
                      ...state.messages.filter(msg => !msg.id.startsWith('temp-')),
                      {
                        id: data.data.id,
                        conversationId: data.data.conversation_id,
                        content: data.data.content,
                        role: data.data.role,
                        timestamp: new Date(data.data.created_at),
                      }
                    ]
                  }));
                  break;
                  
                case 'content':
                  set({ streamingMessage: data.data.fullContent });
                  break;
                  
                case 'complete':
                  set((state) => ({
                    messages: [...state.messages, {
                      id: data.data.assistantMessage.id,
                      conversationId: data.data.assistantMessage.conversation_id,
                      content: data.data.assistantMessage.content,
                      role: data.data.assistantMessage.role,
                      timestamp: new Date(data.data.assistantMessage.created_at),
                    }],
                    isLoading: false,
                    streamingMessage: '',
                    processingStep: null
                  }));
                  return; // Salir del bucle
                  
                case 'title_updated':
                  // TODO: Fix type issues
                  // set((state) => {
                  //   const updatedConversations = state.conversations.map((c) =>
                  //     c.id === data.data.conversationId ? { ...c, title: data.data.title } : c
                  //   );
                  //   const updatedCurrentConversation = state.currentConversation?.id === data.data.conversationId
                  //     ? { ...state.currentConversation, title: data.data.title }
                  //     : state.currentConversation;
                  //   
                  //   return {
                  //     conversations: updatedConversations,
                  //     currentConversation: updatedCurrentConversation
                  //   };
                  // });
                  break;
                  
                case 'error':
                  set({
                    error: data.data.message,
                    isLoading: false,
                    processingStep: null,
                    streamingMessage: ''
                  });
                  return; // Salir del bucle
              }
            } catch (e) {
              // Ignorar líneas malformadas
            }
          }
        }
      }

    } catch (error: any) {
      console.error('Stream error:', error);
      set({
        error: error.message || 'Error al enviar mensaje',
        isLoading: false,
        processingStep: null,
        streamingMessage: ''
      });
    }
  },
}));