import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://yxcykvoxbtseawrigbcp.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl4Y3lrdm94YnRzZWF3cmlnYmNwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIxNjcxNzgsImV4cCI6MjA2Nzc0MzE3OH0.hRb8CvoT57YpaLcIZL2oJNBe9E0-UV6m5GzXlUS4l_E';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Tipos para las tablas
export interface Profile {
  id: string;
  name: string;
  email: string;
  role: 'user' | 'admin';
  preferences: {
    theme?: 'light' | 'dark';
    language?: string;
    notifications?: boolean;
  };
  is_active: boolean;
  last_login?: string;
  created_at: string;
  updated_at: string;
}

export interface DbConversation {
  id: string;
  user_id: string;
  title: string;
  category?: 'civil' | 'penal' | 'laboral' | 'mercantil' | 'familia' | 'otro';
  is_active: boolean;
  metadata: {
    messageCount?: number;
    lastMessageAt?: string;
  };
  created_at: string;
  updated_at: string;
}

export interface DbMessage {
  id: string;
  conversation_id: string;
  content: string;
  role: 'user' | 'assistant' | 'system';
  metadata?: {
    tokens?: number;
    model?: string;
    processingTime?: number;
  };
  created_at: string;
}

export interface DbDocument {
  id: string;
  user_id?: string;
  title: string;
  content: string;
  category: string;
  filename?: string;
  mime_type?: string;
  size?: number;
  metadata?: any;
  is_processed: boolean;
  created_at: string;
  updated_at: string;
}