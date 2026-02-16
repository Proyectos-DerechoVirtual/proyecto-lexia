# LexIA - Chatbot Especializado en Oposiciones de Justicia

🌐 **APLICACIÓN EN VIVO:** https://lexia-chatbot.vercel.app

🔧 **API Backend:** https://lexia-backend.vercel.app

LexIA es un asistente legal inteligente especializado en la preparación de oposiciones de justicia. Utiliza tecnología RAG (Retrieval Augmented Generation) avanzada para proporcionar respuestas precisas y citadas directamente desde documentos legales españoles.

## 🚀 Características Principales

### 🎯 **Sistema RAG Escalable**
- **Búsqueda híbrida**: Combina embedding similarity y metadata matching para máxima precisión
- **Chunking inteligente**: Respeta límites de artículos en lugar de divisiones arbitrarias
- **Soporte multi-área**: Escalable para múltiples tipos de oposiciones (justicia, notariales, etc.)
- **Citas exactas**: Encuentra y cita artículos específicos con precisión

### 🎨 **Interfaz Estilo Claude**
- **Diseño inspirado en Claude**: Colores naranjas (#FF7A00) y grises cálidos
- **Icono de balanza de justicia**: Reemplaza el logo "L" con símbolo legal
- **Modo oscuro/claro**: Persistencia de preferencias de tema
- **Responsive**: Optimizado para desktop y móvil

### 💬 **Chat Inteligente**
- **Conversaciones persistentes**: Historial completo en Supabase
- **Respuestas contextuales**: Especializado en legislación de igualdad
- **Disclaimer integrado**: Aviso sobre preparación de oposiciones
- **Búsqueda en tiempo real**: Encuentra artículos específicos instantáneamente

## 🛠️ Stack Tecnológico

### Frontend
- **React 18** con TypeScript
- **Tailwind CSS** con paleta personalizada Claude
- **Zustand** para gestión de estado
- **React Markdown** para renderizado de respuestas
- **Hero Icons** para iconografía
- **date-fns** para formato de fechas en español

### Backend (Consolidado - 5 archivos core)
- **Node.js** con Express y TypeScript
- **Supabase** como base de datos principal (pgvector)
- **OpenAI API** (text-embedding-3-small + gpt-4o-mini)
- **Streaming**: Server-Sent Events con 6 pasos de progreso
- **Unified RAG**: Búsqueda híbrida con caché de embeddings
- **Sin MongoDB**: Totalmente migrado a Supabase

### RAG System
- **Modelo de embeddings**: text-embedding-3-small (1536 dimensiones)
- **Base de datos vectorial**: Supabase pgvector
- **Chunking**: Intelligent Article-Aware Chunker
- **Búsqueda**: Híbrida (similarity + metadata)
- **Umbral de similitud**: 0.2 (optimizado para el modelo)

## 📁 Estructura del Proyecto

```
lexia-chatbot/
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── chat/           # ChatInterface, MessageBubble, InputArea
│   │   │   ├── sidebar/        # Sidebar, ConversationList
│   │   │   ├── layout/         # Header, ThemeToggle
│   │   │   └── icons/          # ScaleIcon (balanza de justicia)
│   │   ├── stores/
│   │   │   └── supabaseChatStore.ts  # Estado global del chat
│   │   ├── services/
│   │   │   └── supabase.ts     # Cliente Supabase
│   │   └── types/              # Tipos TypeScript
│   └── tailwind.config.js      # Configuración con colores Claude
├── backend/
│   ├── src/
│   │   ├── index-supabase.ts          # 🚀 Main API server (all endpoints)
│   │   ├── services/
│   │   │   ├── ragServiceUnified.ts   # 🔍 Complete RAG functionality  
│   │   │   ├── intelligentChunker.ts  # 📄 Article-aware chunking
│   │   │   └── batchEmbeddingProcessor.ts # ⚡ Efficient embeddings
│   │   └── utils/
│   │       └── logger.ts              # 📊 Winston logging
│   ├── legal-docs/                    # 📚 Processed legal documents
│   │   └── oposicionesjusticia/
│   │       └── legislacion/
│   │           └── Ley 3-2007 para la igualdad efectiva de hombres y mujeres.txt
│   └── scripts/                       # 🛠️ Processing utilities
└── scripts/
    ├── process-documents.ts    # Procesamiento de documentos
    └── test-rag.ts            # Testing del sistema RAG
```

## 🚀 Instalación y Configuración

### Requisitos Previos
- Node.js 18+
- npm o yarn
- Cuenta de Supabase
- API Keys de OpenAI y Anthropic

### 1. Clonar el repositorio
```bash
git clone <url-del-repositorio>
cd lexia-chatbot
```

### 2. Instalar dependencias
```bash
npm install
```

### 3. Configurar Supabase

#### Crear tabla de embeddings:
```sql
-- Crear tabla para embeddings
CREATE TABLE document_embeddings (
  id SERIAL PRIMARY KEY,
  content TEXT NOT NULL,
  embedding VECTOR(1536),
  metadata JSONB,
  area VARCHAR(255),
  category VARCHAR(255),
  document_path TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Crear tabla para conversaciones
CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  category VARCHAR(255) DEFAULT 'otro',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Crear tabla para mensajes
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  role VARCHAR(50) NOT NULL,
  content TEXT NOT NULL,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Crear índices para rendimiento
CREATE INDEX ON document_embeddings USING ivfflat (embedding vector_cosine_ops);
CREATE INDEX ON document_embeddings (area, category);
CREATE INDEX ON conversations (created_at DESC);
CREATE INDEX ON messages (conversation_id, timestamp);
```

### 4. Variables de entorno

**Backend (.env):**
```env
# Supabase
SUPABASE_URL=tu-supabase-url
SUPABASE_ANON_KEY=tu-supabase-anon-key

# APIs
OPENAI_API_KEY=tu-openai-api-key
ANTHROPIC_API_KEY=tu-anthropic-api-key

# Server
PORT=5000
FRONTEND_URL=http://localhost:3000
```

**Frontend (.env.local):**
```env
NEXT_PUBLIC_SUPABASE_URL=tu-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu-supabase-anon-key
NEXT_PUBLIC_API_URL=http://localhost:5000
```

### 5. Procesar documentos legales
```bash
cd backend
npm run process-documents
```

### 6. Ejecutar el proyecto

**Modo desarrollo (recomendado):**
```bash
# Desde la raíz del proyecto
npm run dev
```

**Por separado:**
```bash
# Backend (puerto 5000)
cd backend && npm run dev

# Frontend (puerto 3000)
cd frontend && npm run dev
```

**Desde WSL (Windows):**
```bash
wsl -d Ubuntu-24.04 -e bash -c 'cd /home/brayan/lexia-chatbot && npm run dev'
```

## 📖 Uso del Sistema

### Ejemplos de Consultas

**Búsqueda de artículos específicos:**
- "¿Qué dice el artículo 15?"
- "Artículo 20 de la ley de igualdad"
- "Encuentra el artículo 1"

**Consultas temáticas:**
- "¿Qué medidas establece la ley para promover la igualdad?"
- "¿Cuáles son los tipos de contratos según la ley?"
- "Explícame sobre discriminación laboral"

### Funcionalidades del Chat

1. **Nueva consulta**: Crea conversaciones organizadas por fecha
2. **Historial persistente**: Todas las conversaciones se guardan
3. **Citas exactas**: Respuestas incluyen referencias a artículos específicos
4. **Búsqueda híbrida**: Combina similitud semántica y metadatos
5. **Disclaimer**: Recordatorio sobre preparación de oposiciones

## 🔧 Configuración Avanzada

### Sistema RAG Escalable

El sistema está diseñado para múltiples áreas de oposiciones:

```typescript
const AREAS_CONFIG: AreaConfig[] = [
  {
    areaName: 'oposicionesjusticia',
    areaTitle: 'Oposiciones de Justicia',
    categories: [
      { folderName: 'legislacion', categoryId: 'legislacion', processSubfolders: false },
      { folderName: 'clases', categoryId: 'clases', processSubfolders: true },
      { folderName: 'preguntas trampa', categoryId: 'preguntas_trampa', processSubfolders: false }
    ]
  },
  {
    areaName: 'oposicionesnotariales',
    areaTitle: 'Oposiciones Notariales',
    categories: [
      { folderName: 'legislacion', categoryId: 'legislacion', processSubfolders: false }
    ]
  }
];
```

### Chunking Inteligente

El sistema divide documentos respetando la estructura de artículos:

```typescript
interface ArticleChunk {
  content: string;
  metadata: {
    articleNumber?: string;
    articleTitle?: string;
    lawName?: string;
    lawTitle?: string;
    documentType?: string;
    chunkType: 'article' | 'section' | 'regular';
    area: string;
    category: string;
  };
}
```

### Búsqueda Híbrida

Combina dos enfoques para máxima precisión:

1. **Metadata Search**: Búsqueda exacta por número de artículo
2. **Embedding Search**: Similitud semántica con umbral 0.2
3. **Ranking**: Prioriza matches exactos de metadatos

## 🎨 Personalización del Frontend

### Colores Claude
```javascript
// tailwind.config.js
claude: {
  orange: '#FF7A00',
  darkOrange: '#E65100',
  beige: '#FEFDF9',
  gray: {
    50: '#FAFAF9',
    100: '#F4F2F0',
    200: '#E8E4E0',
    // ... escala completa
  }
}
```

### Componentes Clave

- **ScaleIcon**: Icono de balanza de justicia personalizado
- **MessageBubble**: Renderizado Markdown con disclaimer
- **InputArea**: Campo de entrada con placeholder específico
- **ConversationList**: Lista agrupada por fechas en español

## 🧪 Testing y Depuración

### Probar el sistema RAG
```bash
cd backend
npm run test-rag
```

### Scripts disponibles
```bash
# Backend desarrollo (único comando)
cd backend && npm run dev

# Compilar TypeScript  
cd backend && npm run build

# Iniciar producción
cd backend && npm start

# Testing del sistema (scripts en /backend/scripts/)
cd backend && tsx scripts/testRAGSearch.ts
```

### Consultas SQL útiles
```sql
-- Ver todos los embeddings
SELECT id, area, category, metadata->>'articleNumber' as article 
FROM document_embeddings 
ORDER BY id;

-- Buscar artículo específico
SELECT * FROM document_embeddings 
WHERE metadata->>'articleNumber' = '15';

-- Contar chunks por categoría
SELECT area, category, COUNT(*) 
FROM document_embeddings 
GROUP BY area, category;
```

## 🚀 Deployment

### Build de producción
```bash
npm run build
npm start
```

### Variables de entorno de producción
- `NODE_ENV=production`
- URLs de Supabase de producción
- API keys seguras
- Configurar CORS para dominio de producción

## 📊 Métricas y Monitoreo

### Logs del sistema
- Búsquedas RAG con tiempo de respuesta
- Artículos encontrados vs no encontrados
- Errores de embedding y consultas

### Métricas clave
- Precisión de búsqueda por artículo
- Tiempo de respuesta promedio
- Satisfacción del usuario con citaciones

## 🔒 Seguridad

- **Rate limiting**: Previene abuso de la API
- **Validación de entrada**: Sanitización de consultas
- **CORS configurado**: Solo dominios autorizados
- **API keys**: Almacenadas de forma segura
- **Supabase RLS**: Row Level Security habilitado

## 🔧 RAG SYSTEM CRITICAL FIXES (August 2025)

**HYBRID SEARCH PATTERN**: The RAG system now implements a sophisticated hybrid approach to handle edge cases where specific content exists but has low embedding similarity:

1. **Dynamic Threshold Adjustment**: 
   - Standard queries use 0.2 similarity threshold
   - Specific/technical terms automatically drop to 0.1 threshold  
   - General queries (requirements, functions) use 0.15 threshold
   
2. **Text-Based Search Fallback**: 
   - When embedding similarity is insufficient, direct text search (ILIKE) supplements results
   - Text search results get artificial high similarity (0.9) to prioritize them
   - Combined with embedding results to provide comprehensive coverage

3. **Keyword-Based Prioritization**: 
   - Chunks containing specific keywords are moved to front of context
   - Prevents generic responses when specific content exists
   - Maintains relevance ranking while ensuring targeted content appears first

4. **Enhanced System Prompt**: 
   - More emphatic instructions to use provided context
   - Clear delineation of database information vs general knowledge
   - Improved context utilization for specialized legal terms

**Technical Implementation**: See `ragServiceUnified.ts` lines 355-501 for dynamic threshold logic, text search fallback, and keyword prioritization. This pattern solves cases where content exists in database but wasn't being retrieved due to embedding limitations.

## 🚨 BACKEND CONSOLIDADO (Agosto 2025)

**⚠️ IMPORTANTE**: El backend ha sido completamente consolidado para prevenir confusiones:

### ✅ Estructura Simplificada (5 archivos core):
1. **`index-supabase.ts`** - Servidor principal con todos los endpoints
2. **`ragServiceUnified.ts`** - Servicio RAG completo y optimizado  
3. **`intelligentChunker.ts`** - División inteligente por artículos
4. **`batchEmbeddingProcessor.ts`** - Procesamiento eficiente de embeddings
5. **`logger.ts`** - Sistema de logs con Winston

### ❌ Archivos ELIMINADOS (no recrear):
- **Controllers/Routes**: Todos los endpoints están en `index-supabase.ts`
- **Middleware**: Autenticación manejada inline
- **Models**: Sin MongoDB, todo en Supabase
- **Múltiples servicios RAG**: Solo `ragServiceUnified.ts`
- **Dependencias**: Eliminadas MongoDB, bcrypt, JWT, etc.

### 🎯 Beneficios:
- **Mantenimiento simplificado**: Un solo punto de entrada
- **TypeScript relajado**: `strict: false` para desarrollo más rápido
- **Sin redundancia**: Código duplicado eliminado
- **Streaming nativo**: Server-Sent Events integrado

## ⚠️ Limitaciones Conocidas

1. **Modelo específico**: Optimizado para text-embedding-3-small
2. **Idioma**: Principalmente en español
3. **Dominio**: Especializado en Ley 3/2007
4. **Umbral de similitud**: Requiere ajuste por modelo

## 🔮 Roadmap Futuro

- [ ] **Múltiples documentos**: Código Civil, Penal, etc.
- [ ] **Exportar conversaciones**: PDF con citas
- [ ] **Búsqueda jurisprudencial**: Casos y sentencias  
- [ ] **Simulacros de examen**: Preguntas tipo test
- [ ] **Análisis de rendimiento**: Dashboard de métricas
- [ ] **API pública**: Endpoints para integraciones
- [ ] **Multiidioma**: Soporte para catalán y euskera

## 🤝 Contribuir

1. Fork el proyecto
2. Crea una rama feature (`git checkout -b feature/NewFeature`)
3. Commit cambios (`git commit -m 'Add NewFeature'`)
4. Push a la rama (`git push origin feature/NewFeature`)
5. Abre un Pull Request

### Guías de contribución
- Seguir convenciones TypeScript existentes
- Usar la paleta de colores Claude
- Documentar nuevas funcionalidades RAG
- Incluir tests para nuevos endpoints

## 📝 Licencia

Este proyecto está bajo la Licencia MIT.

## ⚠️ Disclaimer Legal

**LexIA es una herramienta de preparación para oposiciones de justicia. NO constituye asesoría legal profesional.** 

- ✅ Úsalo para: Estudiar legislación, preparar exámenes, consultar artículos
- ❌ NO lo uses para: Casos reales, asesoría legal, decisiones jurídicas

**Siempre verifica la información con fuentes oficiales y consulta con profesionales cualificados para casos específicos.**

## 📞 Soporte

**Problemas técnicos:**
- Crear issue en GitHub con logs y pasos para reproducir
- Incluir información del entorno (OS, Node version, etc.)

**Preguntas sobre uso:**
- Consultar esta documentación primero
- Revisar ejemplos de consultas en la sección de uso

**Sugerencias de mejora:**
- Abrir issue con etiqueta "enhancement"
- Describir el caso de uso y beneficio esperado

---

**Desarrollado con ⚖️ para la preparación de oposiciones de justicia**

*Última actualización: Agosto 2025*