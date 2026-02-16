import axios from 'axios';
import { Conversation, Message } from '../types';
import { supabase } from '@/lib/supabase';

const API_BASE_URL = '/api';

const api = axios.create({
  baseURL: API_BASE_URL,
});

api.interceptors.request.use(async (config) => {
  // Obtener el token de Supabase directamente
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.access_token) {
    config.headers.Authorization = `Bearer ${session.access_token}`;
  }
  return config;
});

export const authAPI = {
  async login(email: string, password: string) {
    const { data } = await api.post('/auth/login', { email, password });
    return data;
  },

  async register(name: string, email: string, password: string) {
    const { data } = await api.post('/auth/register', { name, email, password });
    return data;
  },

  async getProfile() {
    const { data } = await api.get('/auth/me');
    return data.user;
  },
};

export const chatAPI = {
  async getConversations(): Promise<Conversation[]> {
    const { data } = await api.get('/conversations');
    return data.data;
  },

  async createConversation(title?: string, category?: string): Promise<Conversation> {
    const { data } = await api.post('/conversations', { title, category });
    return data.data;
  },

  async getConversation(id: string): Promise<{ conversation: Conversation; messages: Message[] }> {
    const { data } = await api.get(`/conversations/${id}`);
    return data.data;
  },

  async deleteConversation(id: string): Promise<void> {
    await api.delete(`/conversations/${id}`);
  },

  async sendMessage(
    conversationId: string,
    content: string
  ): Promise<{ userMessage: Message; assistantMessage: Message }> {
    const { data } = await api.post('/messages', { conversationId, content });
    return data.data;
  },

  async searchMessages(query: string, conversationId?: string): Promise<Message[]> {
    const params = new URLSearchParams({ q: query });
    if (conversationId) params.append('conversationId', conversationId);
    
    const { data } = await api.get(`/messages/search?${params}`);
    return data.data;
  },
};