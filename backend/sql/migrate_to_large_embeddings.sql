-- Migración a text-embedding-3-large (3072 dimensiones)
-- Este script actualiza la estructura para el nuevo modelo de embeddings

-- 1. Crear nueva tabla con 3072 dimensiones
CREATE TABLE IF NOT EXISTS public.document_embeddings_v2 (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  content TEXT NOT NULL,
  embedding vector(3072), -- Actualizado para text-embedding-3-large
  metadata JSONB DEFAULT '{}',
  
  -- Campos específicos para documentos legales
  document_type TEXT NOT NULL DEFAULT 'law',
  law_name TEXT,
  article_number TEXT,
  section_title TEXT,
  category TEXT NOT NULL DEFAULT 'oposiciones',
  
  -- NUEVOS CAMPOS PARA CLASES (mejor búsqueda)
  topic_number INTEGER, -- Número del tema (1-68)
  class_number INTEGER, -- Número de clase dentro del tema
  difficulty_level TEXT, -- básico, intermedio, avanzado
  exam_relevance INTEGER, -- 1-10 relevancia para examen
  keywords TEXT[], -- Array de palabras clave
  legal_refs TEXT[], -- Referencias a artículos/leyes mencionadas
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Índices optimizados para nueva estructura
CREATE INDEX IF NOT EXISTS idx_document_embeddings_v2_embedding 
  ON public.document_embeddings_v2 USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100); -- Optimizado para datasets grandes

CREATE INDEX IF NOT EXISTS idx_document_embeddings_v2_law_name 
  ON public.document_embeddings_v2(law_name);

CREATE INDEX IF NOT EXISTS idx_document_embeddings_v2_article_number 
  ON public.document_embeddings_v2(article_number);

CREATE INDEX IF NOT EXISTS idx_document_embeddings_v2_category 
  ON public.document_embeddings_v2(category);

CREATE INDEX IF NOT EXISTS idx_document_embeddings_v2_document_type 
  ON public.document_embeddings_v2(document_type);

-- NUEVOS ÍNDICES PARA BÚSQUEDA MEJORADA
CREATE INDEX IF NOT EXISTS idx_document_embeddings_v2_topic_number 
  ON public.document_embeddings_v2(topic_number);

CREATE INDEX IF NOT EXISTS idx_document_embeddings_v2_difficulty 
  ON public.document_embeddings_v2(difficulty_level);

CREATE INDEX IF NOT EXISTS idx_document_embeddings_v2_exam_relevance 
  ON public.document_embeddings_v2(exam_relevance);

CREATE INDEX IF NOT EXISTS idx_document_embeddings_v2_keywords 
  ON public.document_embeddings_v2 USING GIN(keywords);

CREATE INDEX IF NOT EXISTS idx_document_embeddings_v2_legal_refs 
  ON public.document_embeddings_v2 USING GIN(legal_refs);

-- 3. Función de búsqueda actualizada para 3072 dimensiones
CREATE OR REPLACE FUNCTION search_documents_v2(
  query_embedding vector(3072),
  match_threshold float DEFAULT 0.2,
  match_count int DEFAULT 15,
  filter_document_type text DEFAULT NULL,
  filter_law_name text DEFAULT NULL,
  filter_topic_number int DEFAULT NULL,
  filter_difficulty text DEFAULT NULL,
  min_exam_relevance int DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  content text,
  metadata jsonb,
  document_type text,
  law_name text,
  article_number text,
  section_title text,
  category text,
  topic_number int,
  class_number int,
  difficulty_level text,
  exam_relevance int,
  keywords text[],
  legal_refs text[],
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    de.id,
    de.content,
    de.metadata,
    de.document_type,
    de.law_name,
    de.article_number,
    de.section_title,
    de.category,
    de.topic_number,
    de.class_number,
    de.difficulty_level,
    de.exam_relevance,
    de.keywords,
    de.legal_refs,
    1 - (de.embedding <=> query_embedding) AS similarity
  FROM document_embeddings_v2 de
  WHERE 
    -- Filtro por similitud
    1 - (de.embedding <=> query_embedding) > match_threshold
    -- Filtros opcionales
    AND (filter_document_type IS NULL OR de.document_type = filter_document_type)
    AND (filter_law_name IS NULL OR de.law_name = filter_law_name)
    AND (filter_topic_number IS NULL OR de.topic_number = filter_topic_number)
    AND (filter_difficulty IS NULL OR de.difficulty_level = filter_difficulty)
    AND (min_exam_relevance IS NULL OR de.exam_relevance >= min_exam_relevance)
  ORDER BY de.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- 4. Función para búsqueda por keywords (nueva funcionalidad)
CREATE OR REPLACE FUNCTION search_by_keywords(
  search_keywords text[],
  match_count int DEFAULT 10
)
RETURNS TABLE (
  id uuid,
  content text,
  law_name text,
  article_number text,
  section_title text,
  topic_number int,
  keywords text[],
  keyword_matches int
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    de.id,
    de.content,
    de.law_name,
    de.article_number,
    de.section_title,
    de.topic_number,
    de.keywords,
    cardinality(de.keywords && search_keywords) as keyword_matches
  FROM document_embeddings_v2 de
  WHERE de.keywords && search_keywords
  ORDER BY cardinality(de.keywords && search_keywords) DESC
  LIMIT match_count;
END;
$$;

-- 5. Función para búsqueda por referencias legales
CREATE OR REPLACE FUNCTION search_by_legal_refs(
  search_refs text[],
  match_count int DEFAULT 10
)
RETURNS TABLE (
  id uuid,
  content text,
  law_name text,
  section_title text,
  legal_refs text[],
  ref_matches int
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    de.id,
    de.content,
    de.law_name,
    de.section_title,
    de.legal_refs,
    cardinality(de.legal_refs && search_refs) as ref_matches
  FROM document_embeddings_v2 de
  WHERE de.legal_refs && search_refs
  ORDER BY cardinality(de.legal_refs && search_refs) DESC
  LIMIT match_count;
END;
$$;

-- 6. Trigger para actualizar timestamp
CREATE OR REPLACE FUNCTION update_document_embeddings_v2_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_document_embeddings_v2_updated_at 
  BEFORE UPDATE ON public.document_embeddings_v2
  FOR EACH ROW EXECUTE FUNCTION update_document_embeddings_v2_updated_at();

-- 7. Row Level Security
ALTER TABLE public.document_embeddings_v2 ENABLE ROW LEVEL SECURITY;

-- Política para lectura pública
CREATE POLICY "Allow public read access to document_embeddings_v2" 
  ON public.document_embeddings_v2 FOR SELECT 
  USING (true);

-- Política para inserción (service role)
CREATE POLICY "Allow service role to insert document_embeddings_v2" 
  ON public.document_embeddings_v2 FOR INSERT 
  WITH CHECK (true);

-- Política para actualización (service role)
CREATE POLICY "Allow service role to update document_embeddings_v2" 
  ON public.document_embeddings_v2 FOR UPDATE 
  USING (true);

-- 8. Vista para estadísticas
CREATE OR REPLACE VIEW embedding_stats_v2 AS
SELECT
  document_type,
  law_name,
  topic_number,
  difficulty_level,
  COUNT(*) as chunk_count,
  AVG(exam_relevance) as avg_relevance,
  COUNT(DISTINCT article_number) as unique_articles
FROM document_embeddings_v2
GROUP BY document_type, law_name, topic_number, difficulty_level;

-- Confirmar setup
SELECT 
  'Migration to text-embedding-3-large completed!' as message,
  COUNT(*) as existing_documents
FROM public.document_embeddings_v2;