export interface User {
  id: string;
  name: string;
  email: string;
}

export interface Message {
  id: string;
  conversationId: string;
  content: string;
  role: 'user' | 'assistant' | 'system';
  timestamp: Date;
  metadata?: {
    tokens?: number;
    model?: string;
    processingTime?: number;
  };
}

export interface Conversation {
  id: string;
  title: string;
  userId?: string;
  createdAt: Date;
  updatedAt: Date;
  messages?: Message[];
  category?: 'legislacion' | 'clases' | 'preguntas_trampa' | 'otro';
}

export interface Document {
  id: string;
  title: string;
  content: string;
  category: string;
  uploadedAt: Date;
  metadata?: {
    author?: string;
    source?: string;
    year?: number;
  };
}

export interface ChatState {
  conversations: Conversation[];
  currentConversation: Conversation | null;
  messages: Message[];
  isLoading: boolean;
  error: string | null;
}

export interface ThemeState {
  isDark: boolean;
  toggle: () => void;
}