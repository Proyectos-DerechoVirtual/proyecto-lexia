-- Actualizar función RPC para búsqueda por embeddings con nuevo schema
-- Esta función debe ejecutarse en Supabase SQL Editor

-- Eliminar función existente si existe
DROP FUNCTION IF EXISTS search_documents(vector(1536), float, int);

-- Crear nueva función de búsqueda adaptada al nuevo schema
CREATE OR REPLACE FUNCTION search_documents(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.2,
  match_count int DEFAULT 5
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
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    document_embeddings.id,
    document_embeddings.content,
    document_embeddings.metadata,
    document_embeddings.document_type,
    document_embeddings.law_name,
    document_embeddings.article_number,
    document_embeddings.section_title,
    document_embeddings.category,
    1 - (document_embeddings.embedding <=> query_embedding) AS similarity
  FROM document_embeddings
  WHERE 1 - (document_embeddings.embedding <=> query_embedding) > match_threshold
  ORDER BY document_embeddings.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;