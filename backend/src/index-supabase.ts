import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import nodemailer from 'nodemailer';
import { logger } from './utils/logger';
import { getUnifiedRAGService } from './services/ragServiceUnified';
import * as geminiRag from './services/geminiRagService';

// Cargar variables de entorno
dotenv.config(); // Carga .env desde el directorio actual del backend
dotenv.config({ path: '../.env' }); // También intenta cargar desde el directorio padre

console.log('PORT from env:', process.env.PORT); // Debug

const app = express();
const PORT = process.env.PORT || 4000;

// Configurar Supabase
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Función para crear cliente Supabase con token de usuario
const getUserSupabaseClient = (userToken: string) => {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!,
    {
      global: {
        headers: {
          Authorization: `Bearer ${userToken}`
        }
      }
    }
  );
};

// Configurar OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

// Inicializar RAG Service unificado
const ragService = getUnifiedRAGService();

// Pre-calentar cache al iniciar
ragService.warmupCache().catch(err => 
  logger.error('Error pre-calentando cache:', err)
);

// Middleware
app.use(helmet());

// Configuración de CORS para producción y desarrollo
const allowedOrigins = process.env.NODE_ENV === 'production'
  ? [
      process.env.FRONTEND_URL,
      'https://lexia-chatbot.vercel.app',
      'https://lexia.vercel.app',
      // Permitir Teachable específico
      'https://derechovirtual.teachable.com',
      // Patrones wildcard para otras plataformas
      'https://*.teachable.com',
      'https://*.thinkific.com',
      'https://*.kajabi.com',
      'https://*.podia.com'
    ].filter(Boolean)
  : ['http://localhost:3000', 'http://localhost:4000', 'http://localhost:3001', 'http://localhost:3002'];

app.use(cors({
  origin: (origin, callback) => {
    // Permitir requests sin origin (ej: Postman, server-side, webhooks)
    if (!origin) return callback(null, true);

    // Verificar si el origin está en la lista exacta
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    // Verificar si el origin coincide con algún patrón wildcard
    const isAllowedPattern = allowedOrigins.some(pattern => {
      if (pattern && pattern.includes('*')) {
        // Escapar puntos primero, luego reemplazar * con .*
        const escaped = pattern.replace(/\./g, '\\.').replace(/\*/g, '.*');
        const regex = new RegExp(`^${escaped}$`);
        return regex.test(origin);
      }
      return false;
    });

    if (isAllowedPattern) {
      callback(null, true);
    } else {
      // En producción, loggear origins rechazados para debug
      console.log('CORS rechazado para origin:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200
}));

app.use(express.json());

// Agregar compresión para producción (opcional, comentado por ahora)
// if (process.env.NODE_ENV === 'production') {
//   const compression = require('compression');
//   app.use(compression());
// }

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      user?: any;
      userToken?: string;
    }
  }
}

// Middleware de autenticación
const authenticateToken = async (req: any, res: any, next: any) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Token requerido' });
  }

  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) {
      return res.status(403).json({ error: 'Token inválido' });
    }
    req.user = user;
    req.userToken = token; // Guardar el token para usar en operaciones de DB
    next();
  } catch (error) {
    return res.status(403).json({ error: 'Error de autenticación' });
  }
};

// Determinar si usar Gemini o el sistema antiguo
const USE_GEMINI = !!process.env.GEMINI_FILE_STORE_NAME;
logger.info(`🤖 RAG Mode: ${USE_GEMINI ? 'Gemini File Search' : 'Supabase + OpenAI'}`);

// Health check
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    mode: 'supabase-backend',
    ragMode: USE_GEMINI ? 'gemini' : 'supabase',
    version: '1.1.0'
  });
});

// Verificar configuración de Gemini
app.get('/api/gemini/status', async (_req, res) => {
  try {
    const status = await geminiRag.verifyGeminiConfig();
    res.json(status);
  } catch (error: any) {
    res.status(500).json({ ok: false, message: error.message });
  }
});

// Test endpoint para verificar OpenAI
app.get('/test-openai', async (_req, res) => {
  try {
    const startTime = Date.now();
    logger.info('🧪 Iniciando test de OpenAI...');
    
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: 'Responde en una sola línea.' },
        { role: 'user', content: '¿Cuál es la capital de España?' }
      ],
      max_tokens: 50,
      temperature: 0.7
    });
    
    const elapsed = Date.now() - startTime;
    
    res.json({
      success: true,
      responseTime: elapsed,
      response: completion.choices[0].message.content,
      model: completion.model
    });
  } catch (error: any) {
    logger.error('Error en test de OpenAI:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Auth routes
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      res.status(401).json({ error: error.message });
      return;
    }

    res.json({
      user: data.user,
      token: data.session?.access_token,
    });
  } catch (error: any) {
    logger.error('Login error:', error);
    res.status(500).json({ error: 'Error de servidor' });
  }
});

app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name }
      }
    });

    if (error) {
      res.status(400).json({ error: error.message });
      return;
    }

    res.json({
      user: data.user,
      token: data.session?.access_token,
    });
  } catch (error: any) {
    logger.error('Register error:', error);
    res.status(500).json({ error: 'Error de servidor' });
  }
});

app.get('/api/auth/me', authenticateToken, async (req, res) => {
  res.json({ user: req.user });
});

// Conversation routes
app.get('/api/conversations', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const userSupabase = getUserSupabaseClient(req.userToken);
    
    const { data, error } = await userSupabase
      .from('conversations')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false });

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.json({ data });
  } catch (error: any) {
    logger.error('Get conversations error:', error);
    res.status(500).json({ error: 'Error de servidor' });
  }
});

app.post('/api/conversations', authenticateToken, async (req, res) => {
  try {
    const { title, category } = req.body;
    const userId = req.user.id;
    const userSupabase = getUserSupabaseClient(req.userToken);

    const { data, error } = await userSupabase
      .from('conversations')
      .insert({
        title: title || 'Nueva consulta',
        category: category || 'otro',
        user_id: userId,
      })
      .select()
      .single();

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.json({ data });
  } catch (error: any) {
    logger.error('Create conversation error:', error);
    res.status(500).json({ error: 'Error de servidor' });
  }
});

app.get('/api/conversations/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const userSupabase = getUserSupabaseClient(req.userToken);

    // Get conversation
    const { data: conversation, error: convError } = await userSupabase
      .from('conversations')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (convError || !conversation) {
      return res.status(404).json({ error: 'Conversación no encontrada' });
    }

    // Get messages
    const { data: messages, error: msgError } = await userSupabase
      .from('messages')
      .select('*')
      .eq('conversation_id', id)
      .order('created_at', { ascending: true });

    if (msgError) {
      return res.status(500).json({ error: msgError.message });
    }

    res.json({ data: { conversation, messages } });
  } catch (error: any) {
    logger.error('Get conversation error:', error);
    res.status(500).json({ error: 'Error de servidor' });
  }
});

app.put('/api/conversations/:id/title', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { title } = req.body;
    const userId = req.user.id;
    const userSupabase = getUserSupabaseClient(req.userToken);

    const { error } = await userSupabase
      .from('conversations')
      .update({ title })
      .eq('id', id)
      .eq('user_id', userId);

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.json({ success: true });
  } catch (error: any) {
    logger.error('Update conversation title error:', error);
    res.status(500).json({ error: 'Error de servidor' });
  }
});

app.delete('/api/conversations/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const userSupabase = getUserSupabaseClient(req.userToken);

    const { error } = await userSupabase
      .from('conversations')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.json({ success: true });
  } catch (error: any) {
    logger.error('Delete conversation error:', error);
    res.status(500).json({ error: 'Error de servidor' });
  }
});

// Message routes - Versión simple sin RAG para testing
app.post('/api/messages-simple', authenticateToken, async (req, res) => {
  try {
    const startTime = Date.now();
    const { conversationId, content } = req.body;
    const userId = req.user.id;
    const userSupabase = getUserSupabaseClient(req.userToken);

    // Solo verificar conversación y guardar mensaje
    const { data: conversation } = await userSupabase
      .from('conversations')
      .select('*')
      .eq('id', conversationId)
      .eq('user_id', userId)
      .single();

    if (!conversation) {
      return res.status(404).json({ error: 'Conversación no encontrada' });
    }

    // Guardar mensaje del usuario
    const { data: userMessage } = await userSupabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        content,
        role: 'user'
      })
      .select()
      .single();

    // Llamada directa a OpenAI sin RAG ni contexto
    logger.info('🚀 Llamada simple a OpenAI...');
    const aiStart = Date.now();
    
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { 
          role: 'system', 
          content: getLegalSystemPrompt()
        },
        { role: 'user', content }
      ],
      max_tokens: 3500, // Consistente con el endpoint principal
      temperature: 0.7
    });
    
    const aiTime = Date.now() - aiStart;
    logger.info(`✅ OpenAI simple respondió en ${aiTime}ms`);

    // Guardar respuesta
    const { data: assistantMessage } = await userSupabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        content: completion.choices[0].message.content,
        role: 'assistant'
      })
      .select()
      .single();

    const totalTime = Date.now() - startTime;
    logger.info(`✅ Tiempo total (sin RAG): ${totalTime}ms`);

    res.json({
      data: {
        userMessage,
        assistantMessage,
        metrics: { totalTime, aiTime }
      }
    });
  } catch (error: any) {
    logger.error('Error en mensaje simple:', error);
    res.status(500).json({ error: error.message });
  }
});

// Message routes
// Endpoint con streaming para mejor UX
app.post('/api/messages-stream', authenticateToken, async (req, res) => {
  const { conversationId, content } = req.body;
  const userId = req.user.id;
  const userSupabase = getUserSupabaseClient(req.userToken);

  // Configurar Server-Sent Events
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');

  const sendEvent = (type: string, data: any) => {
    res.write(`data: ${JSON.stringify({ type, data })}\n\n`);
  };

  try {
    const totalStartTime = Date.now();

    // Verificar conversación y guardar mensaje del usuario
    const { data: conversation, error: convError } = await userSupabase
      .from('conversations')
      .select('*')
      .eq('id', conversationId)
      .eq('user_id', userId)
      .single();

    if (convError || !conversation) {
      sendEvent('error', { message: 'Conversación no encontrada' });
      return res.end();
    }

    const { data: userMessage } = await userSupabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        content,
        role: 'user'
      })
      .select()
      .single();

    sendEvent('user_message', userMessage);

    // Obtener historial
    const { data: recentMessages } = await userSupabase
      .from('messages')
      .select('content, role')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .limit(15);

    const conversationHistory = recentMessages?.reverse().map(msg => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content,
    })) || [];

    let fullResponse = '';

    // ========== USAR GEMINI FILE SEARCH ==========
    if (USE_GEMINI) {
      sendEvent('status', { message: 'Buscando en documentos...', step: 1, total: 2, estimated: '~2s' });
      sendEvent('status', { message: 'Generando respuesta con IA...', step: 2, total: 2, estimated: '~4s' });

      const result = await geminiRag.generateResponseWithRAGStream(
        content,
        conversationHistory,
        (chunk) => {
          fullResponse += chunk;
          sendEvent('content', { content: chunk, fullContent: fullResponse });
        }
      );

      fullResponse = result.content;
      logger.info(`✅ Gemini File Search completado`);
    }
    // ========== USAR SISTEMA ANTIGUO (OpenAI + Supabase) ==========
    else {
      // PASO 1/3: ANÁLISIS Y CLASIFICACIÓN DE LA PREGUNTA
      sendEvent('status', { message: 'Analizando pregunta...', step: 1, total: 3, estimated: '~2s' });

      // PASO 2/3: BÚSQUEDA RAG HÍBRIDA AVANZADA
      sendEvent('status', { message: 'Buscando información relevante...', step: 2, total: 3, estimated: '~2s' });

      // Usar el pipeline mejorado de 3 pasos
      const { analysis, refinedContext, mainResponse } = await enhancedLegalResponse(
        content,
        '', // Se obtendrá contexto refinado en el pipeline
        conversationHistory,
        conversation.category
      );

      // PASO 3/3: GENERACIÓN DE RESPUESTA ESPECIALIZADA CON STREAMING
      sendEvent('status', { message: 'Generando respuesta especializada...', step: 3, total: 3, estimated: '~6s' });

      for await (const chunk of mainResponse) {
        const chunkContent = chunk.choices[0]?.delta?.content || '';
        if (chunkContent) {
          fullResponse += chunkContent;
          sendEvent('content', { content: chunkContent, fullContent: fullResponse });
        }
      }

      logger.info(`✅ Pipeline OpenAI completado`);
    }

    // Guardar respuesta completa
    const { data: assistantMessage } = await userSupabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        content: fullResponse,
        role: 'assistant'
      })
      .select()
      .single();

    // Generar título automáticamente si es el primer mensaje
    const { data: messageCount } = await userSupabase
      .from('messages')
      .select('id', { count: 'exact' })
      .eq('conversation_id', conversationId);

    if (messageCount && messageCount.length <= 2) {
      // Usar Gemini o OpenAI para generar título
      const newTitle = USE_GEMINI
        ? await geminiRag.generateConversationTitle(content)
        : await generateConversationTitle(content);

      await userSupabase
        .from('conversations')
        .update({ title: newTitle })
        .eq('id', conversationId);

      sendEvent('title_updated', { conversationId, title: newTitle });
    }

    sendEvent('complete', {
      assistantMessage,
      totalTime: Date.now() - totalStartTime
    });

    res.end();

  } catch (error: any) {
    logger.error('Stream error:', error);
    sendEvent('error', { message: error.message });
    res.end();
  }
});

app.post('/api/messages', authenticateToken, async (req, res) => {
  try {
    const totalStartTime = Date.now();
    const { conversationId, content } = req.body;
    const userId = req.user.id;
    const userSupabase = getUserSupabaseClient(req.userToken);

    // Verificar que la conversación pertenece al usuario
    const { data: conversation, error: convError } = await userSupabase
      .from('conversations')
      .select('*')
      .eq('id', conversationId)
      .eq('user_id', userId)
      .single();

    if (convError || !conversation) {
      return res.status(404).json({ error: 'Conversación no encontrada' });
    }

    // Guardar mensaje del usuario
    const { data: userMessage, error: userMsgError } = await userSupabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        content,
        role: 'user'
      })
      .select()
      .single();

    if (userMsgError) {
      return res.status(500).json({ error: userMsgError.message });
    }

    // Obtener historial de mensajes recientes para contexto
    const { data: recentMessages } = await userSupabase
      .from('messages')
      .select('content, role')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .limit(15);

    // Obtener contexto enriquecido con RAG
    const ragContext = await ragService.getEnhancedContext(content, conversation.category);
    
    // Construir el contexto del chat
    const systemPrompt = getLegalSystemPrompt(conversation.category);
    const enhancedSystemPrompt = ragContext 
      ? `${systemPrompt}\n\n=== INFORMACIÓN ESPECÍFICA DE LA BASE DE DATOS ===\n${ragContext}\n=== FIN DE LA INFORMACIÓN ESPECÍFICA ===`
      : systemPrompt;

    const messages = [
      {
        role: 'system' as const,
        content: enhancedSystemPrompt,
      },
      ...recentMessages?.reverse().map(msg => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      })) || [],
    ];

    // Generar respuesta con OpenAI
    let responseContent = 'No se pudo generar una respuesta.';
    
    try {
      const completion = await Promise.race([
        openai.chat.completions.create({
          model: 'gpt-4o', // Forzar modelo más rápido
          messages,
          max_tokens: 3500, // Aumentado para respuestas más completas con análisis detallado
          temperature: 0.7,
          stream: false,
          // Agregar configuración adicional para optimización
          presence_penalty: 0,
          frequency_penalty: 0,
          top_p: 1,
          n: 1
        }),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('OpenAI timeout')), 15000) // Aumentado a 15s para dar más margen
        )
      ]) as any;

      responseContent = completion.choices[0].message.content || 'No se pudo generar una respuesta.';
      
    } catch (openAIError: any) {
      logger.error(`❌ Error de OpenAI:`, openAIError.message);
      throw openAIError;
    }

    // Guardar respuesta del asistente
    const { data: assistantMessage, error: assistantMsgError } = await userSupabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        content: responseContent,
        role: 'assistant'
      })
      .select()
      .single();

    if (assistantMsgError) {
      return res.status(500).json({ error: assistantMsgError.message });
    }

    // Actualizar timestamp de conversación
    await userSupabase
      .from('conversations')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', conversationId);

    const totalTime = Date.now() - totalStartTime;
    logger.info(`✅ Tiempo total de respuesta: ${totalTime}ms`);

    res.json({
      data: {
        userMessage,
        assistantMessage,
        totalTime
      }
    });
  } catch (error: any) {
    logger.error('Send message error:', error);
    
    // Dar más información sobre el tipo de error
    let errorMessage = 'Error al generar respuesta';
    if (error.message === 'OpenAI timeout') {
      errorMessage = 'La IA tardó demasiado en responder. Intenta de nuevo.';
    } else if (error.response?.status === 401) {
      errorMessage = 'Error de autenticación con OpenAI';
    } else if (error.response?.status === 429) {
      errorMessage = 'Límite de uso de OpenAI alcanzado';
    } else if (error.code === 'insufficient_quota') {
      errorMessage = 'Cuota de OpenAI agotada';
    }
    
    res.status(500).json({ 
      error: errorMessage,
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

app.get('/api/messages/search', authenticateToken, async (req, res) => {
  try {
    const { q: query, conversationId } = req.query;
    const userId = req.user.id;

    let searchQuery = supabase
      .from('messages')
      .select(`
        *,
        conversations!inner(user_id)
      `)
      .eq('conversations.user_id', userId)
      .ilike('content', `%${query}%`);

    if (conversationId) {
      searchQuery = searchQuery.eq('conversation_id', conversationId);
    }

    const { data, error } = await searchQuery.order('created_at', { ascending: false });

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.json({ data });
  } catch (error: any) {
    logger.error('Search messages error:', error);
    res.status(500).json({ error: 'Error de servidor' });
  }
});

// Endpoint para generar respuestas del chat (legacy)
app.post('/api/chat/generate', authenticateToken, async (req, res) => {
  try {
    const { conversationId, message, category } = req.body;
    const userId = req.user.id;

    // Verificar que la conversación pertenece al usuario
    const { data: conversation, error: convError } = await supabase
      .from('conversations')
      .select('*')
      .eq('id', conversationId)
      .eq('user_id', userId)
      .single();

    if (convError || !conversation) {
      return res.status(404).json({ error: 'Conversación no encontrada' });
    }

    // Obtener historial de mensajes recientes para contexto
    const { data: recentMessages } = await supabase
      .from('messages')
      .select('content, role')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .limit(15);

    // Construir el contexto del chat
    const messages = [
      {
        role: 'system' as const,
        content: getLegalSystemPrompt(category),
      },
      ...recentMessages?.reverse().map(msg => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      })) || [],
      {
        role: 'user' as const,
        content: message,
      },
    ];

    // Generar respuesta con OpenAI con timeout
    const completion = await Promise.race([
      openai.chat.completions.create({
        model: process.env.OPENAI_MODEL || 'gpt-4o',
        messages,
        max_tokens: 1500,
        temperature: 0.7,
      }),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('OpenAI timeout')), 25000)
      )
    ]) as any;

    const responseContent = completion.choices[0].message.content || 'No se pudo generar una respuesta.';

    // Generar título automáticamente si es el primer mensaje
    const { data: messageCount } = await supabase
      .from('messages')
      .select('id', { count: 'exact' })
      .eq('conversation_id', conversationId);

    if (messageCount && messageCount.length <= 2) { // Usuario + asistente = primer intercambio
      const newTitle = await generateConversationTitle(message);
      await supabase
        .from('conversations')
        .update({ title: newTitle })
        .eq('id', conversationId);
    }

    res.json({
      content: responseContent,
      model: completion.model,
      tokens: completion.usage?.total_tokens,
    });
  } catch (error: any) {
    logger.error('Error generando respuesta:', error);
    
    // Dar más información sobre el tipo de error
    let errorMessage = 'Error al generar respuesta';
    if (error.message === 'OpenAI timeout') {
      errorMessage = 'La IA tardó demasiado en responder. Intenta de nuevo.';
    } else if (error.response?.status === 401) {
      errorMessage = 'Error de autenticación con OpenAI';
    } else if (error.response?.status === 429) {
      errorMessage = 'Límite de uso de OpenAI alcanzado';
    } else if (error.code === 'insufficient_quota') {
      errorMessage = 'Cuota de OpenAI agotada';
    }
    
    res.status(500).json({ 
      error: errorMessage,
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// RAG endpoints
app.post('/api/rag/process-documents', authenticateToken, async (req, res) => {
  try {
    // Solo permitir a administradores (puedes ajustar esta lógica)
    if (!req.user.email?.includes('admin')) {
      return res.status(403).json({ error: 'Solo administradores pueden procesar documentos' });
    }

    // Este endpoint no está implementado en el servicio unificado
    // ya que los documentos ya están procesados en Supabase
    res.json({ 
      message: 'Los documentos ya están procesados en la base de datos',
      info: 'Use el endpoint /api/rag/stats para ver estadísticas'
    });
  } catch (error: any) {
    logger.error('Error procesando documentos:', error);
    res.status(500).json({ error: 'Error procesando documentos' });
  }
});

app.get('/api/rag/stats', authenticateToken, async (_req, res) => {
  try {
    const stats = await ragService.getDocumentStats();
    res.json({ data: stats });
  } catch (error: any) {
    logger.error('Error obteniendo estadísticas:', error);
    res.status(500).json({ error: 'Error obteniendo estadísticas' });
  }
});

app.post('/api/rag/search', authenticateToken, async (req, res) => {
  try {
    const { query, threshold = 0.8, limit = 5 } = req.body;
    
    if (!query) {
      return res.status(400).json({ error: 'Query requerido' });
    }

    const results = await ragService.searchRelevantDocuments(query, threshold, limit);
    res.json({ data: results });
  } catch (error: any) {
    logger.error('Error en búsqueda RAG:', error);
    res.status(500).json({ error: 'Error en búsqueda' });
  }
});

// Función para generar títulos de conversación
async function generateConversationTitle(firstMessage: string): Promise<string> {
  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'Genera un título corto y descriptivo (máximo 6 palabras) para una conversación sobre derecho que empezó con este mensaje. Solo devuelve el título, nada más.'
        },
        {
          role: 'user',
          content: firstMessage
        }
      ],
      max_tokens: 50,
      temperature: 0.3
    });

    return completion.choices[0].message.content?.trim() || 'Nueva consulta legal';
  } catch (error) {
    logger.error('Error generando título:', error);
    return 'Nueva consulta legal';
  }
}

// Pipeline de llamadas especializadas para mayor precisión
async function enhancedLegalResponse(userQuestion: string, context: string, conversationHistory: any[], category?: string) {
  try {
    logger.info('🔄 Iniciando pipeline de respuesta mejorada...');
    
    // LLAMADA 1: Análisis y clasificación de la pregunta
    logger.info('📊 Paso 1/4: Analizando y clasificando la pregunta...');
    
    const analysis = await analyzeUserQuestion(userQuestion);
    logger.info(`✅ Análisis: ${analysis.tipo}, complejidad: ${analysis.complejidad}`);

    // LLAMADA 2: Refinamiento de contexto RAG
    logger.info('🔍 Paso 2/4: Refinando búsqueda con análisis...');
    const refinedContext = await ragService.getEnhancedContextWithKeywords(
      userQuestion, 
      analysis.keywords_busqueda || [], 
      category,
      analysis
    );

    // LLAMADA 3: Generación de respuesta especializada
    logger.info('⚡ Paso 3/3: Generando respuesta especializada...');
    const responsePrompt = getSpecializedPrompt(analysis.tipo, category);
    const fullContext = refinedContext || context;
    
    
    const enhancedPrompt = fullContext 
      ? `${responsePrompt}\n\n=== INFORMACIÓN ESPECÍFICA DE LA BASE DE DATOS ===\n${fullContext}\n=== FIN DE LA INFORMACIÓN ESPECÍFICA ===`
      : responsePrompt;

    const messages = [
      { role: 'system' as const, content: enhancedPrompt },
      ...conversationHistory,
      { role: 'user' as const, content: userQuestion }
    ];

    const mainResponse = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages,
      max_tokens: 4000,
      temperature: 0.3,
      stream: true
    });

    // LLAMADA 4: Generación de modo estudio contextual (será llamada después)
    return { analysis, refinedContext: fullContext, mainResponse };

  } catch (error) {
    logger.error('Error en pipeline mejorado:', error);
    throw error;
  }
}

// Función para generar modo estudio basado en la respuesta anterior

// Función unificada para obtener el prompt legal (elimina duplicación)
function getUnifiedLegalPrompt(includeAvailableSources: boolean = false): string {
  const basePrompt = `Eres LexAI, un asistente legal especializado en oposiciones de justicia con el estilo de Carlos Rivero (Derecho Virtual). Tienes acceso a leyes españolas y materiales de clase. Tu forma de hablar es coloquial, directa, amigable y retadora, como un compañero que domina la materia.

**INSTRUCCIONES PARA RESPONDER:**

1. **ANALIZA EL CONTEXTO:** Revisa cuidadosamente los chunks encontrados y el historial de conversación para entender exactamente qué te está preguntando el usuario.

2. **ESTILO CARLOS RIVERO - COLEGUEO Y RIGOR:** 
   - **INICIO POSITIVO COLOQUIAL:** Comienza con expresiones naturales como "¡Vale, perfecto!", "¡Mira, genial pregunta!", "¡A ver, esto me encanta!", "¡Oye, qué buena pregunta!", "Vale, colega, te explico esto"
   - **CONECTORES COLOQUIALES:** Usa expresiones naturales como "Mira", "Vale", "A ver", "En resumen", "Oye", "Fíjate", "Por cierto", "Venga"
   - **REFORZADORES DE CLARIDAD:** "Esto quiero que lo tengas clarísimo", "La clave está en...", "Aquí viene lo importante", "No te líes con esto", "Fíjate bien en esto"
   - **LENGUAJE COLEGUEO:** "Tío/tía", "chaval", "compañero/a", "amigo/a" (usado con moderación y naturalidad)
   - **RETOS AL APRENDIZAJE:** "A ver si eres capaz de...", "Te reto a que...", "¿Serías capaz de distinguir...?", "Ponte a prueba"
   - **EXPRESIONES DE ÁNIMO:** "¡Venga, que esto lo tienes!", "¡Dale caña!", "¡A por ello!", "¡Que no decaiga!"
   - **CONFIRMACIONES COLOQUIALES:** "¿Vale?", "¿Me sigues?", "¿Lo pillas?", "¿Está claro?"
   - **USA EMOJIS ESTRATÉGICAMENTE:** Incluye 8-12 emojis relevantes por respuesta:
     * **FORMATO TÍTULOS:** Siempre pon el emoji ANTES del título: "📋 Medidas Clave", "⚖️ Marco Legal"
     * Marca puntos clave con ✅ ⚠️ 📌 🎯 
     * Señala conceptos con 💡 🔍 📖 
     * Añade calidez con 😊 cuando sea apropiado
   - **TONO DIRECTO Y AMIGABLE:** Como si fueras un compañero que domina la materia y quiere que el otro también la domine
   - Usa viñetas, listas y secciones cuando ayuden a la comprensión
   - Sé extenso y detallado si la pregunta lo requiere
   - Divide en secciones claras cuando el tema sea complejo
   - Responde de forma clara señalando puntos importantes

3. **🔥 CITA LA INFORMACIÓN RELEVANTE - MUY IMPORTANTE:**
   - **🚨 OBLIGATORIO ABSOLUTO:** Usa blockquotes (>) para citar textualmente CUALQUIER contenido fundamental de la base de datos
   - **📋 SIEMPRE incluye en blockquotes:** artículos legales, definiciones, conceptos clave, procedimientos específicos, texto legal
   - **Ejemplos OBLIGATORIOS:** 
     * > **Artículo 15.** El texto exacto del artículo...
     * > **Definición:** La independencia judicial significa...
     * > **Procedimiento:** Los magistrados del TC se eligen...
     * > **Concepto clave:** [Cualquier definición o concepto importante]
   - **🎯 REGLA DE ORO:** Si el contenido viene de la base de datos y es importante, SIEMPRE debe ir en blockquote
   - **⚠️ CRÍTICO:** No parafrasees contenido legal importante, cítalo textualmente

4. **ESTILO CONVERSACIONAL CARLOS RIVERO:**
   - **PRIMERA PREGUNTA:** Si es una primera pregunta, explica directamente con "Vale, mira, te explico esto fácil" o "A ver, vamos por partes"
   - **CONTINUACIÓN:** Si es continuación de una conversación, conecta con lo anterior usando "Vale, siguiendo con lo que hablábamos...", "Oye, por cierto, sobre lo que me preguntaste antes...", "Mira, enlazando con lo anterior..."
   - **NATURALIDAD:** Habla como si estuvieras tomando un café explicando el tema a un compañero
   - **PREGUNTAS RETÓRICAS:** Intercala preguntas como "¿Y sabes por qué es así?", "¿Te imaginas lo que pasaría si...?", "¿Lo pillas?"
   - **EXPERIENCIAS COMPARTIDAS:** "Esto que te va a salir seguro en el examen", "Fíjate que aquí hay trampa", "Esto me lo preguntaron a mí también"

**🚨 REGLAS CRÍTICAS - OBLIGATORIAS:**
- ❗ CRITICAL: Si ves "=== INFORMACIÓN ESPECÍFICA DE LA BASE DE DATOS ===" al final de este mensaje, DEBES usar esa información
- 🔥 **BLOCKQUOTES OBLIGATORIOS:** Cita TEXTUALMENTE usando blockquotes (>) TODO contenido clave de la base de datos
- 🔥 **BLOCKQUOTES OBLIGATORIOS:** Usa blockquotes para artículos, definiciones, conceptos y procedimientos importantes  
- 🔥 **BLOCKQUOTES OBLIGATORIOS:** NUNCA parafrasees texto legal importante, siempre cítalo en blockquote
- ❗ OBLIGATORIO: Si hay información específica disponible sobre el tema, ÚSALA siempre
- 📋 **MÍNIMO:** Cada respuesta debe tener AL MENOS 1-3 blockquotes con contenido de la base de datos
- 🎓 **TIPS DE ESTUDIO CONTEXTUALES:** Incluye una sección con tips específicos cuando sea relevante:
  * Para artículos legales: memorización literal, conexiones con otros artículos
  * Para conceptos complejos: técnicas de diferenciación, casos prácticos
  * Para temas con preguntas trampa: advertencias sobre errores comunes
  * Para temas de oposición: estrategias de repaso y puntos clave de examen
  * FORMATO: "**🎓 Tips para el examen:** [tips concretos y específicos]"
  * POSICIÓN: Los tips van ANTES de la pregunta de modo estudio
- 📚 **MODO ESTUDIO OBLIGATORIO - ENFOCADO EN EXAMEN:** AL FINAL de tu respuesta (DESPUÉS de los tips si los hay), agrega EXACTAMENTE este formato:
  * Línea con "---"
  * Línea vacía
  * Una pregunta ENFOCADA EN EXAMEN con alguna de estas opciones (elige la más relevante):
    - "**📚 ¿Quieres que te diga los 3 errores más frecuentes que cometen los opositores con [tema específico]?**"
    - "**📚 ¿Quieres que te haga una pregunta tipo examen complicada sobre [tema específico] para ver si lo superas?**"
    - "**📚 ¿Quieres que te explique los 2 trucos que usan en el examen para confundirte con [tema específico]?**"
    - "**📚 ¿Quieres que te diga los 3 detalles clave de [tema específico] que la mayoría de opositores fallan?**"
    - "**📚 ¿Quieres que te prepare las preguntas trampa típicas sobre [tema específico]?**"
    - "**📚 ¿Quieres que te entrene con casos prácticos difíciles de [tema específico] como los del examen?**"
    - "**📚 ¿Te reto a que me digas las diferencias entre [concepto A] y [concepto B] sin mirar, a ver si lo dominas?**"
    - "**📚 ¿Quieres que te ponga a prueba con las excepciones de [tema específico] que siempre caen en el examen?**"
    - "**📚 ¿Quieres saber el dato exacto de [tema específico] que el 80% falla en el examen?**"
  * NUNCA uses preguntas genéricas como "¿Quieres que te explique más sobre...?"
  * SIEMPRE enfoca en errores, trampas, detalles que fallan o práctica de examen
  * IMPORTANTE: Esta pregunta SIEMPRE va al final, después de todo lo demás
- PRIORIZA SIEMPRE la información de los chunks de la base de datos para responder
- Responde específicamente a lo que se te pregunta siendo extenso si es necesario

**🔴 INSTRUCCIÓN CRÍTICA SOBRE CONTEXTO LEGAL:**
AL FINAL DE ESTE MENSAJE ENCONTRARÁS UNA SECCIÓN "=== INFORMACIÓN ESPECÍFICA DE LA BASE DE DATOS ===". 
SI ESA SECCIÓN ESTÁ PRESENTE:
1. DEBES leerla completamente
2. DEBES usar esa información para responder
3. DEBES citar textualmente los artículos relevantes usando blockquotes (>)
4. ESA INFORMACIÓN fue seleccionada ESPECÍFICAMENTE para responder tu pregunta`;

  const sourcesSection = includeAvailableSources 
    ? `\n\n**FUENTES DISPONIBLES:** 
Tienes acceso a 6 leyes (Ley 3/2007, Ley 50/1997, LEC, LECrim, LRC, TRLC), 19 temas de clases sobre constitución, derechos, gobierno, poder judicial, etc., y preguntas trampa con puntos clave, advertencias importantes y errores comunes en oposiciones.`
    : '';

  return `${basePrompt}${sourcesSection}

**OBJETIVO:** Que el usuario sienta que está hablando con Carlos Rivero, un compañero experto en derecho que explica las cosas de forma coloquial, directa y retadora, manteniendo todo el rigor académico pero con un trato cercano y amigable.`;
}

// Función para obtener prompts especializados (ahora usa la unificada)
function getSpecializedPrompt(queryType: string, category?: string): string {
  return getUnifiedLegalPrompt(false); // Sin fuentes duplicadas
}

// Función para obtener el prompt del sistema (ahora usa la unificada)
function getLegalSystemPrompt(_category?: string): string {
  return getUnifiedLegalPrompt(true); // Con lista de fuentes
}

// Función separada para análisis de preguntas (elimina duplicación)
async function analyzeUserQuestion(userQuestion: string): Promise<any> {
  const analysisPrompt = `Analiza esta pregunta legal y clasifícala:

PREGUNTA: "${userQuestion}"

FUENTES DISPONIBLES EN LA BASE DE DATOS:

LEYES:
- LEC (Ley de Enjuiciamiento Civil)
- LECrim (Ley de Enjuiciamiento Criminal)  
- TRLC (Texto Refundido Ley Concursal)
- Ley 3/2007 (Ley de Igualdad)
- Ley 50/1997 (Ley del Gobierno)
- LRC (Ley del Registro Civil)

TEMAS DE CLASES:
- Tema 1: Constitución Española (derechos fundamentales, artículos 15-29)
- Tema 2: Derechos Humanos (discriminación, igualdad de trato)
- Tema 3: Gobierno y Administración
- Tema 4: Organización Territorial del Estado
- Tema 5: Unión Europea
- Tema 6: Poder Judicial (independencia, organización, CGPJ)
- Tema 12: LOTC (Tribunal Constitucional, magistrados)
- Tema 16: Libertad Sindical
- Tema 17-19: Proceso Civil
- Tema 28-30: Procesos Matrimoniales (competencia, divorcio, nulidad)
- Tema 68: Concurso de Acreedores

PREGUNTAS TRAMPA Y PUNTOS CLAVE:
- Tema 1: Constitución Española (puntos clave, trampas comunes, reglas mnemotécnicas)
- Tema 12: LOTC (puntos clave del Tribunal Constitucional, advertencias importantes)

IMPORTANTE: 
- Si la pregunta trata sobre CONCEPTOS → busca en CLASES
- Si pide ARTÍCULOS ESPECÍFICOS → busca en LEYES  
- Si busca PUNTOS CLAVE, ADVERTENCIAS, TRAMPAS COMUNES → busca en PREGUNTAS TRAMPA
- Si pregunta sobre "cuidado", "recordar", "diferencias", "confundir" → incluye PREGUNTAS TRAMPA

Responde SOLO en formato JSON:
{
  "tipo": "articulo_especifico|concepto_general|caso_practico|procedimiento|comparacion",
  "area_legal": "civil|penal|administrativo|constitucional|laboral|otro",
  "elementos_clave": ["elemento1", "elemento2", "elemento3"],
  "complejidad": "baja|media|alta",
  "requiere_articulos": true/false,
  "keywords_busqueda": ["keyword1", "keyword2", "keyword3"],
  "detected_law": "LEC|LECrim|TRLC|Ley 3/2007|Ley 50/1997|LRC|null",
  "article_number": "número del artículo si se menciona o null",
  "topic_numbers": [1, 2, 3, 4, 5, 6, 12, 16, 17, 18, 19, 28, 29, 30, 68],
  "document_type": "law|class|trap|both",
  "legal_references": ["referencias a artículos o leyes mencionadas"]
}`;

  try {
    const analysisResponse = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: analysisPrompt }],
      max_tokens: 300,
      temperature: 0.1
    });

    // Limpiar respuesta de OpenAI (quitar markdown y espacios)
    let jsonContent = analysisResponse.choices[0].message.content || '{}';
    jsonContent = jsonContent.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    
    return JSON.parse(jsonContent);
  } catch (error) {
    logger.error('❌ Error parseando JSON de análisis:', error);
    return { tipo: 'concepto_general', complejidad: 'media', keywords_busqueda: [] };
  }
}

// ============ TESTING ENDPOINTS (NO AUTH) ============
// Endpoint temporal para testing chat sin autenticación
app.post('/api/test-chat', async (req, res) => {
  try {
    const { message } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: 'Message requerido' });
    }
    
    // Generar contexto usando RAG
    const context = await ragService.getEnhancedContext(message);
    
    // Crear sistema prompt con contexto incluido
    const systemPrompt = context 
      ? `${getLegalSystemPrompt()}\n\n=== INFORMACIÓN ESPECÍFICA DE LA BASE DE DATOS ===\n${context}\n=== FIN DE LA INFORMACIÓN ESPECÍFICA ===`
      : getLegalSystemPrompt();

    // Generar respuesta
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: message }
      ],
      max_tokens: 2000,
      temperature: 0.3
    });

    const response = completion.choices[0].message.content || 'No se pudo generar respuesta';

    res.json({
      success: true,
      message: response,
      hasContext: context.length > 0,
      contextLength: context.length
    });
  } catch (error: any) {
    logger.error('Error en test chat:', error);
    res.status(500).json({ 
      success: false,
      error: 'Error en chat test',
      details: error.message 
    });
  }
});

// Endpoint para mensajes de invitados (sin autenticación)
app.post('/api/guest-message', async (req, res) => {
  try {
    const { content, messages = [] } = req.body;
    
    if (!content) {
      return res.status(400).json({ error: 'Contenido del mensaje requerido' });
    }

    logger.info(`👤 Guest message: "${content}"`);
    
    // Obtener contexto RAG
    const context = await ragService.getEnhancedContext(content);
    
    // Preparar historial de mensajes
    const chatMessages = [
      {
        role: 'system' as const,
        content: getLegalSystemPrompt()
      },
      ...messages.map((msg: any) => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content
      })),
      {
        role: 'user' as const,
        content: context ? `${context}\n\n${content}` : content
      }
    ];

    // Generar respuesta
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: chatMessages,
      max_tokens: 2000,
      temperature: 0.3
    });

    const response = completion.choices[0].message.content || 'No se pudo generar respuesta';

    res.json({
      success: true,
      response
    });
  } catch (error) {
    logger.error('Error processing guest message:', error);
    res.status(500).json({ error: 'Error al procesar el mensaje' });
  }
});

// Endpoint para obtener cursos del usuario desde Teachable
app.get('/api/get-user-courses', async (req, res) => {
  try {
    const { userId, userEmail } = req.query;

    if (!userId && !userEmail) {
      return res.status(400).json({ error: 'Se requiere userId o userEmail', courses: [] });
    }

    const TEACHABLE_API_KEY = process.env.TEACHABLE_API_KEY;

    if (!TEACHABLE_API_KEY) {
      logger.warn('TEACHABLE_API_KEY no configurada');
      return res.status(200).json({ courses: [], error: 'API key no configurada' });
    }

    logger.info(`📚 Consultando cursos para usuario: ${userId || userEmail}`);

    // Llamar a Teachable API
    const teachableUrl = `https://developers.teachable.com/v1/users/${userId}`;
    const teachableResponse = await fetch(teachableUrl, {
      headers: {
        'apiKey': TEACHABLE_API_KEY,
        'Accept': 'application/json'
      }
    });

    if (!teachableResponse.ok) {
      logger.error(`Error de Teachable API: ${teachableResponse.status}`);
      return res.status(200).json({ courses: [] });
    }

    const userData = await teachableResponse.json() as any;
    const allCourses = userData.courses || [];

    // Filtrar solo cursos activos y mapear a formato simplificado
    const activeCourses = allCourses
      .filter((c: any) => c.is_active_enrollment === true)
      .map((c: any) => ({
        courseId: c.course_id?.toString() || '',
        courseName: c.course_name || 'Curso sin nombre',
        category: getCourseCategory(c.course_name || '')
      }));

    logger.info(`✅ Usuario tiene ${activeCourses.length} cursos activos`);

    return res.status(200).json({ courses: activeCourses });

  } catch (error: any) {
    logger.error('Error obteniendo cursos:', error);
    return res.status(200).json({ courses: [], error: error.message });
  }
});

// Endpoint para obtener el nombre de un curso por su ID
app.get('/api/get-course-name', async (req, res) => {
  try {
    const { courseId } = req.query;

    if (!courseId) {
      return res.status(400).json({ error: 'Se requiere courseId', courseName: '' });
    }

    const TEACHABLE_API_KEY = process.env.TEACHABLE_API_KEY;

    if (!TEACHABLE_API_KEY) {
      logger.warn('TEACHABLE_API_KEY no configurada');
      return res.status(200).json({ courseName: '', error: 'API key no configurada' });
    }

    logger.info(`📚 Consultando nombre del curso: ${courseId}`);

    // Llamar a Teachable API para obtener info del curso
    const teachableUrl = `https://developers.teachable.com/v1/courses/${courseId}`;
    const teachableResponse = await fetch(teachableUrl, {
      headers: {
        'apiKey': TEACHABLE_API_KEY,
        'Accept': 'application/json'
      }
    });

    if (!teachableResponse.ok) {
      logger.error(`Error de Teachable API: ${teachableResponse.status}`);
      return res.status(200).json({ courseName: '' });
    }

    const courseData = await teachableResponse.json() as any;

    // Intentar diferentes estructuras posibles
    let courseName = courseData.name
      || courseData.course_name
      || courseData.course?.name
      || courseData.data?.name
      || courseData.heading
      || courseData.title
      || '';

    // Formatear el nombre: quitar espacios extra y convertir a título
    if (courseName) {
      courseName = courseName.trim();
      // Convertir de MAYÚSCULAS a Título (Primera Letra Mayúscula)
      if (courseName === courseName.toUpperCase()) {
        courseName = courseName.toLowerCase().replace(/\b\w/g, (c: string) => c.toUpperCase());
      }
    }

    logger.info(`✅ Nombre del curso ${courseId}: ${courseName}`);

    return res.status(200).json({ courseName });

  } catch (error: any) {
    logger.error('Error obteniendo nombre del curso:', error);
    return res.status(200).json({ courseName: '', error: error.message });
  }
});

// Función para determinar la categoría del curso basada en el nombre
function getCourseCategory(courseName: string): string {
  const name = courseName.toLowerCase();
  if (name.includes('gestión') || name.includes('gestion')) return 'Gestión Procesal';
  if (name.includes('tramitación') || name.includes('tramitacion')) return 'Tramitación Procesal';
  if (name.includes('auxilio')) return 'Auxilio Judicial';
  if (name.includes('penitenciaria') || name.includes('iipp')) return 'Instituciones Penitenciarias';
  if (name.includes('constitución') || name.includes('constitucion')) return 'Constitución Española';
  if (name.includes('igualdad')) return 'Leyes de Igualdad';
  if (name.includes('procedimiento administrativo') || name.includes('39/2015')) return 'Procedimiento Administrativo';
  return 'General';
}

// Endpoint para mensajes de invitados con streaming
// Endpoint para widget embebido (sin límite de preguntas)
app.post('/api/widget-message-stream', async (req, res) => {
  try {
    const { content, messages = [], userName, userCourses = [], userId } = req.body;

    if (!content) {
      return res.status(400).json({ error: 'Contenido del mensaje requerido' });
    }

    const coursesInfo = userCourses.length > 0 ? `(${userCourses.length} cursos)` : '';
    logger.info(`🔧 Widget message stream: "${content}" ${userName ? `(Usuario: ${userName})` : ''} ${userId ? `[ID: ${userId}]` : ''} ${coursesInfo}`);

    // Obtener preguntas recientes del usuario si tiene userId
    let recentQuestions: any[] = [];
    if (userId) {
      try {
        recentQuestions = await geminiRag.getUserRecentQuestions(userId);
        if (recentQuestions.length > 0) {
          logger.info(`📊 Encontradas ${recentQuestions.length} preguntas recientes para el usuario`);
        }
      } catch (err) {
        logger.warn('No se pudieron obtener preguntas recientes:', err);
      }
    }

    // Configurar Server-Sent Events
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');

    const sendEvent = (type: string, data: any) => {
      res.write(`data: ${JSON.stringify({ type, data })}\n\n`);
    };

    const totalStartTime = Date.now();

    // Obtener historial de mensajes
    const conversationHistory = messages.slice(-8).map((msg: any) => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content,
    }));

    let fullResponse = '';

    // ========== USAR GEMINI FILE SEARCH ==========
    if (USE_GEMINI) {
      sendEvent('status', { message: 'Buscando en documentos...', step: 1, total: 2, estimated: '~2s' });
      sendEvent('status', { message: 'Generando respuesta con IA...', step: 2, total: 2, estimated: '~4s' });

      const result = await geminiRag.generateResponseWithRAGStream(
        content,
        conversationHistory,
        (chunk) => {
          fullResponse += chunk;
          sendEvent('content', { content: chunk, fullContent: fullResponse });
        },
        { userName, userCourses, recentQuestions } // Pasar nombre, cursos y preguntas recientes
      );

      fullResponse = result.content;
    }
    // ========== USAR SISTEMA ANTIGUO ==========
    else {
      sendEvent('status', { message: 'Analizando pregunta...', step: 1, total: 3, estimated: '~2s' });
      sendEvent('status', { message: 'Buscando información relevante...', step: 2, total: 3, estimated: '~2s' });

      const { analysis, refinedContext, mainResponse } = await enhancedLegalResponse(
        content,
        '',
        conversationHistory,
        'general'
      );

      sendEvent('status', { message: 'Generando respuesta especializada...', step: 3, total: 3, estimated: '~6s' });

      for await (const chunk of mainResponse) {
        const chunkContent = chunk.choices[0]?.delta?.content || '';
        if (chunkContent) {
          fullResponse += chunkContent;
          sendEvent('content', { content: chunkContent, fullContent: fullResponse });
        }
      }
    }

    const totalTime = Date.now() - totalStartTime;
    logger.info(`✅ Widget completado: ${totalTime}ms (${USE_GEMINI ? 'Gemini' : 'OpenAI'})`);

    sendEvent('done', { fullContent: fullResponse });
    res.end();

  } catch (error: any) {
    logger.error('Widget stream error:', error);
    res.write(`data: ${JSON.stringify({ type: 'error', data: { message: 'Error procesando la consulta' } })}\n\n`);
    res.end();
  }
});

// Endpoint separado para generar sugerencias de follow-up
app.post('/api/generate-suggestions', async (req, res) => {
  try {
    const { userQuestion, assistantResponse } = req.body;

    if (!userQuestion || !assistantResponse) {
      return res.status(400).json({ suggestions: [] });
    }

    const suggestions = await geminiRag.generateFollowUpSuggestions(userQuestion, assistantResponse);
    res.json({ suggestions });
  } catch (error: any) {
    logger.warn('[Suggestions] Error:', error.message);
    res.json({ suggestions: [] });
  }
});

app.post('/api/guest-message-stream', async (req, res) => {
  try {
    const { content, messages = [] } = req.body;

    if (!content) {
      return res.status(400).json({ error: 'Contenido del mensaje requerido' });
    }

    logger.info(`👤 Guest message stream: "${content}"`);

    // Configurar Server-Sent Events
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');

    const sendEvent = (type: string, data: any) => {
      res.write(`data: ${JSON.stringify({ type, data })}\n\n`);
    };

    const totalStartTime = Date.now();

    // Obtener historial de mensajes
    const conversationHistory = messages.slice(-8).map((msg: any) => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content,
    }));

    let fullResponse = '';

    // ========== USAR GEMINI FILE SEARCH ==========
    if (USE_GEMINI) {
      sendEvent('status', { message: 'Buscando en documentos...', step: 1, total: 2, estimated: '~2s' });
      sendEvent('status', { message: 'Generando respuesta con IA...', step: 2, total: 2, estimated: '~4s' });

      const result = await geminiRag.generateResponseWithRAGStream(
        content,
        conversationHistory,
        (chunk) => {
          fullResponse += chunk;
          sendEvent('content', { content: chunk, fullContent: fullResponse });
        }
      );

      fullResponse = result.content;
    }
    // ========== USAR SISTEMA ANTIGUO ==========
    else {
      sendEvent('status', { message: 'Analizando pregunta...', step: 1, total: 3, estimated: '~2s' });
      sendEvent('status', { message: 'Buscando información relevante...', step: 2, total: 3, estimated: '~2s' });

      const { analysis, refinedContext, mainResponse } = await enhancedLegalResponse(
        content,
        '',
        conversationHistory,
        'general'
      );

      sendEvent('status', { message: 'Generando respuesta especializada...', step: 3, total: 3, estimated: '~6s' });

      for await (const chunk of mainResponse) {
        const chunkContent = chunk.choices[0]?.delta?.content || '';
        if (chunkContent) {
          fullResponse += chunkContent;
          sendEvent('content', { content: chunkContent, fullContent: fullResponse });
        }
      }
    }

    const totalTime = Date.now() - totalStartTime;
    logger.info(`✅ Guest completado: ${totalTime}ms (${USE_GEMINI ? 'Gemini' : 'OpenAI'})`);

    sendEvent('done', { fullContent: fullResponse });
    res.end();

  } catch (error) {
    logger.error('Error in guest message stream:', error);
    res.write(`data: ${JSON.stringify({ type: 'error', data: 'Error al procesar el mensaje' })}\n\n`);
    res.end();
  }
});

// Endpoint para testing RAG sin autenticación
app.post('/api/test-rag', async (req, res) => {
  try {
    const { query, threshold = 0.2, limit = 5 } = req.body;
    
    if (!query) {
      return res.status(400).json({ error: 'Query requerido' });
    }

    logger.info(`🧪 Test RAG Query: "${query}"`);
    
    // Buscar documentos relevantes
    const relevantDocs = await ragService.searchRelevantDocuments(query, threshold, limit);
    
    // Generar contexto
    const context = await ragService.getEnhancedContext(query);
    
    // Crear mensaje con contexto para OpenAI
    const messages = [
      {
        role: 'system' as const,
        content: getLegalSystemPrompt()
      },
      {
        role: 'user' as const,
        content: context ? `${context}\n\n${query}` : query
      }
    ];

    // Generar respuesta
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages,
      max_tokens: 2000,
      temperature: 0.3
    });

    const response = completion.choices[0].message.content || 'No se pudo generar respuesta';

    res.json({
      success: true,
      query,
      relevantDocs: relevantDocs.length,
      contextLength: context.length,
      hasContext: context.length > 0,
      response,
      debug: {
        docsFound: relevantDocs.map(doc => ({
          law: doc.law_name,
          article: doc.article_number,
          similarity: doc.similarity,
          method: doc.search_method,
          preview: doc.content.substring(0, 100)
        })),
        contextPreview: context.substring(0, 200)
      }
    });
  } catch (error: any) {
    logger.error('Error en test RAG:', error);
    res.status(500).json({ 
      success: false,
      error: 'Error en test RAG',
      details: error.message 
    });
  }
});

// ============================================================
// SISTEMA DE MENSAJES PROACTIVOS - LECCIONES COMPLETADAS
// ============================================================

// Variaciones de mensajes proactivos (15-20 mensajes diferentes)
const PROACTIVE_MESSAGES = [
  "¿Qué tal te ha parecido la clase de {leccion}? ¿Quieres que te cuente lo que SÍ o SÍ cae siempre en el examen?",
  "¡Genial! Has completado {leccion}. ¿Te hago un resumen de los puntos clave que debes memorizar?",
  "Veo que terminaste {leccion}. ¿Quieres que te explique las trampas típicas del examen sobre este tema?",
  "¡Bien hecho con {leccion}! ¿Te preparo unas preguntas tipo test para practicar?",
  "Has avanzado en {leccion}. ¿Necesitas que te aclare algún concepto o artículo específico?",
  "¡Otra clase completada! {leccion} tiene conceptos importantes. ¿Quieres repasar los más preguntados?",
  "Excelente progreso en {leccion}. ¿Te cuento los errores más comunes que cometen los opositores?",
  "¿Cómo lo llevas después de {leccion}? Puedo ayudarte con dudas o hacerte preguntas de repaso.",
  "¡{leccion} completada! Este tema suele caer mucho. ¿Quieres que profundicemos en algo?",
  "Veo que has terminado {leccion}. ¿Te interesa saber qué artículos son los más preguntados?",
  "¡Buen trabajo con {leccion}! ¿Quieres que te prepare un esquema de los puntos esenciales?",
  "Has acabado {leccion}. ¿Te hago una pregunta rápida para ver si lo tienes claro?",
  "¡Genial progreso! Después de {leccion}, ¿hay algo que no te haya quedado claro?",
  "Terminaste {leccion}. ¿Quieres consejos sobre cómo memorizar mejor este tema?",
  "¡Otra lección más! {leccion} es importante. ¿Te cuento qué suelen preguntar en los exámenes?",
  "Veo que completaste {leccion}. ¿Quieres que conectemos este tema con otros relacionados?",
  "¡Bien! {leccion} tiene muchos detalles. ¿Te ayudo a identificar lo esencial para el examen?",
  "Has avanzado con {leccion}. ¿Te preparo un mini-test de 5 preguntas para consolidar?",
  "¡{leccion} lista! ¿Quieres que te explique las diferencias clave que confunden a muchos?",
  "Excelente, terminaste {leccion}. ¿Hay algún artículo o concepto que quieras repasar conmigo?"
];

// Función para obtener un mensaje aleatorio
function getRandomProactiveMessage(leccionName: string): string {
  const randomIndex = Math.floor(Math.random() * PROACTIVE_MESSAGES.length);
  return PROACTIVE_MESSAGES[randomIndex].replace('{leccion}', `"${leccionName}"`);
}

// Webhook de Teachable - Recibe LectureProgress.created
app.post('/api/webhook/teachable', async (req, res) => {
  try {
    const payload = req.body;

    // Log detallado del payload completo
    logger.info('📥 Webhook Teachable recibido - RAW:', JSON.stringify(payload));
    logger.info('📥 Webhook headers:', JSON.stringify(req.headers));
    logger.info('📥 Webhook keys:', payload ? Object.keys(payload).join(', ') : 'null');

    // Verificar que tengamos datos
    if (!payload) {
      logger.warn('❌ Payload vacío');
      return res.status(200).json({ received: true, message: 'Payload vacío' });
    }

    // Teachable puede enviar datos en diferentes estructuras
    // Intentar encontrar el objeto con los datos
    let object = payload.object || payload.data || payload;

    // Si hay un campo 'type' o 'event', loggearlo
    if (payload.type) logger.info('📥 Event type:', payload.type);
    if (payload.event) logger.info('📥 Event:', payload.event);

    // Log de la estructura del object
    logger.info('📥 Object keys:', object ? Object.keys(object).join(', ') : 'null');

    // Extraer datos del evento - estructura real de Teachable
    // Teachable envía: object.user.id, object.lecture.id, object.course.id
    const userId = object.user?.id?.toString() || object.user_id?.toString() || '';
    const userEmail = object.user?.email || '';
    const userName = object.user?.name || '';
    const lectureId = object.lecture?.id?.toString() || object.lecture_id?.toString() || '';
    const lectureName = object.lecture?.name || 'Lección';
    const courseId = object.course?.id?.toString() || object.course_id?.toString() || '';
    const courseName = object.course?.name || 'Curso';
    const percentComplete = object.percent_complete || 100;

    logger.info(`📊 Datos extraídos: userId=${userId}, userEmail=${userEmail}, lectureId=${lectureId}, lectureName=${lectureName}, courseName=${courseName}`);

    if (!userId || !lectureId) {
      logger.warn('Webhook: Faltan datos requeridos (userId o lectureId)');
      return res.status(200).json({ received: true, message: 'Datos incompletos' });
    }

    logger.info(`📚 Usuario ${userName || userId} completó: "${lectureName}" del curso "${courseName}"`);

    // Guardar en Supabase
    const { data, error } = await supabase
      .from('lecture_completions')
      .upsert({
        user_id: userId,
        user_email: userEmail,
        user_name: userName,
        lecture_id: lectureId,
        lecture_name: lectureName,
        course_id: courseId,
        course_name: courseName,
        percent_complete: percentComplete,
        message_shown: false,
        completed_at: new Date().toISOString()
      }, {
        onConflict: 'user_id,lecture_id'
      });

    if (error) {
      logger.error('Error guardando en Supabase:', error);
    } else {
      logger.info('✅ Lección completada guardada en base de datos');
    }

    return res.status(200).json({ received: true, success: true });

  } catch (error: any) {
    logger.error('Error en webhook Teachable:', error);
    return res.status(200).json({ received: true, error: error.message });
  }
});

// Endpoint para obtener lecciones recientes sin mensaje mostrado
app.get('/api/recent-completions', async (req, res) => {
  try {
    const { userId, userEmail } = req.query;

    if (!userId && !userEmail) {
      return res.status(400).json({ error: 'Se requiere userId o userEmail' });
    }

    logger.info(`🔍 Buscando lecciones recientes para: ${userId || userEmail}`);

    // Buscar lecciones completadas en las últimas 24 horas que no hayan mostrado mensaje
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    let query = supabase
      .from('lecture_completions')
      .select('*')
      .eq('message_shown', false)
      .gte('completed_at', twentyFourHoursAgo)
      .order('completed_at', { ascending: false })
      .limit(1);

    if (userId) {
      query = query.eq('user_id', userId);
    } else if (userEmail) {
      query = query.eq('user_email', userEmail);
    }

    const { data, error } = await query;

    if (error) {
      logger.error('Error consultando Supabase:', error);
      return res.status(200).json({ completion: null });
    }

    if (!data || data.length === 0) {
      return res.status(200).json({ completion: null });
    }

    const completion = data[0];
    const proactiveMessage = getRandomProactiveMessage(completion.lecture_name);

    logger.info(`✅ Lección reciente encontrada: "${completion.lecture_name}"`);

    return res.status(200).json({
      completion: {
        lectureId: completion.lecture_id,
        lectureName: completion.lecture_name,
        courseId: completion.course_id,
        courseName: completion.course_name,
        completedAt: completion.completed_at,
        proactiveMessage: proactiveMessage
      }
    });

  } catch (error: any) {
    logger.error('Error obteniendo lecciones recientes:', error);
    return res.status(200).json({ completion: null, error: error.message });
  }
});

// Endpoint para verificar si hay preguntas de test MUY recientes (< 30 segundos)
app.get('/api/check-recent-tests', async (req, res) => {
  try {
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({ error: 'Se requiere userId' });
    }

    logger.info(`🧪 Verificando tests recientes para usuario: ${userId}`);

    // Verificar si hay tests muy recientes (últimos 30 segundos)
    const result = await geminiRag.checkVeryRecentTest(userId as string, 30);

    if (!result.hasVeryRecentTest) {
      logger.info(`⏰ No hay tests recientes (última respuesta hace ${result.secondsSinceLastAnswer || '?'} segundos)`);
      return res.status(200).json({ hasRecentTest: false });
    }

    const { stats } = result;
    logger.info(`✅ Test MUY reciente (hace ${result.secondsSinceLastAnswer}s): ${stats?.totalQuestions} preguntas, ${stats?.incorrectCount} errores`);

    return res.status(200).json({
      hasRecentTest: true,
      secondsSinceLastAnswer: result.secondsSinceLastAnswer,
      stats: {
        totalQuestions: stats?.totalQuestions || 0,
        correctCount: stats?.correctCount || 0,
        incorrectCount: stats?.incorrectCount || 0,
        successRate: stats ? Math.round((stats.correctCount / stats.totalQuestions) * 100) : 0,
        weakCategories: stats?.weakCategories || []
      }
    });

  } catch (error: any) {
    logger.error('Error verificando tests recientes:', error);
    return res.status(200).json({ hasRecentTest: false, error: error.message });
  }
});

// Endpoint para marcar mensaje como mostrado
app.post('/api/mark-message-shown', async (req, res) => {
  try {
    const { lectureId, userId } = req.body;

    if (!lectureId || !userId) {
      return res.status(400).json({ error: 'Se requiere lectureId y userId' });
    }

    const { error } = await supabase
      .from('lecture_completions')
      .update({
        message_shown: true,
        message_shown_at: new Date().toISOString()
      })
      .eq('lecture_id', lectureId)
      .eq('user_id', userId);

    if (error) {
      logger.error('Error actualizando Supabase:', error);
      return res.status(500).json({ error: 'Error actualizando registro' });
    }

    logger.info(`✅ Mensaje marcado como mostrado para lección ${lectureId}`);
    return res.status(200).json({ success: true });

  } catch (error: any) {
    logger.error('Error marcando mensaje:', error);
    return res.status(500).json({ error: error.message });
  }
});

// Endpoint para generar y enviar esquema por email
app.post('/api/send-schema-email', async (req, res) => {
  try {
    const { topic, content, userEmail, userName } = req.body;

    if (!topic || !userEmail) {
      return res.status(400).json({ error: 'Faltan campos requeridos (topic, userEmail)' });
    }

    logger.info(`[Schema] Generando esquema para: ${topic} -> ${userEmail}`);

    // 1. Generar la infografía con Gemini Image Generation
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';

    const prompt = `Actúa como un preparador de oposiciones y diseñador de infografías educativas.
Genera una INFOGRAFÍA HORIZONTAL (formato panorámico 16:9).

TÍTULO PRINCIPAL:
- "${topic}"
- CENTRADO en la parte superior
- Tipografía grande, clara y legible

CONTENIDO A ESQUEMATIZAR:
${content ? content.substring(0, 1500) : topic}

ESTRUCTURA HORIZONTAL (de izquierda a derecha):
- Divide la imagen en 3-4 COLUMNAS principales
- Cada sección contiene: icono/ilustración arriba, texto debajo
- Usa un flujo visual con flechas o conectores entre secciones

CONTENIDO POR CADA SECCIÓN:
- CONCEPTO CLAVE con icono ilustrativo
- DEFINICIÓN breve y clara
- EJEMPLO o caso práctico si aplica
- TRUCO para recordar

ESTILO VISUAL:
- Formato HORIZONTAL PANORÁMICO (16:9 o más ancho)
- Fondo con degradado suave (beige/crema profesional)
- Cada sección con su propia ilustración/icono representativo del tema
- Colores: Azul/Verde para conceptos principales, Naranja para advertencias
- Texto en ESPAÑOL, directo y claro
- Usa flechas, círculos rodeando palabras clave
- Iconos y pequeñas ilustraciones para cada concepto
- Estilo tipo "Esquema de Estudio" o "Apuntes Visuales"
- TODO EL TEXTO DEBE SER COMPLETAMENTE LEGIBLE, sin cortes
- Usa tipografía clara, tamaño adecuado y jerarquía visual
- Incluye una sección "¡Recuerda!" con tips para memorizar`;

    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: prompt }]
          }],
          generationConfig: {
            responseModalities: ['IMAGE']
          }
        })
      }
    );

    if (!geminiResponse.ok) {
      const errorData = await geminiResponse.json().catch(() => ({}));
      logger.error('[Schema] Error Gemini:', errorData);
      throw new Error(`Error de Gemini API: ${geminiResponse.status}`);
    }

    const geminiData = await geminiResponse.json() as any;

    // Buscar la imagen en la respuesta
    const parts = geminiData.candidates?.[0]?.content?.parts || [];
    const imagePart = parts.find((part: any) => part.inlineData);

    if (!imagePart || !imagePart.inlineData) {
      logger.error('[Schema] No se encontró imagen en respuesta:', JSON.stringify(geminiData).substring(0, 500));
      throw new Error('No se pudo generar el esquema visual');
    }

    const base64Image = imagePart.inlineData.data;

    logger.info('[Schema] Imagen generada correctamente');

    // 2. Configurar transporter de email
    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    // 3. Preparar y enviar el email
    const mailOptions = {
      from: `"LexAI - Tu Asistente de Estudio" <${process.env.SMTP_USER}>`,
      to: userEmail,
      subject: `📊 Tu Esquema: ${topic}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h1 style="color: #64c27b; text-align: center;">📚 Esquema de Estudio</h1>
          <h2 style="color: #333; text-align: center;">${topic}</h2>
          <p style="color: #333; font-size: 16px;">
            Hola${userName ? ` ${userName}` : ''},
          </p>
          <p style="color: #333; font-size: 16px;">
            Aquí tienes tu esquema personalizado con los puntos clave sobre <strong>${topic}</strong>.
          </p>
          <p style="color: #333; font-size: 16px;">
            Úsalo para repasar y consolidar lo que has aprendido. ¡Guárdalo o imprímelo!
          </p>
          <p style="color: #666; font-size: 14px; margin-top: 30px;">
            ¡Mucho ánimo con tu preparación! 💪
          </p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
          <p style="color: #999; font-size: 12px; text-align: center;">
            Este email fue enviado desde LexAI - Tu Asistente de Estudio
          </p>
        </div>
      `,
      attachments: [
        {
          filename: `esquema-${topic.toLowerCase().replace(/\s+/g, '-').substring(0, 30)}.png`,
          content: base64Image,
          encoding: 'base64' as const,
          cid: 'esquema',
        },
      ],
    };

    await transporter.sendMail(mailOptions);

    logger.info(`[Schema] Email enviado a ${userEmail}`);

    return res.status(200).json({
      success: true,
      message: 'Esquema generado y enviado correctamente'
    });

  } catch (error: any) {
    logger.error('[Schema] Error:', error);
    return res.status(500).json({
      error: 'Error al generar o enviar el esquema',
      details: error.message
    });
  }
});

// Para desarrollo local, iniciar servidor
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    logger.info(`🚀 LexAI Backend (Supabase) running on port ${PORT}`);
    logger.info(`🌐 Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:3000'}`);
    logger.info(`📊 Environment: ${process.env.NODE_ENV}`);
    logger.info(`🔗 Supabase URL: ${process.env.SUPABASE_URL}`);
    logger.info(`🤖 OpenAI Model: gpt-4o (enhanced reasoning)`);
  });
}

// Exportar para Vercel
export default app;

// Manejo de errores global
if (process.env.NODE_ENV !== 'production') {
  process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  });

  process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception:', error);
    process.exit(1);
  });
}