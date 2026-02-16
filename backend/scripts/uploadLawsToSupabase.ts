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

// Configuración de leyes disponibles
interface LawConfig {
  fileName: string;
  lawName: string;
  lawTitle: string;
  documentType: string;
  category: string;
  examRelevance: number; // 1-10
}

const LAWS_CONFIG: LawConfig[] = [
  {
    fileName: 'Ley 3-2007 igualdad.md',
    lawName: 'Ley_3_2007_Igualdad',
    lawTitle: 'Ley 3/2007 para la igualdad efectiva de mujeres y hombres',
    documentType: 'law',
    category: 'oposiciones',
    examRelevance: 9 // Muy relevante para oposiciones
  },
  {
    fileName: 'Ley 50-1997 Gobierno.md',
    lawName: 'Ley_50_1997_Gobierno',
    lawTitle: 'Ley 50/1997 del Gobierno',
    documentType: 'law',
    category: 'oposiciones',
    examRelevance: 8
  },
  {
    fileName: 'LEC Enjuiciamiento Civil.md',
    lawName: 'LEC',
    lawTitle: 'Ley de Enjuiciamiento Civil',
    documentType: 'law',
    category: 'oposiciones',
    examRelevance: 10 // Fundamental
  },
  {
    fileName: 'LECrim Enjuiciamiento Criminal.md',
    lawName: 'LECrim',
    lawTitle: 'Ley de Enjuiciamiento Criminal',
    documentType: 'law',
    category: 'oposiciones',
    examRelevance: 10 // Fundamental
  },
  {
    fileName: 'LRC Registro Civil.md',
    lawName: 'LRC',
    lawTitle: 'Ley del Registro Civil',
    documentType: 'law',
    category: 'oposiciones',
    examRelevance: 7
  },
  {
    fileName: 'TRLC Ley Concursal.md',
    lawName: 'TRLC',
    lawTitle: 'Texto Refundido de la Ley Concursal',
    documentType: 'law',
    category: 'oposiciones',
    examRelevance: 8
  }
];

// Función para extraer keywords y referencias legales del contenido
function extractKeywordsAndRefs(content: string): { keywords: string[], legalRefs: string[] } {
  const keywords: Set<string> = new Set();
  const legalRefs: Set<string> = new Set();
  
  // Extraer palabras clave importantes (términos legales comunes)
  const keywordPatterns = [
    /\b(jurisdicción|competencia|recurso|sentencia|auto|providencia|resolución)\b/gi,
    /\b(demanda|demandante|demandado|actor|parte|litigante|procesal)\b/gi,
    /\b(prueba|testigo|perito|pericial|documental|interrogatorio)\b/gi,
    /\b(plazos?|términos?|días? hábiles?|notificación|emplazamiento)\b/gi,
    /\b(juez|magistrado|tribunal|juzgado|audiencia|sala)\b/gi,
    /\b(delito|falta|pena|prisión|multa|responsabilidad)\b/gi,
    /\b(derechos? fundamentales?|garantías?|constitucional)\b/gi
  ];
  
  keywordPatterns.forEach(pattern => {
    const matches = content.match(pattern);
    if (matches) {
      matches.forEach(match => keywords.add(match.toLowerCase()));
    }
  });
  
  // Extraer referencias a artículos y leyes
  const refPatterns = [
    /\bart(?:ículo)?s?\s+\d+(?:\s*[ay]\s*\d+)*/gi,
    /\bLey\s+(?:Orgánica\s+)?(?:\d+\/\d+)/gi,
    /\bReal\s+Decreto(?:\s+Legislativo)?\s+\d+\/\d+/gi,
    /\b(?:LEC|LECrim|LOPJ|CP|CC)\b/g
  ];
  
  refPatterns.forEach(pattern => {
    const matches = content.match(pattern);
    if (matches) {
      matches.forEach(match => legalRefs.add(match));
    }
  });
  
  return {
    keywords: Array.from(keywords).slice(0, 20), // Limitar a 20 keywords
    legalRefs: Array.from(legalRefs).slice(0, 15) // Limitar a 15 referencias
  };
}

// Función para determinar el nivel de dificultad basado en el contenido
function determineDifficulty(content: string, articleNumber?: string): string {
  // Artículos básicos (primeros artículos suelen ser definiciones)
  if (articleNumber && parseInt(articleNumber) <= 10) {
    return 'básico';
  }
  
  // Contenido complejo (procedimientos especiales, recursos extraordinarios, etc.)
  const complexPatterns = [
    /recurso\s+(?:de\s+)?(?:casación|amparo|revisión)/i,
    /procedimiento\s+(?:especial|extraordinario)/i,
    /jurisdicción\s+(?:voluntaria|contenciosa)/i,
    /conflicto\s+de\s+(?:competencia|jurisdicción)/i
  ];
  
  const hasComplexContent = complexPatterns.some(pattern => pattern.test(content));
  if (hasComplexContent) {
    return 'avanzado';
  }
  
  // Por defecto, nivel intermedio
  return 'intermedio';
}

// Función para procesar y subir una ley con embeddings mejorados
async function processLawFileV2(config: LawConfig): Promise<number> {
  const filePath = path.join('/home/brayan/lexia-chatbot/backend/temp', config.fileName);
  
  if (!fs.existsSync(filePath)) {
    console.error(`❌ Archivo no encontrado: ${filePath}`);
    return 0;
  }

  console.log(`📄 Procesando: ${config.lawTitle}`);
  console.log(`   🎯 Usando modelo: text-embedding-3-large (3072 dimensiones)`);
  
  const markdown = fs.readFileSync(filePath, 'utf-8');
  
  // Chunking inteligente
  const chunker = new IntelligentLegalChunker();
  const chunks = chunker.chunkLegalDocument(markdown);
  
  console.log(`   📊 ${chunks.length} chunks generados`);
  
  let chunksInserted = 0;
  const batchSize = 5; // Procesar en lotes para optimizar
  
  // Procesar en lotes
  for (let i = 0; i < chunks.length; i += batchSize) {
    const batch = chunks.slice(i, Math.min(i + batchSize, chunks.length));
    
    try {
      // Generar embeddings para el lote
      const embeddingInputs = batch.map(chunk => chunk.content);
      const embeddingResponse = await openai.embeddings.create({
        model: 'text-embedding-3-large', // NUEVO MODELO
        input: embeddingInputs,
        dimensions: 3072 // Especificar dimensiones explícitamente
      });
      
      // Procesar cada chunk del lote
      for (let j = 0; j < batch.length; j++) {
        const chunk = batch[j];
        const embedding = embeddingResponse.data[j].embedding;
        const chunkIndex = i + j;
        
        // Extraer keywords y referencias
        const { keywords, legalRefs } = extractKeywordsAndRefs(chunk.content);
        
        // Determinar dificultad
        const difficulty = determineDifficulty(chunk.content, chunk.metadata.articleNumber);
        
        // Preparar metadata enriquecida
        const metadata = {
          fileName: config.fileName,
          filePath: filePath,
          chunkIndex: chunkIndex,
          totalChunks: chunks.length,
          lawName: config.lawName,
          lawTitle: config.lawTitle,
          chunkType: chunk.metadata.chunkType,
          articleNumber: chunk.metadata.articleNumber,
          articleTitle: chunk.metadata.articleTitle,
          section: chunk.metadata.section,
          subsection: chunk.metadata.subsection,
          processedAt: new Date().toISOString(),
          embeddingModel: 'text-embedding-3-large',
          ...chunk.metadata
        };
        
        // Insertar en Supabase v2
        const { error } = await supabase
          .from('document_embeddings')
          .insert({
            content: chunk.content,
            embedding: embedding,
            metadata: metadata,
            document_type: 'law',
            law_name: config.lawName,
            article_number: chunk.metadata.articleNumber || null,
            section_title: chunk.metadata.articleTitle || chunk.metadata.section || null,
            category: 'oposiciones',
            // NUEVOS CAMPOS
            topic_number: null, // Las leyes no tienen número de tema
            class_number: null,
            difficulty_level: difficulty,
            exam_relevance: config.examRelevance,
            keywords: keywords,
            legal_refs: legalRefs
          });
        
        if (error) {
          console.error(`   ❌ Error insertando chunk ${chunkIndex}:`, error.message);
        } else {
          chunksInserted++;
          if (chunksInserted % 10 === 0) {
            console.log(`   ⏳ Progreso: ${chunksInserted}/${chunks.length} chunks`);
          }
        }
      }
      
      // Pausa entre lotes para evitar rate limiting
      if (i + batchSize < chunks.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
    } catch (error) {
      console.error(`   ❌ Error procesando lote ${i}-${i+batchSize}:`, error);
    }
  }
  
  console.log(`   ✅ ${config.lawTitle}: ${chunksInserted} chunks subidos`);
  return chunksInserted;
}

// Función principal
async function uploadAllLawsV2() {
  console.log('🚀 Iniciando carga de leyes con text-embedding-3-large...');
  console.log('📊 Dimensiones: 3072 (vs 1536 anterior)');
  console.log('🎯 Mejoras: Mayor precisión semántica + metadata enriquecida');
  console.log('');
  
  let totalProcessed = 0;
  let totalChunks = 0;
  
  for (const lawConfig of LAWS_CONFIG) {
    try {
      const chunksInserted = await processLawFileV2(lawConfig);
      totalChunks += chunksInserted;
      
      if (chunksInserted > 0) {
        totalProcessed++;
      }
      
      console.log(''); // Línea en blanco entre leyes
      
    } catch (error) {
      console.error(`❌ Error procesando ${lawConfig.lawTitle}:`, error);
    }
  }
  
  console.log('📊 RESUMEN FINAL:');
  console.log(`   ✅ Leyes procesadas: ${totalProcessed}/${LAWS_CONFIG.length}`);
  console.log(`   📄 Total chunks: ${totalChunks}`);
  console.log(`   🎯 Modelo: text-embedding-3-large (3072 dims)`);
  console.log(`   💾 Tabla: document_embeddings`);
  
  // Verificar estadísticas
  const { data: stats } = await supabase
    .from('embedding_stats_v2')
    .select('*');
  
  if (stats) {
    console.log('\n📈 ESTADÍSTICAS POR LEY:');
    stats.forEach((stat: any) => {
      console.log(`   - ${stat.law_name}: ${stat.chunk_count} chunks, ${stat.unique_articles || 0} artículos`);
    });
  }
}

// Ejecutar si es el archivo principal
if (require.main === module) {
  uploadAllLawsV2()
    .then(() => {
      console.log('\n✅ Proceso completado exitosamente');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n❌ Error fatal:', error);
      process.exit(1);
    });
}