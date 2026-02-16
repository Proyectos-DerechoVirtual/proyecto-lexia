-- Script para limpiar y recrear la base de datos de LexIA

-- Eliminar triggers primero
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
DROP TRIGGER IF EXISTS update_conversations_updated_at ON public.conversations;
DROP TRIGGER IF EXISTS update_documents_updated_at ON public.documents;
DROP TRIGGER IF EXISTS increment_conversation_message_count ON public.messages;

-- Eliminar funciones
DROP FUNCTION IF EXISTS public.handle_new_user();
DROP FUNCTION IF EXISTS update_updated_at_column();
DROP FUNCTION IF EXISTS increment_message_count();

-- Eliminar tablas en orden correcto (por dependencias)
DROP TABLE IF EXISTS public.documents;
DROP TABLE IF EXISTS public.messages;
DROP TABLE IF EXISTS public.conversations;
DROP TABLE IF EXISTS public.profiles;

-- Mensaje de confirmación
SELECT 'Base de datos limpiada correctamente' as status;