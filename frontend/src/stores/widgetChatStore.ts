import { create } from 'zustand';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface ProcessingStep {
  message: string;
  step: number;
  total: number;
  estimated?: string;
}

interface UserCourse {
  courseId: string;
  courseName: string;
  category?: string;
}

interface WidgetChatStore {
  messages: Message[];
  isLoading: boolean;
  streamingMessage: string;
  processingStep: ProcessingStep | null;
  hasStarted: boolean;
  startTime: Date | null;
  reminderTimers: NodeJS.Timeout[];
  userName: string | null;
  userId: string | null;
  userEmail: string | null;
  userCourses: UserCourse[];
  currentCourseName: string | null;
  currentLessonName: string | null;
  previousLessonName: string | null;
  schemaSending: boolean;
  schemaError: string | null;
  schemaSuccess: boolean;
  suggestedFollowUps: string[];
  loadingSuggestions: boolean;
  pendingProactiveMessages: string[]; // Mensajes proactivos pendientes para mostrar al abrir el chat

  addMessage: (message: Omit<Message, 'id' | 'timestamp'>) => void;
  clearMessages: () => void;
  sendMessageStream: (content: string) => Promise<void>;
  initializeWidget: () => void;
  sendReminderMessage: (content: string) => void;
  sendProactiveMessage: (message: string) => void; // Nueva función para enviar a nubecita + chat
  showPendingProactiveMessages: () => void; // Mostrar mensajes pendientes al abrir el chat
  clearReminders: () => void;
  setUserName: (name: string) => void;
  setUserId: (id: string) => void;
  setUserEmail: (email: string) => void;
  setUserCourses: (courses: UserCourse[]) => void;
  setCurrentCourseName: (name: string) => void;
  setLessonChange: (previousLesson: string, currentLesson: string, reviewMessage?: string) => void;
  checkRecentCompletions: () => Promise<void>;
  markMessageShown: (lectureId: string) => Promise<void>;
  checkRecentTests: () => Promise<void>;
  startTestPolling: () => void;
  stopTestPolling: () => void;
  requestSchema: (topic: string, content: string) => Promise<void>;
  resetSchemaState: () => void;
}

// Función para enviar mensaje a la nubecita del widget padre
function sendToBubble(message: string) {
  if (window.parent !== window) {
    window.parent.postMessage({
      type: 'LEXAI_UPDATE_BUBBLE',
      message: message
    }, '*');
  }
}

// Función auxiliar para convertir HTML a texto plano (para los mensajes del chat)
function htmlToPlainText(html: string): string {
  return html
    .replace(/<strong>/gi, '**')
    .replace(/<\/strong>/gi, '**')
    .replace(/<b>/gi, '**')
    .replace(/<\/b>/gi, '**')
    .replace(/<em>/gi, '_')
    .replace(/<\/em>/gi, '_')
    .replace(/<i>/gi, '_')
    .replace(/<\/i>/gi, '_')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ''); // Eliminar cualquier otra etiqueta HTML
}

// Variables para el polling de tests
let testPollingInterval: NodeJS.Timeout | null = null;
let lastTestMessageShownAt: number = 0; // Para evitar mostrar el mensaje repetidamente

// Repertorio de 30 datos curiosos sobre derecho español
const DATOS_CURIOSOS = [
  // Constitución
  '📜 La Constitución tiene 169 artículos y se aprobó el 6 de diciembre de 1978',
  '🗳️ "¡Viva la Pepa!" viene de la Constitución de Cádiz, aprobada el día de San José (1812)',
  '⚖️ España no tiene cadena perpetua real, el art. 25 CE exige reinserción',
  '👑 El Rey no puede ser juzgado, tiene inviolabilidad según el art. 56 CE',
  '🏛️ La CE prohíbe la extradición por delitos políticos',
  '📝 La Constitución se votó en referéndum con un 87% de síes',
  // Código Civil
  '📚 El Código Civil tiene 1.976 artículos y data de 1889',
  '⏳ El Código Civil español tiene más de 135 años de antigüedad',
  '🏇 El art. 1800 CC permite apostar en carreras de caballos y pelota',
  '🏠 El "cabeza de familia" aún aparece en el art. 1910 del CC',
  '💍 Hasta 1981 la mujer necesitaba permiso del marido para trabajar',
  '📖 El CC ha sido reformado más de 45 veces desde 1889',
  '👶 La mayoría de edad era 21 años hasta 1978, luego bajó a 18',
  // Código Penal
  '⚔️ El primer Código Penal español fue en 1822, duró solo 1 año',
  '🔨 El CP actual es de 1995 y ha tenido más de 32 reformas',
  '👦 Los menores de 18 no se juzgan por el Código Penal (art. 19)',
  '🚫 La Pepa (1812) abolió la tortura, la horca y los azotes',
  '⏰ La prisión permanente revisable se introdujo en 2015',
  // Procedimientos
  '🔓 El Habeas Corpus permite denunciar detenciones ilegales en 24h',
  '👥 En España hay juicio con jurado para delitos graves como homicidio',
  '🗣️ En un juicio civil no puedes llamarte a declarar a ti mismo',
  '📋 El turno de oficio existe desde la Ley de Enjuiciamiento Civil de 1855',
  // Curiosidades históricas
  '⚡ El BOE publica más de 300.000 páginas de leyes al año',
  '🏰 El Tribunal Supremo está en el antiguo convento de las Salesas Reales',
  '👨‍⚖️ Los jueces llevan toga negra desde tiempos de los Reyes Católicos',
  '📜 El Fuero Juzgo (654 d.C.) fue el primer código legal hispano',
  '🔔 "Audiencia" viene de que el Rey escuchaba (audiebat) al pueblo',
  '⚖️ La balanza de la justicia representa equilibrio desde Roma',
  // Derecho Laboral/Administrativo
  '💼 El Estatuto de los Trabajadores se aprobó en 1980',
  '🏢 La Ley 39/2015 digitalizó la administración pública española'
];


export const useWidgetChatStore = create<WidgetChatStore>((set, get) => ({
  messages: [],
  isLoading: false,
  streamingMessage: '',
  processingStep: null,
  hasStarted: false,
  startTime: null,
  reminderTimers: [],
  userName: null,
  userId: null,
  userEmail: null,
  userCourses: [],
  currentCourseName: null,
  currentLessonName: null,
  previousLessonName: null,
  schemaSending: false,
  schemaError: null,
  schemaSuccess: false,
  suggestedFollowUps: [],
  loadingSuggestions: false,
  pendingProactiveMessages: [],

  setCurrentCourseName: (name: string) => {
    const { messages } = get();
    set({ currentCourseName: name });

    // Si solo hay el mensaje de saludo inicial, actualizarlo con el nombre del curso
    if (messages.length === 1 && messages[0].role === 'assistant') {
      const userName = get().userName;
      let newGreeting: string;

      if (userName && name) {
        newGreeting = `¡Hola, ${userName}! 👋 Soy LexAI, tu asistente legal especializado en justicia. Estoy aquí para ayudarte con tus estudios de ${name}. ¿En qué puedo ayudarte hoy?`;
      } else if (name) {
        newGreeting = `¡Hola! 👋 Soy LexAI, tu asistente legal especializado en justicia. Estoy aquí para ayudarte con tus estudios de ${name}. ¿En qué puedo ayudarte hoy?`;
      } else {
        return; // No actualizar si no hay nombre de curso
      }

      // Actualizar el mensaje de saludo
      set({
        messages: [{
          ...messages[0],
          content: newGreeting
        }]
      });
      console.log('LexAI: Saludo actualizado con curso:', name);
    }
  },

  setUserName: (name: string) => {
    set({ userName: name });
  },

  setUserId: (id: string) => {
    set({ userId: id });
  },

  setUserEmail: (email: string) => {
    set({ userEmail: email });
  },

  setUserCourses: (courses: UserCourse[]) => {
    set({ userCourses: courses });
  },

  setLessonChange: (previousLesson: string, currentLesson: string, reviewMessage?: string) => {
    // Normalizar nombre de lección (de MAYÚSCULAS a Normal Case)
    const normalizeLessonName = (name: string) => {
      if (!name) return '';
      return name.toLowerCase().replace(/(?:^|\s)\S/g, letter => letter.toUpperCase());
    };

    const normalizedPrevious = normalizeLessonName(previousLesson);

    set({
      previousLessonName: normalizedPrevious,
      currentLessonName: normalizeLessonName(currentLesson)
    });

    console.log('LexAI: Cambio de lección detectado en store');
    console.log('LexAI: Anterior:', normalizedPrevious, '-> Actual:', currentLesson);

    // Usar el mismo mensaje que widget.js generó para la nubecita (con nombre completo)
    if (reviewMessage) {
      const chatMessage = htmlToPlainText(reviewMessage);

      set((state) => ({
        pendingProactiveMessages: [...state.pendingProactiveMessages, chatMessage]
      }));

      console.log('LexAI: Mensaje de repaso guardado para chat:', chatMessage);
    }
  },

  addMessage: (message) => {
    const newMessage: Message = {
      ...message,
      id: Date.now().toString(),
      timestamp: new Date()
    };
    set((state) => ({
      messages: [...state.messages, newMessage]
    }));
  },

  sendMessageStream: async (content: string) => {
    const { addMessage, messages, userName, userCourses } = get();

    // Agregar mensaje del usuario
    addMessage({ role: 'user', content });

    set({
      isLoading: true,
      streamingMessage: '',
      processingStep: { message: 'Iniciando...', step: 0, total: 3 },
      suggestedFollowUps: [],
      loadingSuggestions: false
    });

    try {
      // Use correct API URL based on environment
      const baseUrl = window.location.hostname === 'localhost'
        ? 'http://localhost:5000'
        : 'https://lexia-backend.vercel.app';

      const userId = get().userId;

      const response = await fetch(`${baseUrl}/api/widget-message-stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content,
          messages: messages.slice(-8),
          userName: userName,
          userCourses: userCourses, // Enviar cursos del usuario al backend
          userId: userId // Enviar ID del usuario para obtener sus estadísticas de tests
        })
      });

      if (!response.ok) {
        throw new Error('Error en la respuesta');
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let accumulatedContent = '';

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));
                
                if (data.type === 'progress') {
                  set({ processingStep: data.data });
                } else if (data.type === 'status') {
                  // Manejar el nuevo formato de status del pipeline mejorado
                  set({ processingStep: {
                    message: data.data.message,
                    step: data.data.step,
                    total: data.data.total,
                    estimated: data.data.estimated
                  }});
                } else if (data.type === 'content') {
                  // El backend envía: { type: 'content', data: { content, fullContent } }
                  const deltaContent = data.data?.content || '';
                  if (deltaContent) {
                    accumulatedContent += deltaContent;
                  }
                  // También actualizar con fullContent si está disponible
                  if (data.data?.fullContent) {
                    accumulatedContent = data.data.fullContent;
                  }
                  set({ streamingMessage: accumulatedContent });
                } else if (data.type === 'done') {
                  const finalContent = data.data?.fullContent || accumulatedContent;
                  addMessage({
                    role: 'assistant',
                    content: finalContent
                  });
                  set({
                    isLoading: false,
                    streamingMessage: '',
                    processingStep: null,
                    loadingSuggestions: true
                  });

                  // Generar sugerencias de follow-up en background
                  fetch(`${baseUrl}/api/generate-suggestions`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      userQuestion: content,
                      assistantResponse: finalContent
                    })
                  })
                    .then(r => r.json())
                    .then(data => {
                      if (data.suggestions?.length > 0) {
                        set({ suggestedFollowUps: data.suggestions, loadingSuggestions: false });
                      } else {
                        set({ loadingSuggestions: false });
                      }
                    })
                    .catch(() => { set({ loadingSuggestions: false }); });
                } else if (data.type === 'error') {
                  console.error('Widget API error:', data.data || data);
                  addMessage({ 
                    role: 'assistant', 
                    content: 'Lo siento, hubo un error al procesar tu mensaje. Por favor, intenta de nuevo.' 
                  });
                  set({ 
                    isLoading: false, 
                    streamingMessage: '',
                    processingStep: null
                  });
                }
              } catch (e) {
                console.error('Error parsing SSE data:', e);
              }
            }
          }
        }
      }
    } catch (error) {
      console.error('Error sending message:', error);
      set({ 
        isLoading: false,
        processingStep: null
      });
      addMessage({ 
        role: 'assistant', 
        content: 'Lo siento, hubo un error al procesar tu mensaje. Por favor, intenta de nuevo.' 
      });
    }

    // Marcar que el usuario hizo su primera pregunta y cancelar recordatorios
    const state = get();
    if (!state.hasStarted) {
      set({ hasStarted: true });
      state.clearReminders();
    }
  },

  initializeWidget: () => {
    const { addMessage, userName, currentCourseName } = get();

    // Mensaje inicial de saludo personalizado con el nombre del usuario y el curso actual
    let greeting: string;

    if (userName && currentCourseName) {
      greeting = `¡Hola, ${userName}! 👋 Soy LexAI, tu asistente legal especializado en justicia. Estoy aquí para ayudarte con tus estudios de ${currentCourseName}. ¿En qué puedo ayudarte hoy?`;
    } else if (userName) {
      greeting = `¡Hola, ${userName}! 👋 Soy LexAI, tu asistente legal especializado en justicia. Estoy aquí para ayudarte con tus estudios de derecho español. ¿En qué puedo ayudarte hoy?`;
    } else if (currentCourseName) {
      greeting = `¡Hola! 👋 Soy LexAI, tu asistente legal especializado en justicia. Estoy aquí para ayudarte con tus estudios de ${currentCourseName}. ¿En qué puedo ayudarte hoy?`;
    } else {
      greeting = '¡Hola! 👋 Soy LexAI, tu asistente legal especializado en justicia. Estoy aquí para ayudarte con tus estudios de derecho español. ¿En qué puedo ayudarte hoy?';
    }

    addMessage({
      role: 'assistant',
      content: greeting
    });

    // Establecer tiempo de inicio
    set({ startTime: new Date() });

    // Configurar recordatorios
    const reminders: NodeJS.Timeout[] = [];

    // Seleccionar 2 datos curiosos diferentes para los recordatorios
    const shuffled = [...DATOS_CURIOSOS].sort(() => Math.random() - 0.5);
    const datoCurioso1 = shuffled[0];
    const datoCurioso2 = shuffled[1];

    // Recordatorio a los 2 minutos - enviar dato curioso a la nubecita Y guardarlo para el chat
    const twoMinuteReminder = setTimeout(() => {
      const state = get();
      if (!state.hasStarted) {
        state.sendProactiveMessage(datoCurioso1);
      }
    }, 2 * 60 * 1000); // 2 minutos

    // Recordatorio a los 5 minutos - enviar otro dato curioso diferente
    const fiveMinuteReminder = setTimeout(() => {
      const state = get();
      if (!state.hasStarted) {
        state.sendProactiveMessage(datoCurioso2);
      }
    }, 5 * 60 * 1000); // 5 minutos

    reminders.push(twoMinuteReminder, fiveMinuteReminder);
    set({ reminderTimers: reminders });
  },

  sendReminderMessage: (content: string) => {
    const { addMessage } = get();
    addMessage({
      role: 'assistant',
      content
    });
  },

  // Envía mensaje proactivo a la nubecita Y lo guarda para mostrar en el chat cuando se abra
  sendProactiveMessage: (message: string) => {
    // Enviar a la nubecita (widget externo)
    sendToBubble(message);

    // Convertir HTML a markdown para el chat
    const chatMessage = htmlToPlainText(message);

    // Guardar el mensaje para mostrarlo cuando se abra el chat
    set((state) => ({
      pendingProactiveMessages: [...state.pendingProactiveMessages, chatMessage]
    }));

    console.log('LexAI: Mensaje proactivo enviado a nubecita y guardado para chat:', chatMessage);
  },

  // Mostrar los mensajes proactivos pendientes cuando se abre el chat
  showPendingProactiveMessages: () => {
    const { pendingProactiveMessages, addMessage } = get();

    if (pendingProactiveMessages.length > 0) {
      // Agregar cada mensaje pendiente a la conversación
      pendingProactiveMessages.forEach((msg) => {
        addMessage({
          role: 'assistant',
          content: msg
        });
      });

      // Limpiar la cola de mensajes pendientes
      set({ pendingProactiveMessages: [] });

      console.log('LexAI: Mostrados', pendingProactiveMessages.length, 'mensajes proactivos en el chat');
    }
  },

  clearReminders: () => {
    const { reminderTimers } = get();
    reminderTimers.forEach(timer => clearTimeout(timer));
    set({ reminderTimers: [] });
  },

  // Verificar si hay lecciones completadas recientemente para mensaje proactivo
  checkRecentCompletions: async () => {
    const { userId, markMessageShown, userName } = get();

    if (!userId) return;

    try {
      const baseUrl = window.location.hostname === 'localhost'
        ? 'http://localhost:5000'
        : 'https://lexia-backend.vercel.app';

      const response = await fetch(`${baseUrl}/api/recent-completions?userId=${userId}`);
      const data = await response.json();

      if (data.completion) {
        const { lectureId, lectureName } = data.completion;

        // Esperar 3 segundos antes de mostrar el mensaje
        setTimeout(() => {
          // Mensaje corto para la nubecita y el chat
          const bubbleMessage = userName
            ? `¡${userName}! ¿Repasamos <strong>${lectureName}</strong>?`
            : `¿Repasamos <strong>${lectureName}</strong>?`;

          // Enviar a nubecita Y guardar para el chat
          get().sendProactiveMessage(bubbleMessage);

          // Marcar como mostrado
          markMessageShown(lectureId);
        }, 3000);
      }
    } catch (error) {
      console.error('Error verificando lecciones recientes:', error);
    }
  },

  // Verificar si el usuario tiene tests recientes para ofrecer explicar errores
  checkRecentTests: async () => {
    const { userId, userName, currentCourseName } = get();

    if (!userId) return;

    // Evitar mostrar el mensaje si ya se mostró hace menos de 2 minutos
    const now = Date.now();
    if (lastTestMessageShownAt && (now - lastTestMessageShownAt) < 2 * 60 * 1000) {
      return;
    }

    try {
      const baseUrl = window.location.hostname === 'localhost'
        ? 'http://localhost:5000'
        : 'https://lexia-backend.vercel.app';

      const response = await fetch(`${baseUrl}/api/check-recent-tests?userId=${userId}`);
      const data = await response.json();

      if (data.hasRecentTest && data.stats) {
        const { incorrectCount } = data.stats;

        // Solo mostrar si hay errores
        if (incorrectCount > 0) {
          // Marcar que se mostró el mensaje
          lastTestMessageShownAt = now;

          let bubbleMessage = '';

          // Usar el nombre del curso actual de Teachable (igual que los saludos)
          if (userName) {
            if (currentCourseName) {
              bubbleMessage = `¡Ey ${userName}! He visto tu último test 📝 ¿Quieres que te explique los errores de <strong>${currentCourseName}</strong>?`;
            } else {
              bubbleMessage = `¡${userName}! Veo que acabas de hacer un test 📝 ¿Te explico los fallos?`;
            }
          } else {
            if (currentCourseName) {
              bubbleMessage = `¡Acabo de ver tu test! 📝 ¿Te explico los errores de <strong>${currentCourseName}</strong>?`;
            } else {
              bubbleMessage = '¡Acabo de ver tu test! 📝 ¿Quieres que te explique los errores?';
            }
          }

          // Enviar a nubecita Y guardar para el chat
          get().sendProactiveMessage(bubbleMessage);
          console.log('LexAI: Ofreciendo explicar errores del test (detectado via polling)');
        }
      }
    } catch (error) {
      console.error('Error verificando tests recientes:', error);
    }
  },

  // Iniciar polling para detectar tests recientes
  startTestPolling: () => {
    const { userId, checkRecentTests } = get();

    if (!userId) {
      console.log('LexAI: No se puede iniciar polling sin userId');
      return;
    }

    // Si ya hay un polling activo, no iniciar otro
    if (testPollingInterval) {
      return;
    }

    console.log('LexAI: Iniciando polling de tests cada 10 segundos');

    // Verificar cada 10 segundos
    testPollingInterval = setInterval(() => {
      checkRecentTests();
    }, 10 * 1000);
  },

  // Detener polling
  stopTestPolling: () => {
    if (testPollingInterval) {
      clearInterval(testPollingInterval);
      testPollingInterval = null;
      console.log('LexAI: Polling de tests detenido');
    }
  },

  // Marcar mensaje como mostrado para no repetirlo
  markMessageShown: async (lectureId: string) => {
    const { userId } = get();

    if (!userId || !lectureId) return;

    try {
      const baseUrl = window.location.hostname === 'localhost'
        ? 'http://localhost:5000'
        : 'https://lexia-backend.vercel.app';

      await fetch(`${baseUrl}/api/mark-message-shown`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lectureId, userId })
      });
    } catch (error) {
      console.error('Error marcando mensaje como mostrado:', error);
    }
  },

  clearMessages: () => {
    const { clearReminders } = get();
    clearReminders();
    set({
      messages: [],
      hasStarted: false,
      startTime: null,
      reminderTimers: []
    });
  },

  requestSchema: async (topic: string, content: string) => {
    const { userEmail, userName } = get();

    if (!userEmail) {
      set({ schemaError: 'No se encontró tu email. Por favor, contacta con soporte.' });
      return;
    }

    set({ schemaSending: true, schemaError: null, schemaSuccess: false });

    try {
      const baseUrl = window.location.hostname === 'localhost'
        ? 'http://localhost:5000'
        : 'https://lexia-backend.vercel.app';

      const response = await fetch(`${baseUrl}/api/send-schema-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          topic,
          content,
          userEmail,
          userName
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Error al enviar el esquema');
      }

      set({ schemaSending: false, schemaSuccess: true });
    } catch (error: any) {
      console.error('Error requesting schema:', error);
      set({
        schemaSending: false,
        schemaError: error.message || 'Error al generar el esquema. Inténtalo de nuevo.'
      });
    }
  },

  resetSchemaState: () => {
    set({ schemaSending: false, schemaError: null, schemaSuccess: false });
  }
}));