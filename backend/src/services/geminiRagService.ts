/**
 * Servicio de RAG usando Gemini File Search
 *
 * Reemplaza la búsqueda vectorial de Supabase por Gemini File Search
 * que es más rápido y maneja el RAG internamente.
 */

import { GoogleGenAI } from '@google/genai';
import { createClient } from '@supabase/supabase-js';

// Configuración
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const GEMINI_FILE_STORE_NAME = process.env.GEMINI_FILE_STORE_NAME || '';

// Configuración Supabase Tests
const SUPABASE_TESTS_URL = process.env.SUPABASE_TESTS_URL || 'https://xbdymqysqntuoclhidgm.supabase.co';
const SUPABASE_TESTS_KEY = process.env.SUPABASE_TESTS_SERVICE_KEY || '';

// Cliente Supabase para Tests (lazy initialization)
let testsSupabaseClient: ReturnType<typeof createClient> | null = null;

function getTestsSupabase() {
  if (!testsSupabaseClient && SUPABASE_TESTS_KEY) {
    testsSupabaseClient = createClient(SUPABASE_TESTS_URL, SUPABASE_TESTS_KEY);
  }
  return testsSupabaseClient;
}

// Construir el nombre completo del store
const FILE_STORE_NAME = GEMINI_FILE_STORE_NAME
  ? `fileSearchStores/${GEMINI_FILE_STORE_NAME}`
  : null;

// Cliente Gemini
let aiClient: GoogleGenAI | null = null;

function getClient(): GoogleGenAI {
  if (!aiClient) {
    if (!GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY no está configurada');
    }
    aiClient = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
  }
  return aiClient;
}

// Interfaz para cursos del usuario
interface UserCourse {
  courseId: string;
  courseName: string;
  category?: string;
}

// Interfaz para estadísticas de preguntas del usuario
interface UserQuestionStat {
  questionId: number;
  pregunta: string;
  opciones: string[];
  respuestaCorrectaIndex: number;
  respuestaEstudianteIndex: number | null;
  esCorrecta: boolean | null;
  categoria: string;
  tema: number;
  subtema?: string;
}

/**
 * Obtiene las últimas 10 preguntas respondidas por el usuario con todos los detalles
 */
/**
 * Verifica si el usuario tiene preguntas de test muy recientes (últimos X segundos)
 * Retorna info sobre las preguntas recientes solo si la última fue hace menos de maxSeconds
 */
export async function checkVeryRecentTest(userId: string, maxSeconds: number = 30): Promise<{
  hasVeryRecentTest: boolean;
  secondsSinceLastAnswer: number | null;
  stats: {
    totalQuestions: number;
    correctCount: number;
    incorrectCount: number;
    weakCategories: string[];
  } | null;
}> {
  const supabase = getTestsSupabase();
  if (!supabase || !userId) {
    return { hasVeryRecentTest: false, secondsSinceLastAnswer: null, stats: null };
  }

  try {
    // Obtener solo la última pregunta para verificar el timestamp
    const { data, error } = await supabase
      .from('user_question_stats')
      .select(`
        question_id,
        last_seen_at,
        last_answer_correct,
        questions_test (
          categoria
        )
      `)
      .eq('user_id', userId)
      .order('last_seen_at', { ascending: false })
      .limit(10);

    if (error || !data || data.length === 0) {
      return { hasVeryRecentTest: false, secondsSinceLastAnswer: null, stats: null };
    }

    // Verificar timestamp de la última respuesta
    const lastSeenAt = (data[0] as any).last_seen_at;
    const lastAnswerTime = new Date(lastSeenAt);
    const now = new Date();
    const secondsSinceLastAnswer = Math.floor((now.getTime() - lastAnswerTime.getTime()) / 1000);

    console.log(`[GeminiRAG] Última respuesta hace ${secondsSinceLastAnswer} segundos`);

    // Si han pasado más de maxSeconds, no es "muy reciente"
    if (secondsSinceLastAnswer > maxSeconds) {
      return { hasVeryRecentTest: false, secondsSinceLastAnswer, stats: null };
    }

    // Calcular estadísticas
    const totalQuestions = data.length;
    const correctCount = data.filter((q: any) => q.last_answer_correct === true).length;
    const incorrectCount = data.filter((q: any) => q.last_answer_correct === false).length;

    // Categorías con más errores
    const categoryErrors: Record<string, number> = {};
    data.forEach((q: any) => {
      if (q.last_answer_correct === false && q.questions_test?.categoria) {
        categoryErrors[q.questions_test.categoria] = (categoryErrors[q.questions_test.categoria] || 0) + 1;
      }
    });
    const weakCategories = Object.entries(categoryErrors)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 2)
      .map(([cat]) => cat);

    return {
      hasVeryRecentTest: true,
      secondsSinceLastAnswer,
      stats: {
        totalQuestions,
        correctCount,
        incorrectCount,
        weakCategories
      }
    };
  } catch (error: any) {
    console.error('[GeminiRAG] Error en checkVeryRecentTest:', error.message);
    return { hasVeryRecentTest: false, secondsSinceLastAnswer: null, stats: null };
  }
}

export async function getUserRecentQuestions(userId: string): Promise<UserQuestionStat[]> {
  const supabase = getTestsSupabase();
  if (!supabase || !userId) {
    return [];
  }

  try {
    const { data, error } = await supabase
      .from('user_question_stats')
      .select(`
        question_id,
        last_answer_correct,
        last_answer_given,
        questions_test (
          pregunta,
          opciones,
          respuesta_correcta,
          categoria,
          tema,
          subtema
        )
      `)
      .eq('user_id', userId)
      .order('last_seen_at', { ascending: false })
      .limit(10);

    if (error) {
      console.error('[GeminiRAG] Error obteniendo preguntas del usuario:', error.message);
      return [];
    }

    if (!data || data.length === 0) {
      return [];
    }

    return data.map((stat: any) => ({
      questionId: stat.question_id,
      pregunta: stat.questions_test?.pregunta || '',
      opciones: stat.questions_test?.opciones || [],
      respuestaCorrectaIndex: stat.questions_test?.respuesta_correcta ?? -1,
      respuestaEstudianteIndex: stat.last_answer_given,
      esCorrecta: stat.last_answer_correct,
      categoria: stat.questions_test?.categoria || '',
      tema: stat.questions_test?.tema || 0,
      subtema: stat.questions_test?.subtema || ''
    }));
  } catch (error: any) {
    console.error('[GeminiRAG] Error en getUserRecentQuestions:', error.message);
    return [];
  }
}

/**
 * System prompt especializado para Carlos Rivero
 */
function getSystemPrompt(
  userName?: string | null,
  userCourses?: UserCourse[],
  recentQuestions?: UserQuestionStat[]
): string {
  const studentReference = userName
    ? `El estudiante se llama "${userName}". Usa su nombre de vez en cuando para hacer la conversación más personal y cercana.`
    : '';

  // Generar contexto de cursos del estudiante
  let coursesContext = '';
  if (userCourses && userCourses.length > 0) {
    const coursesList = userCourses.map(c => `- ${c.courseName}${c.category ? ` (${c.category})` : ''}`).join('\n');
    coursesContext = `
CURSOS DEL ESTUDIANTE:
El estudiante está inscrito en los siguientes cursos/materias:
${coursesList}

IMPORTANTE: Adapta tus respuestas y ejemplos a las materias que el estudiante está estudiando. Si pregunta sobre algo fuera de sus cursos, puedes responder pero menciona que no es parte de su temario actual.`;
  }

  // Generar contexto de preguntas recientes de tests
  let testQuestionsContext = '';
  if (recentQuestions && recentQuestions.length > 0) {
    // Analizar rendimiento
    const correctCount = recentQuestions.filter(q => q.esCorrecta === true).length;
    const incorrectCount = recentQuestions.filter(q => q.esCorrecta === false).length;

    // Categorías con más errores
    const categoryErrors: Record<string, number> = {};
    recentQuestions.forEach(q => {
      if (q.esCorrecta === false && q.categoria) {
        categoryErrors[q.categoria] = (categoryErrors[q.categoria] || 0) + 1;
      }
    });
    const weakCategories = Object.entries(categoryErrors)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([cat]) => cat);

    // Formatear las preguntas con detalles
    const questionsDetail = recentQuestions.map((q, i) => {
      const opcionesText = q.opciones.map((op, idx) => {
        let prefix = `   ${idx + 1}) `;
        if (idx === q.respuestaCorrectaIndex) prefix += '✅ ';
        if (idx === q.respuestaEstudianteIndex && q.esCorrecta === false) prefix += '❌ ';
        return prefix + op;
      }).join('\n');

      const resultado = q.esCorrecta === true ? '✅ CORRECTA' : q.esCorrecta === false ? '❌ INCORRECTA' : '⏭️ SALTADA';
      const respuestaEstudiante = q.respuestaEstudianteIndex !== null ? `Respondió: opción ${q.respuestaEstudianteIndex + 1}` : 'No respondió';

      return `${i + 1}. [${q.categoria}] ${resultado}
   Pregunta: ${q.pregunta}
${opcionesText}
   ${respuestaEstudiante} | Correcta: opción ${q.respuestaCorrectaIndex + 1}`;
    }).join('\n\n');

    testQuestionsContext = `
CONTEXTO DE TESTS DEL ESTUDIANTE:
Resumen: ${recentQuestions.length} preguntas | ✅ ${correctCount} correctas | ❌ ${incorrectCount} incorrectas | Tasa: ${Math.round((correctCount / recentQuestions.length) * 100)}%
${weakCategories.length > 0 ? `Áreas débiles: ${weakCategories.join(', ')}` : ''}

ÚLTIMAS ${recentQuestions.length} PREGUNTAS RESPONDIDAS:
${questionsDetail}

⚠️ CUÁNDO MENCIONAR LOS TESTS:
- NO en saludos simples ("Hola", "Buenos días", etc.) - responde naturalmente sin mencionar tests
- NO cuando la pregunta no tiene nada que ver con el estudio o temario
- SÍ cuando el estudiante pregunta sobre un tema donde ha fallado en tests
- SÍ cuando pide ayuda con una materia que coincide con sus áreas débiles
- SÍ cuando pregunta sobre su rendimiento, progreso o qué debería repasar
- SÍ puedes mencionar que has visto sus resultados de tests cuando sea pertinente a la conversación

🔴 REGLA OBLIGATORIA PARA CORRECCIONES DE TESTS:
Cuando el estudiante te pida que le expliques sus errores del test, que corrijas el test, o cualquier variante similar, DEBES cubrir ABSOLUTAMENTE TODAS las ${recentQuestions.length} preguntas, una por una, sin excepción. No te detengas en 5 o 6, recorre las ${recentQuestions.length} completas. Para cada pregunta:
1. Indica si fue ✅ correcta o ❌ incorrecta
2. Si fue incorrecta: explica POR QUÉ la respuesta elegida es errónea y POR QUÉ la correcta es la correcta, con referencia legal si aplica
3. Si fue correcta: confírmalo brevemente con un refuerzo positivo
Extiéndete todo lo que necesites. No resumas ni acortes. El estudiante necesita entender CADA pregunta.`;
  }

  return `Eres "Carlos Rivero", un tutor especializado en tus asignaturas con más de 15 años de experiencia. Tu estilo es:

${studentReference}
${coursesContext}
${testQuestionsContext}

PERSONALIDAD:
- Coloquial pero profesional (tuteas al estudiante)
- Directo y sin rodeos
- Usa emojis estratégicamente (8-12 por respuesta) para hacer el contenido más amigable
- Retador: lanza preguntas para comprobar comprensión
${userName ? `- Llama al estudiante por su nombre (${userName}) de forma natural, no en cada mensaje` : ''}

FORMATO DE RESPUESTAS:
1. **Citas legales**: Siempre usa blockquotes (>) para artículos y textos legales exactos
2. **Estructura clara**: Usa viñetas, listas numeradas y secciones
3. **Destaca lo importante**: Usa **negrita** para conceptos clave
4. **Advertencias**: Usa ⚠️ para errores comunes y trampas de examen

ESTRUCTURA TÍPICA:
1. Entrada directa al tema (NUNCA repitas "Hola" ni saludes si ya hay un saludo en el historial de conversación. Si es la primera interacción real, usa algo como "¡Vale, vamos con ello!" o "¡Buena pregunta!" en lugar de "Hola")
2. Explicación del concepto (con citas legales si aplica)
3. Puntos clave a memorizar
4. ⚠️ Errores comunes / Trampas de examen
5. 🎓 Tips para el examen
6. Pregunta de seguimiento ("¿Quieres que te haga una pregunta tipo test?")

REGLAS:
- SIEMPRE cita el artículo exacto cuando menciones legislación
- Si no tienes información suficiente, dilo claramente
- Conecta conceptos relacionados cuando sea útil
- Adapta la profundidad según la pregunta
${userCourses && userCourses.length > 0 ? '- Prioriza información relevante a los cursos del estudiante' : ''}
${recentQuestions && recentQuestions.length > 0 ? '- Usa el rendimiento en tests para personalizar explicaciones y ofrecer ayuda específica' : ''}

DISCLAIMER (incluir al final de respuestas largas):
---
*📚 Recuerda: Esta información es orientativa para tu preparación. Siempre consulta la legislación vigente.*`;
}

/**
 * Genera una respuesta usando Gemini con File Search
 */
export async function generateResponseWithRAG(
  userMessage: string,
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }> = [],
  options: {
    temperature?: number;
    maxTokens?: number;
    stream?: boolean;
    userName?: string | null;
    userCourses?: UserCourse[];
    recentQuestions?: UserQuestionStat[];
  } = {}
): Promise<{
  content: string;
  model: string;
  tokensUsed?: number;
}> {
  const ai = getClient();

  if (!FILE_STORE_NAME) {
    throw new Error('GEMINI_FILE_STORE_NAME no está configurada');
  }

  const { temperature = 0.7, maxTokens = 8000, userName, userCourses, recentQuestions } = options;

  // Construir el historial de conversación para el contexto
  const studentLabel = userName || 'Estudiante';
  const historyText = conversationHistory.length > 0
    ? conversationHistory
        .slice(-10) // Últimos 10 mensajes
        .map(m => `${m.role === 'user' ? studentLabel : 'Carlos'}: ${m.content}`)
        .join('\n\n')
    : '';

  const contextPrompt = historyText
    ? `HISTORIAL DE CONVERSACIÓN:\n${historyText}\n\n---\n\nNUEVA PREGUNTA DE ${studentLabel.toUpperCase()}:\n${userMessage}`
    : userMessage;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: contextPrompt,
      config: {
        systemInstruction: getSystemPrompt(userName, userCourses, recentQuestions),
        tools: [{
          fileSearch: {
            fileSearchStoreNames: [FILE_STORE_NAME]
          }
        }],
        temperature: temperature,
        maxOutputTokens: maxTokens
      }
    });

    return {
      content: response.text || 'Lo siento, no pude generar una respuesta.',
      model: 'gemini-3-flash-preview',
      tokensUsed: response.usageMetadata?.totalTokenCount
    };
  } catch (error: any) {
    console.error('[GeminiRAG] Error generando respuesta:', error.message);
    throw new Error(`Error en Gemini: ${error.message}`);
  }
}

/**
 * Genera una respuesta con streaming
 */
export async function generateResponseWithRAGStream(
  userMessage: string,
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }> = [],
  onChunk: (chunk: string) => void,
  options: {
    temperature?: number;
    maxTokens?: number;
    userName?: string | null;
    userCourses?: UserCourse[];
    recentQuestions?: UserQuestionStat[];
  } = {}
): Promise<{
  content: string;
  model: string;
}> {
  const ai = getClient();

  if (!FILE_STORE_NAME) {
    throw new Error('GEMINI_FILE_STORE_NAME no está configurada');
  }

  const { temperature = 0.7, maxTokens = 8000, userName, userCourses, recentQuestions } = options;

  // Construir el historial de conversación
  const studentLabel = userName || 'Estudiante';
  const historyText = conversationHistory.length > 0
    ? conversationHistory
        .slice(-10)
        .map(m => `${m.role === 'user' ? studentLabel : 'Carlos'}: ${m.content}`)
        .join('\n\n')
    : '';

  const contextPrompt = historyText
    ? `HISTORIAL DE CONVERSACIÓN:\n${historyText}\n\n---\n\nNUEVA PREGUNTA DE ${studentLabel.toUpperCase()}:\n${userMessage}`
    : userMessage;

  try {
    const response = await ai.models.generateContentStream({
      model: 'gemini-3-flash-preview',
      contents: contextPrompt,
      config: {
        systemInstruction: getSystemPrompt(userName, userCourses, recentQuestions),
        tools: [{
          fileSearch: {
            fileSearchStoreNames: [FILE_STORE_NAME]
          }
        }],
        temperature: temperature,
        maxOutputTokens: maxTokens
      }
    });

    let fullContent = '';

    for await (const chunk of response) {
      const text = chunk.text || '';
      if (text) {
        fullContent += text;
        onChunk(text);
      }
    }

    return {
      content: fullContent,
      model: 'gemini-3-flash-preview'
    };
  } catch (error: any) {
    console.error('[GeminiRAG] Error en streaming:', error.message);
    throw new Error(`Error en Gemini streaming: ${error.message}`);
  }
}

/**
 * Genera un título para la conversación basado en el primer mensaje
 */
export async function generateConversationTitle(firstMessage: string): Promise<string> {
  const ai = getClient();

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Genera un título corto (máximo 6 palabras) para una conversación de estudio que comienza con esta pregunta:

"${firstMessage}"

Responde SOLO con el título, sin comillas ni explicaciones.`,
      config: {
        temperature: 0.5,
        maxOutputTokens: 50
      }
    });

    return response.text?.trim().slice(0, 50) || 'Nueva conversación';
  } catch (error) {
    console.error('[GeminiRAG] Error generando título:', error);
    return 'Nueva conversación';
  }
}

/**
 * Verifica que la configuración de Gemini está correcta
 */
export async function verifyGeminiConfig(): Promise<{
  ok: boolean;
  message: string;
  details?: any;
}> {
  if (!GEMINI_API_KEY) {
    return { ok: false, message: 'GEMINI_API_KEY no configurada' };
  }

  if (!GEMINI_FILE_STORE_NAME) {
    return { ok: false, message: 'GEMINI_FILE_STORE_NAME no configurada' };
  }

  try {
    const ai = getClient();

    // Hacer una consulta simple para verificar
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: 'Responde solo "OK" si puedes leer esto.',
      config: {
        maxOutputTokens: 10
      }
    });

    return {
      ok: true,
      message: 'Gemini configurado correctamente',
      details: {
        fileStoreName: FILE_STORE_NAME,
        model: 'gemini-3-flash-preview',
        testResponse: response.text
      }
    };
  } catch (error: any) {
    return {
      ok: false,
      message: `Error conectando con Gemini: ${error.message}`
    };
  }
}

/**
 * Búsqueda simple de documentos (para endpoints de debug)
 */
export async function searchDocuments(query: string): Promise<{
  response: string;
  model: string;
}> {
  const ai = getClient();

  if (!FILE_STORE_NAME) {
    throw new Error('GEMINI_FILE_STORE_NAME no está configurada');
  }

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Busca información relevante sobre: "${query}".

Resume los puntos más importantes encontrados en los documentos. Si hay artículos específicos, cítalos textualmente.`,
      config: {
        tools: [{
          fileSearch: {
            fileSearchStoreNames: [FILE_STORE_NAME]
          }
        }],
        temperature: 0.3,
        maxOutputTokens: 2000
      }
    });

    return {
      response: response.text || 'No se encontraron resultados.',
      model: 'gemini-3-flash-preview'
    };
  } catch (error: any) {
    throw new Error(`Error en búsqueda: ${error.message}`);
  }
}

/**
 * Genera 5 sugerencias de follow-up basadas en la pregunta y respuesta
 */
export async function generateFollowUpSuggestions(
  userQuestion: string,
  assistantResponse: string
): Promise<string[]> {
  const ai = getClient();

  // Usar solo los primeros 500 chars de la respuesta para no gastar tokens
  const truncatedResponse = assistantResponse.length > 500
    ? assistantResponse.substring(0, 500) + '...'
    : assistantResponse;

  try {
    console.log('[GeminiRAG] Generando sugerencias para:', userQuestion.substring(0, 50));

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Genera exactamente 5 sugerencias cortas para continuar esta conversación de estudio de oposiciones.

Pregunta: "${userQuestion}"
Respuesta: "${truncatedResponse}"

Responde SOLO con un JSON array de 5 strings cortos. Máximo 40 caracteres cada uno. Sin explicaciones adicionales.`,
      config: {
        temperature: 0.7,
        maxOutputTokens: 1024,
        responseMimeType: 'application/json'
      }
    });

    const text = response.text?.trim() || '';

    // Intentar parsear como JSON array
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const suggestions = JSON.parse(jsonMatch[0]);
      if (Array.isArray(suggestions) && suggestions.length > 0) {
        return suggestions.slice(0, 5).map((s: any) => String(s).trim());
      }
    }

    return [];
  } catch (error: any) {
    console.error('[GeminiRAG] Error generando sugerencias:', error.message);
    return [];
  }
}

export default {
  generateResponseWithRAG,
  generateResponseWithRAGStream,
  generateConversationTitle,
  generateFollowUpSuggestions,
  verifyGeminiConfig,
  searchDocuments,
  checkVeryRecentTest
};
