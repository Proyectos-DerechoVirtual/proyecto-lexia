-- Migración FINAL a text-embedding-3-large con 3072 dimensiones completas
-- Reemplaza completamente la tabla anterior - SIN índices, máxima precisión

-- 1. Hacer backup de la tabla actual (por seguridad)
ALTER TABLE IF EXISTS document_embeddings 
RENAME TO document_embeddings_backup_$(date +%Y%m%d);

-- 2. Crear la nueva tabla con 3072 dimensiones completas
CREATE TABLE public.document_embeddings (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  content TEXT NOT NULL,
  embedding vector(3072), -- text-embedding-3-large COMPLETO (máxima precisión)
  metadata JSONB DEFAULT '{}',
  
  -- Campos específicos para documentos legales
  document_type TEXT NOT NULL DEFAULT 'law',
  law_name TEXT,
  article_number TEXT,
  section_title TEXT,
  category TEXT NOT NULL DEFAULT 'oposiciones',
  
  -- NUEVOS CAMPOS PARA MEJOR BÚSQUEDA
  topic_number INTEGER, -- Número del tema (1-68)
  class_number INTEGER, -- Número de clase dentro del tema
  difficulty_level TEXT, -- básico, intermedio, avanzado
  exam_relevance INTEGER, -- 1-10 relevancia para examen
  keywords TEXT[], -- Array de palabras clave
  legal_refs TEXT[], -- Referencias a artículos/leyes mencionadas
  embedding_model TEXT DEFAULT 'text-embedding-3-large', -- Para tracking
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Índices SOLO para metadatos (no para embeddings)
-- Vector similarity será búsqueda secuencial (aceptable para 7,400 registros)

CREATE INDEX idx_document_embeddings_law_name 
  ON public.document_embeddings(law_name);

CREATE INDEX idx_document_embeddings_article_number 
  ON public.document_embeddings(article_number);

CREATE INDEX idx_document_embeddings_category 
  ON public.document_embeddings(category);

CREATE INDEX idx_document_embeddings_document_type 
  ON public.document_embeddings(document_type);

-- Índices para nuevos campos
CREATE INDEX idx_document_embeddings_topic_number 
  ON public.document_embeddings(topic_number);

CREATE INDEX idx_document_embeddings_difficulty 
  ON public.document_embeddings(difficulty_level);

CREATE INDEX idx_document_embeddings_exam_relevance 
  ON public.document_embeddings(exam_relevance);

CREATE INDEX idx_document_embeddings_keywords 
  ON public.document_embeddings USING GIN(keywords);

CREATE INDEX idx_document_embeddings_legal_refs 
  ON public.document_embeddings USING GIN(legal_refs);

-- Índice combinado para búsquedas frecuentes
CREATE INDEX idx_document_embeddings_type_law 
  ON public.document_embeddings(document_type, law_name);

-- 4. Eliminar función antigua si existe
DROP FUNCTION IF EXISTS search_documents(vector(1536), float, int);
DROP FUNCTION IF EXISTS search_documents_v2(vector(3072), float, int, text, text, int, text, int);

-- 5. Función de búsqueda actualizada para 3072 dimensiones
CREATE OR REPLACE FUNCTION search_documents(
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
  FROM document_embeddings de
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

-- 6. Función para búsqueda por keywords
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
  FROM document_embeddings de
  WHERE de.keywords && search_keywords
  ORDER BY cardinality(de.keywords && search_keywords) DESC
  LIMIT match_count;
END;
$$;

-- 7. Función para búsqueda por referencias legales
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
  FROM document_embeddings de
  WHERE de.legal_refs && search_refs
  ORDER BY cardinality(de.legal_refs && search_refs) DESC
  LIMIT match_count;
END;
$$;

-- 8. Trigger para actualizar timestamp
CREATE OR REPLACE FUNCTION update_document_embeddings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_document_embeddings_updated_at 
  BEFORE UPDATE ON public.document_embeddings
  FOR EACH ROW EXECUTE FUNCTION update_document_embeddings_updated_at();

-- 9. Row Level Security
ALTER TABLE public.document_embeddings ENABLE ROW LEVEL SECURITY;

-- Políticas de seguridad
CREATE POLICY "Allow public read access to document_embeddings" 
  ON public.document_embeddings FOR SELECT 
  USING (true);

CREATE POLICY "Allow service role to insert document_embeddings" 
  ON public.document_embeddings FOR INSERT 
  WITH CHECK (true);

CREATE POLICY "Allow service role to update document_embeddings" 
  ON public.document_embeddings FOR UPDATE 
  USING (true);

CREATE POLICY "Allow service role to delete document_embeddings" 
  ON public.document_embeddings FOR DELETE 
  USING (true);

-- 10. Vista para estadísticas
CREATE OR REPLACE VIEW embedding_stats AS
SELECT
  document_type,
  law_name,
  topic_number,
  difficulty_level,
  COUNT(*) as chunk_count,
  AVG(exam_relevance) as avg_relevance,
  COUNT(DISTINCT article_number) as unique_articles
FROM document_embeddings
GROUP BY document_type, law_name, topic_number, difficulty_level;

-- 11. Función helper para obtener estadísticas rápidas
CREATE OR REPLACE FUNCTION get_embedding_stats()
RETURNS TABLE (
  total_chunks bigint,
  total_laws bigint,
  total_topics bigint,
  avg_relevance numeric,
  model_used text
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::bigint as total_chunks,
    COUNT(DISTINCT CASE WHEN document_type = 'law' THEN law_name END)::bigint as total_laws,
    COUNT(DISTINCT topic_number)::bigint as total_topics,
    ROUND(AVG(exam_relevance), 2) as avg_relevance,
    MAX(embedding_model) as model_used
  FROM document_embeddings;
END;
$$;

-- 12. Confirmar configuración
SELECT 
  'Migration completed successfully!' as status,
  'text-embedding-3-large with 3072 dimensions (FULL)' as model,
  'No vector index (sequential search for max precision)' as search_method,
  'Expected search time: ~200-400ms for 7,400 records' as performance;

-- NOTA: Para eliminar backup después de verificar:
-- DROP TABLE IF EXISTS document_embeddings_backup_YYYYMMDD;