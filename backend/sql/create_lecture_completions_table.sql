-- Tabla para guardar las lecciones completadas por los usuarios
-- Esto permite enviar mensajes proactivos cuando completan una clase

CREATE TABLE IF NOT EXISTS public.lecture_completions (
  id SERIAL PRIMARY KEY,

  -- Información del usuario
  user_id TEXT NOT NULL,
  user_email TEXT,
  user_name TEXT,

  -- Información de la lección
  lecture_id TEXT NOT NULL,
  lecture_name TEXT NOT NULL,

  -- Información del curso
  course_id TEXT NOT NULL,
  course_name TEXT NOT NULL,

  -- Porcentaje completado
  percent_complete INTEGER DEFAULT 100,

  -- Control de mensajes
  message_shown BOOLEAN DEFAULT FALSE,  -- Si ya se mostró el mensaje proactivo
  message_shown_at TIMESTAMP WITH TIME ZONE,

  -- Timestamps
  completed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Índices para búsquedas rápidas
  UNIQUE(user_id, lecture_id)  -- Evitar duplicados
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_lecture_completions_user_id ON public.lecture_completions(user_id);
CREATE INDEX IF NOT EXISTS idx_lecture_completions_completed_at ON public.lecture_completions(completed_at DESC);
CREATE INDEX IF NOT EXISTS idx_lecture_completions_message_shown ON public.lecture_completions(message_shown);

-- RLS (Row Level Security)
ALTER TABLE public.lecture_completions ENABLE ROW LEVEL SECURITY;

-- Política para permitir inserciones desde el backend (service role)
CREATE POLICY "Allow service role full access" ON public.lecture_completions
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Comentarios
COMMENT ON TABLE public.lecture_completions IS 'Registro de lecciones completadas para mensajes proactivos';
COMMENT ON COLUMN public.lecture_completions.message_shown IS 'Indica si ya se mostró el mensaje proactivo al usuario';
