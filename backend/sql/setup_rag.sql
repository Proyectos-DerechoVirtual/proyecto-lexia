-- Setup RAG para LexIA en Supabase
-- Este script configura la tabla document_embeddings para el sistema RAG

-- Habilitar extensiones necesarias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";

-- Tabla principal para embeddings de documentos
CREATE TABLE IF NOT EXISTS public.document_embeddings (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  content TEXT NOT NULL,
  embedding vector(1536), -- Para OpenAI text-embedding-3-small
  metadata JSONB DEFAULT '{}',
  
  -- Campos específicos para documentos legales
  document_type TEXT NOT NULL DEFAULT 'law',
  law_name TEXT,
  article_number TEXT,
  section_title TEXT,
  category TEXT NOT NULL DEFAULT 'oposiciones',
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para búsquedas eficientes
CREATE INDEX IF NOT EXISTS idx_document_embeddings_embedding 
  ON public.document_embeddings USING ivfflat (embedding vector_cosine_ops);

CREATE INDEX IF NOT EXISTS idx_document_embeddings_law_name 
  ON public.document_embeddings(law_name);

CREATE INDEX IF NOT EXISTS idx_document_embeddings_article_number 
  ON public.document_embeddings(article_number);

CREATE INDEX IF NOT EXISTS idx_document_embeddings_category 
  ON public.document_embeddings(category);

CREATE INDEX IF NOT EXISTS idx_document_embeddings_document_type 
  ON public.document_embeddings(document_type);

-- Función para actualizar updated_at
CREATE OR REPLACE FUNCTION update_document_embeddings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger para actualizar timestamp automáticamente
CREATE TRIGGER update_document_embeddings_updated_at 
  BEFORE UPDATE ON public.document_embeddings
  FOR EACH ROW EXECUTE FUNCTION update_document_embeddings_updated_at();

-- Row Level Security
ALTER TABLE public.document_embeddings ENABLE ROW LEVEL SECURITY;

-- Política para permitir lectura pública de documentos (para RAG)
CREATE POLICY "Allow public read access to document_embeddings" 
  ON public.document_embeddings FOR SELECT 
  USING (true);

-- Política para inserción (solo para service role)
CREATE POLICY "Allow service role to insert document_embeddings" 
  ON public.document_embeddings FOR INSERT 
  WITH CHECK (true);

-- Política para actualización (solo para service role)
CREATE POLICY "Allow service role to update document_embeddings" 
  ON public.document_embeddings FOR UPDATE 
  USING (true);

-- Confirmar que todo está configurado
SELECT 
  'RAG setup completed successfully!' as message,
  COUNT(*) as existing_documents
FROM public.document_embeddings;