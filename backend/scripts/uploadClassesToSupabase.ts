#!/usr/bin/env tsx

import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Cargar variables de entorno
dotenv.config();
dotenv.config({ path: '../.env' });

import { createClient } from '@supabase/supabase-js';
import { IntelligentLegalChunker } from '../src/services/intelligentChunker';
import OpenAI from 'openai';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

// Configuración mejorada de temas con metadata adicional
interface ClassConfig {
  topicName: string;
  topicTitle: string;
  topicNumber: number;
  examRelevance: number; // 1-10
  difficulty: 'básico' | 'intermedio' | 'avanzado';
  keyTopics: string[]; // Temas clave del tema
}

// Configuración completa de todos los temas
const TOPICS_CONFIG: ClassConfig[] = [
  {
    topicName: 'tema01_constitucion_espanola',
    topicTitle: 'Constitución Española',
    topicNumber: 1,
    examRelevance: 10,
    difficulty: 'intermedio',
    keyTopics: ['derechos fundamentales', 'corona', 'cortes generales', 'gobierno', 'poder judicial']
  },
  {
    topicName: 'tema02_derechos_humanos',
    topicTitle: 'Derechos Humanos e Igualdad',
    topicNumber: 2,
    examRelevance: 9,
    difficulty: 'intermedio',
    keyTopics: ['igualdad', 'no discriminación', 'violencia de género', 'LGTBI', 'paridad']
  },
  {
    topicName: 'tema03_gobierno_y_administracion',
    topicTitle: 'Gobierno y Administración',
    topicNumber: 3,
    examRelevance: 8,
    difficulty: 'intermedio',
    keyTopics: ['estructura AGE', 'presidente', 'ministros', 'subsecretarios', 'delegados gobierno']
  },
  {
    topicName: 'tema04_organizacion_territorial',
    topicTitle: 'Organización Territorial del Estado',
    topicNumber: 4,
    examRelevance: 7,
    difficulty: 'avanzado',
    keyTopics: ['comunidades autónomas', 'estatutos autonomía', 'competencias', 'municipios', 'provincias']
  },
  {
    topicName: 'tema05_la_union_europea',
    topicTitle: 'La Unión Europea',
    topicNumber: 5,
    examRelevance: 6,
    difficulty: 'intermedio',
    keyTopics: ['instituciones UE', 'parlamento europeo', 'comisión', 'consejo', 'tribunal justicia']
  },
  {
    topicName: 'tema06_el_poder_judicial',
    topicTitle: 'El Poder Judicial',
    topicNumber: 6,
    examRelevance: 10,
    difficulty: 'avanzado',
    keyTopics: ['CGPJ', 'jueces', 'magistrados', 'ministerio fiscal', 'carrera judicial']
  },
  {
    topicName: 'tema10_carta_de_ciudadanos',
    topicTitle: 'Carta de Derechos de los Ciudadanos',
    topicNumber: 10,
    examRelevance: 7,
    difficulty: 'básico',
    keyTopics: ['derechos ciudadanos', 'transparencia judicial', 'asistencia jurídica gratuita']
  },
  {
    topicName: 'tema16_libertad_sindical',
    topicTitle: 'Libertad Sindical y Derecho Laboral',
    topicNumber: 16,
    examRelevance: 6,
    difficulty: 'intermedio',
    keyTopics: ['sindicatos', 'huelga', 'negociación colectiva', 'comités empresa', 'elecciones sindicales']
  },
  {
    topicName: 'tema17a19_proceso_civil',
    topicTitle: 'Proceso Civil',
    topicNumber: 17,
    examRelevance: 10,
    difficulty: 'avanzado',
    keyTopics: ['competencia', 'jurisdicción', 'postulación', 'abogados', 'procuradores']
  },
  {
    topicName: 'tema1_2_LOTC',
    topicTitle: 'Ley Orgánica del Tribunal Constitucional',
    topicNumber: 12,
    examRelevance: 8,
    difficulty: 'avanzado',
    keyTopics: ['tribunal constitucional', 'recurso inconstitucionalidad', 'recurso amparo', 'cuestión inconstitucionalidad']
  },
  {
    topicName: 'tema24_archivo_judicial',
    topicTitle: 'Archivo Judicial',
    topicNumber: 24,
    examRelevance: 5,
    difficulty: 'básico',
    keyTopics: ['archivo', 'documentación judicial', 'conservación', 'expurgo']
  },
  {
    topicName: 'tema28a30_procesos_especiales',
    topicTitle: 'Procesos Especiales',
    topicNumber: 28,
    examRelevance: 9,
    difficulty: 'avanzado',
    keyTopics: ['proceso monitorio', 'división patrimonios', 'procesos matrimoniales', 'medidas provisionales']
  },
  {
    topicName: 'tema38_medidas_cautelares',
    topicTitle: 'Medidas Cautelares',
    topicNumber: 38,
    examRelevance: 8,
    difficulty: 'avanzado',
    keyTopics: ['embargo preventivo', 'secuestro', 'intervención judicial', 'anotación preventiva']
  },
  {
    topicName: 'tema45_el_sumario',
    topicTitle: 'El Sumario',
    topicNumber: 45,
    examRelevance: 8,
    difficulty: 'avanzado',
    keyTopics: ['instrucción', 'diligencias', 'inspección ocular', 'informes periciales']
  },
  {
    topicName: 'tema54_el_procedimiento_por_delitos_leves',
    topicTitle: 'Procedimiento por Delitos Leves',
    topicNumber: 54,
    examRelevance: 7,
    difficulty: 'intermedio',
    keyTopics: ['juicio delitos leves', 'denuncia', 'citación', 'sentencia', 'recursos']
  },
  {
    topicName: 'tema62_los_recursos',
    topicTitle: 'Los Recursos',
    topicNumber: 62,
    examRelevance: 9,
    difficulty: 'avanzado',
    keyTopics: ['apelación', 'casación', 'revisión', 'queja', 'ejecución sentencias']
  },
  {
    topicName: 'tema63_procedimientos_especiales',
    topicTitle: 'Procedimientos Especiales Contenciosos',
    topicNumber: 63,
    examRelevance: 7,
    difficulty: 'avanzado',
    keyTopics: ['procedimiento abreviado', 'protección derechos fundamentales', 'cuestión ilegalidad']
  },
  {
    topicName: 'tema64_disposiciones_comunes',
    topicTitle: 'Disposiciones Comunes Contencioso-Administrativo',
    topicNumber: 64,
    examRelevance: 6,
    difficulty: 'intermedio',
    keyTopics: ['plazos', 'costas', 'ejecución sentencias', 'incidentes']
  },
  {
    topicName: 'tema68_concurso_de_acreedores',
    topicTitle: 'Concurso de Acreedores',
    topicNumber: 68,
    examRelevance: 8,
    difficulty: 'avanzado',
    keyTopics: ['insolvencia', 'masa activa', 'masa pasiva', 'administración concursal', 'convenio', 'liquidación']
  }
];

// Función para extraer información del archivo
function extractFileInfo(fileName: string): { classNumber: string, classNumberInt: number, title: string } {
  const match = fileName.match(/T(\d+)_C(\d+)_(.+)\.md$/);
  
  if (match) {
    const [, tema, clase, titulo] = match;
    return {
      classNumber: `T${tema}_C${clase}`,
      classNumberInt: parseInt(clase),
      title: titulo.replace(/_/g, ' ')
    };
  }
  
  return {
    classNumber: fileName.replace('.md', ''),
    classNumberInt: 0,
    title: fileName.replace('.md', '').replace(/_/g, ' ')
  };
}

// Función para extraer keywords y referencias del contenido de clase
function extractClassKeywordsAndRefs(content: string, topicConfig: ClassConfig): { keywords: string[], legalRefs: string[] } {
  const keywords: Set<string> = new Set();
  const legalRefs: Set<string> = new Set();
  
  // Agregar keywords del tema
  topicConfig.keyTopics.forEach(topic => keywords.add(topic));
  
  // Extraer términos importantes del contenido
  const keywordPatterns = [
    /\b(concepto|definición|características?|elementos?|requisitos?|tipos?|clases?)\b/gi,
    /\b(principios?|fundamentos?|bases?|naturaleza|función|finalidad)\b/gi,
    /\b(procedimientos?|procesos?|fases?|etapas?|plazos?|términos?)\b/gi,
    /\b(competencias?|atribuciones?|facultades?|potestades?|funciones?)\b/gi,
    /\b(derechos?|obligaciones?|deberes?|responsabilidad|garantías?)\b/gi
  ];
  
  keywordPatterns.forEach(pattern => {
    const matches = content.match(pattern);
    if (matches) {
      matches.forEach(match => keywords.add(match.toLowerCase()));
    }
  });
  
  // Extraer referencias a leyes y artículos mencionados
  const refPatterns = [
    /\bart(?:ículo)?s?\s+\d+(?:\s+(?:a|al|y)\s+\d+)?(?:\s+(?:CE|CP|LEC|LECrim|LOPJ))?/gi,
    /\bLey\s+(?:Orgánica\s+)?(?:\d+\/\d+)/gi,
    /\bConstitución(?:\s+Española)?/gi,
    /\b(?:LEC|LECrim|LOPJ|CP|CC|LO|RD)\s+\d+\/\d+/gi
  ];
  
  refPatterns.forEach(pattern => {
    const matches = content.match(pattern);
    if (matches) {
      matches.forEach(match => legalRefs.add(match));
    }
  });
  
  return {
    keywords: Array.from(keywords).slice(0, 25), // Más keywords para clases
    legalRefs: Array.from(legalRefs).slice(0, 20)
  };
}

// Función para determinar la dificultad de una clase específica
function determineClassDifficulty(content: string, classNumber: number, topicDifficulty: string): string {
  // Primeras clases suelen ser introductorias
  if (classNumber <= 3) {
    return 'básico';
  }
  
  // Clases con muchos procedimientos o casos prácticos
  const advancedPatterns = [
    /caso\s+práctico/i,
    /ejemplo\s+(?:práctico|real)/i,
    /supuesto\s+(?:práctico|de\s+hecho)/i,
    /procedimiento\s+(?:especial|complejo)/i,
    /recurso\s+(?:extraordinario|especial)/i
  ];
  
  const hasAdvancedContent = advancedPatterns.some(pattern => pattern.test(content));
  if (hasAdvancedContent) {
    return 'avanzado';
  }
  
  // Por defecto, usar la dificultad del tema
  return topicDifficulty;
}

// Función para procesar archivos MD de clases con embeddings mejorados
async function processClassFileV2(filePath: string, config: ClassConfig, fileName: string): Promise<number> {
  const markdown = fs.readFileSync(filePath, 'utf-8');
  
  // Chunking inteligente
  const chunker = new IntelligentLegalChunker();
  const chunks = chunker.chunkLegalDocument(markdown);
  
  console.log(`   📄 ${fileName}: ${chunks.length} chunks`);
  
  let chunksInserted = 0;
  const batchSize = 5;
  
  // Extraer información del archivo
  const fileInfo = extractFileInfo(fileName);
  
  // Procesar en lotes
  for (let i = 0; i < chunks.length; i += batchSize) {
    const batch = chunks.slice(i, Math.min(i + batchSize, chunks.length));
    
    try {
      // Generar embeddings para el lote
      const embeddingInputs = batch.map(chunk => chunk.content);
      const embeddingResponse = await openai.embeddings.create({
        model: 'text-embedding-3-large', // NUEVO MODELO
        input: embeddingInputs,
        dimensions: 3072
      });
      
      // Procesar cada chunk del lote
      for (let j = 0; j < batch.length; j++) {
        const chunk = batch[j];
        const embedding = embeddingResponse.data[j].embedding;
        const chunkIndex = i + j;
        
        // Extraer keywords y referencias
        const { keywords, legalRefs } = extractClassKeywordsAndRefs(chunk.content, config);
        
        // Determinar dificultad específica de la clase
        const difficulty = determineClassDifficulty(
          chunk.content, 
          fileInfo.classNumberInt,
          config.difficulty
        );
        
        // Preparar metadata enriquecida
        const metadata = {
          fileName: fileName,
          filePath: filePath,
          chunkIndex: chunkIndex,
          totalChunks: chunks.length,
          topicName: config.topicName,
          topicTitle: config.topicTitle,
          topicNumber: config.topicNumber,
          classNumber: fileInfo.classNumber,
          classNumberInt: fileInfo.classNumberInt,
          classTitle: fileInfo.title,
          chunkType: chunk.type,
          processedAt: new Date().toISOString(),
          embeddingModel: 'text-embedding-3-large',
          ...chunk.metadata
        };
        
        // Insertar en Supabase
        const { error } = await supabase
          .from('document_embeddings')
          .insert({
            content: chunk.content,
            embedding: embedding,
            metadata: metadata,
            document_type: 'class',
            law_name: config.topicName,
            article_number: null,
            section_title: fileInfo.title,
            category: 'oposiciones',
            // NUEVOS CAMPOS MEJORADOS
            topic_number: config.topicNumber,
            class_number: fileInfo.classNumberInt,
            difficulty_level: difficulty,
            exam_relevance: config.examRelevance,
            keywords: keywords,
            legal_refs: legalRefs
          });
        
        if (error) {
          console.error(`   ❌ Error insertando chunk ${chunkIndex}:`, error.message);
        } else {
          chunksInserted++;
        }
      }
      
      // Pausa entre lotes
      if (i + batchSize < chunks.length) {
        await new Promise(resolve => setTimeout(resolve, 300));
      }
      
    } catch (error) {
      console.error(`   ❌ Error procesando lote ${i}-${i+batchSize}:`, error);
    }
  }
  
  return chunksInserted;
}

// Función para procesar un tema completo
async function processTopicV2(config: ClassConfig): Promise<number> {
  const mdDir = path.join('/home/brayan/lexia-chatbot/backend/legal-docs/oposicionesjusticia/clases-md', config.topicName);
  
  if (!fs.existsSync(mdDir)) {
    console.log(`   ⚠️ No existe directorio MD para ${config.topicName}`);
    return 0;
  }
  
  const mdFiles = fs.readdirSync(mdDir).filter(f => f.endsWith('.md'));
  console.log(`   📚 ${mdFiles.length} archivos MD encontrados`);
  
  let totalChunks = 0;
  
  for (const mdFile of mdFiles) {
    const filePath = path.join(mdDir, mdFile);
    const chunks = await processClassFileV2(filePath, config, mdFile);
    totalChunks += chunks;
  }
  
  return totalChunks;
}

// Función principal
async function uploadAllClassesV2() {
  console.log('🚀 Iniciando carga de clases con text-embedding-3-large...');
  console.log('📊 Dimensiones: 3072 (mayor precisión semántica)');
  console.log('✨ Mejoras: Metadata enriquecida + keywords + referencias + dificultad');
  console.log('');
  
  let totalTopics = 0;
  let totalChunks = 0;
  
  for (const topicConfig of TOPICS_CONFIG) {
    console.log(`\n📘 Procesando: ${topicConfig.topicTitle} (Tema ${topicConfig.topicNumber})`);
    console.log(`   📊 Relevancia examen: ${topicConfig.examRelevance}/10`);
    console.log(`   📈 Dificultad base: ${topicConfig.difficulty}`);
    
    try {
      const chunks = await processTopicV2(topicConfig);
      
      if (chunks > 0) {
        totalTopics++;
        totalChunks += chunks;
        console.log(`   ✅ ${chunks} chunks procesados`);
      }
      
    } catch (error) {
      console.error(`   ❌ Error procesando tema:`, error);
    }
  }
  
  console.log('\n📊 RESUMEN FINAL:');
  console.log(`   ✅ Temas procesados: ${totalTopics}/${TOPICS_CONFIG.length}`);
  console.log(`   📄 Total chunks: ${totalChunks}`);
  console.log(`   🎯 Modelo: text-embedding-3-large (3072 dims)`);
  console.log(`   💾 Tabla: document_embeddings_v2`);
  
  // Verificar estadísticas
  const { data: stats } = await supabase
    .from('embedding_stats_v2')
    .select('*')
    .eq('document_type', 'class');
  
  if (stats) {
    console.log('\n📈 ESTADÍSTICAS POR TEMA:');
    stats.forEach((stat: any) => {
      console.log(`   - Tema ${stat.topic_number}: ${stat.chunk_count} chunks, dificultad promedio: ${stat.difficulty_level}`);
    });
  }
}

// Ejecutar si es el archivo principal
if (require.main === module) {
  uploadAllClassesV2()
    .then(() => {
      console.log('\n✅ Proceso completado exitosamente');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n❌ Error fatal:', error);
      process.exit(1);
    });
}