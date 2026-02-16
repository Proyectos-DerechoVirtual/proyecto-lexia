import { useEffect, useState } from 'react';
import { WidgetChatInterface } from '@/components/chat/WidgetChatInterface';
import { useAuthStore } from '@/stores/supabaseAuthStore';
import { ScaleIcon } from '@/components/icons/ScaleIcon';
import { useWidgetChatStore } from '@/stores/widgetChatStore';

interface EmbedPageProps {
  hideHeader?: boolean;
  compactMode?: boolean;
  primaryColor?: string;
}

export function EmbedPage({
  hideHeader = true,
  compactMode = true,
  primaryColor = '#64c27b'
}: EmbedPageProps) {
  const [isReady, setIsReady] = useState(false);
  const { user } = useAuthStore();
  const { setUserName, setUserCourses, setUserId, setUserEmail, setCurrentCourseName, setLessonChange, checkRecentCompletions, checkRecentTests, startTestPolling, stopTestPolling } = useWidgetChatStore();
  const [teachableUserName, setTeachableUserName] = useState<string | null>(null);

  // Leer parámetros de URL de Teachable
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const userName = urlParams.get('user_name');
    const userEmail = urlParams.get('user_email');
    const userId = urlParams.get('user_id');
    const courseName = urlParams.get('course_name');

    // Establecer el nombre del curso actual si está presente
    if (courseName) {
      setCurrentCourseName(courseName);
      console.log('LexAI: Curso actual:', courseName);
    }

    // Guardar el email del usuario para funcionalidades como envío de esquemas
    if (userEmail) {
      setUserEmail(userEmail);
      console.log('LexAI: Email de Teachable:', userEmail);
    }

    if (userName) {
      setTeachableUserName(userName);
      setUserName(userName);
      console.log('LexAI: Usuario de Teachable:', userName);
    } else if (userEmail) {
      const nameFromEmail = userEmail.split('@')[0];
      setTeachableUserName(nameFromEmail);
      setUserName(nameFromEmail);
    }

    // Si tenemos user_id, obtener los cursos del usuario y verificar lecciones recientes
    if (userId) {
      setUserId(userId);
      fetchUserCourses(userId, userEmail);

      // Verificar lecciones completadas recientemente después de 5 segundos
      setTimeout(() => {
        checkRecentCompletions();
      }, 5000);

      // Verificar tests recientes después de 8 segundos e iniciar polling
      setTimeout(() => {
        checkRecentTests();
        startTestPolling(); // Iniciar polling cada 10 segundos
      }, 8000);
    }

    // Cleanup: detener polling al desmontar
    return () => {
      stopTestPolling();
    };
  }, [setUserName, setUserEmail, setUserCourses, setUserId, setCurrentCourseName, checkRecentCompletions, checkRecentTests, startTestPolling, stopTestPolling]);

  // Función para obtener cursos del usuario desde Teachable
  const fetchUserCourses = async (userId: string, userEmail: string | null) => {
    try {
      const params = new URLSearchParams();
      if (userId) params.append('userId', userId);
      if (userEmail) params.append('userEmail', userEmail);

      const response = await fetch(`https://lexia-backend.vercel.app/api/get-user-courses?${params}`);
      if (response.ok) {
        const data = await response.json();
        if (data.courses && data.courses.length > 0) {
          setUserCourses(data.courses);
          console.log('LexAI: Cursos del usuario:', data.courses);
        }
      }
    } catch (error) {
      console.error('LexAI: Error obteniendo cursos:', error);
    }
  };
  
  useEffect(() => {
    // Notificar al parent window que está listo
    if (window.parent !== window) {
      window.parent.postMessage({ 
        type: 'lexai-ready',
        version: '1.0.0'
      }, '*');
    }
    
    // Aplicar estilos personalizados para embed
    document.documentElement.style.setProperty('--primary-color', primaryColor);
    document.body.classList.add('embed-mode');
    if (compactMode) {
      document.body.classList.add('compact-mode');
    }
    
    // Escuchar mensajes del widget padre
    const handleMessage = (event: MessageEvent) => {
      if (event.data.type === 'WIDGET_FONT_SIZE') {
        document.documentElement.style.fontSize = event.data.fontSize;
        document.body.style.fontSize = event.data.fontSize;
      }
      // Actualizar nombre del curso desde el widget padre
      if (event.data.type === 'LEXAI_UPDATE_COURSE' && event.data.courseName) {
        console.log('LexAI: Recibido nombre del curso:', event.data.courseName);
        setCurrentCourseName(event.data.courseName);
      }
      // Actualizar datos de usuario desde el widget padre
      if (event.data.type === 'LEXAI_UPDATE_USER') {
        console.log('LexAI: Recibido datos de usuario:', event.data.userName);
        if (event.data.userName) {
          setTeachableUserName(event.data.userName);
          setUserName(event.data.userName);
        }
        if (event.data.userId) {
          setUserId(event.data.userId);
          // Verificar tests recientes e iniciar polling
          setTimeout(() => {
            checkRecentTests();
            startTestPolling();
          }, 5000);
        }
        if (event.data.userEmail) {
          setUserEmail(event.data.userEmail);
        }
      }
      // Detectar cambio de lección
      if (event.data.type === 'LEXAI_LESSON_CHANGE') {
        console.log('LexAI: Cambio de lección detectado:', event.data.previousLesson, '->', event.data.currentLesson);
        if (event.data.previousLesson && event.data.currentLesson) {
          setLessonChange(event.data.previousLesson, event.data.currentLesson, event.data.reviewMessage);
        }
      }
    };

    window.addEventListener('message', handleMessage);
    
    setIsReady(true);
    
    // Cleanup
    return () => {
      document.body.classList.remove('embed-mode', 'compact-mode');
      window.removeEventListener('message', handleMessage);
    };
  }, [compactMode, primaryColor, setCurrentCourseName, setUserName, setUserId, setUserEmail, setLessonChange, checkRecentTests, startTestPolling]);

  if (!isReady) {
    return (
      <div className="flex items-center justify-center h-screen bg-white">
        <div className="text-center">
          <ScaleIcon className="text-claude-orange mx-auto mb-4 animate-pulse" size={48} />
          <p className="text-gray-600">Cargando LexAI...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="embed-container h-screen flex flex-col bg-white overflow-hidden">
      {!hideHeader && (
        <div className="embed-header bg-claude-orange text-white px-4 py-3 flex items-center gap-2">
          <ScaleIcon className="text-white" size={20} />
          <span className="font-semibold">LexAI - Asistente Legal</span>
          <span className="text-xs ml-auto opacity-80">Versión Teachable</span>
        </div>
      )}
      
      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        <WidgetChatInterface />
      </div>
      
      {/* Footer minimalista opcional */}
      <div className="embed-footer border-t border-gray-200 px-4 py-2 text-center">
        <p className="text-xs text-gray-500">
          Powered by <a href="https://lexia-chatbot.vercel.app/login" target="_blank" rel="noopener noreferrer" className="text-[#64c27b] hover:text-[#52a068] transition-colors">LexAI</a> • {teachableUserName || user?.name || 'Modo invitado'}
        </p>
      </div>
    </div>
  );
}