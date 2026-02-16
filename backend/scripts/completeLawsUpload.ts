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

// Función para obtener el último chunk subido de una ley
async function getLastChunkIndex(lawName: string): Promise<number> {
  const { data } = await supabase
    .from('document_embeddings')
    .select('metadata')
    .eq('document_type', 'law')
    .eq('law_name', lawName)
    .order('created_at', { ascending: false })
    .limit(1);
  
  if (data && data.length > 0) {
    const metadata = data[0].metadata as any;
    return metadata?.chunkIndex || 0;
  }
  
  return -1; // No chunks found, start from beginning
}

// Función para completar la carga de una ley desde donde se quedó
async function completeLawUpload(lawName: string, fileName: string, lawTitle: string): Promise<number> {
  const filePath = path.join('/home/brayan/lexia-chatbot/backend/temp', fileName);
  
  if (!fs.existsSync(filePath)) {
    console.error(`❌ Archivo no encontrado: ${filePath}`);
    return 0;
  }

  console.log(`🔄 Completando carga de: ${lawTitle}`);
  
  // Obtener último chunk subido
  const lastChunkIndex = await getLastChunkIndex(lawName);
  console.log(`   📍 Último chunk en BD: ${lastChunkIndex}`);
  
  const markdown = fs.readFileSync(filePath, 'utf-8');
  
  // Chunking inteligente completo
  const chunker = new IntelligentLegalChunker();
  const allChunks = chunker.chunkLegalDocument(markdown);
  
  console.log(`   📊 Total chunks del archivo: ${allChunks.length}`);
  
  // Filtrar chunks que ya están subidos
  const chunksToUpload = allChunks.slice(lastChunkIndex + 1);
  console.log(`   🎯 Chunks a subir: ${chunksToUpload.length}`);
  
  if (chunksToUpload.length === 0) {
    console.log(`   ✅ ${lawTitle} ya está completa`);
    return 0;
  }
  
  let chunksInserted = 0;
  
  // Subir chunks faltantes
  for (let i = 0; i < chunksToUpload.length; i++) {
    const chunk = chunksToUpload[i];
    const actualChunkIndex = lastChunkIndex + 1 + i;
    
    try {
      // Generar embedding
      const embeddingResponse = await openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: chunk.content
      });
      
      const embedding = embeddingResponse.data[0].embedding;
      
      // Preparar metadata enriquecida
      const metadata = {
        fileName: fileName,
        filePath: filePath,
        chunkIndex: actualChunkIndex,
        totalChunks: allChunks.length,
        lawName: lawName,
        lawTitle: lawTitle,
        chunkType: chunk.metadata.chunkType,
        articleNumber: chunk.metadata.articleNumber,
        articleTitle: chunk.metadata.articleTitle,
        section: chunk.metadata.section,
        subsection: chunk.metadata.subsection,
        ...chunk.metadata
      };
      
      // Insertar en Supabase
      const { error } = await supabase
        .from('document_embeddings')
        .insert({
          content: chunk.content,
          embedding: embedding,
          metadata: metadata,
          document_type: 'law',
          law_name: lawName,
          article_number: chunk.metadata.articleNumber || null,
          section_title: chunk.metadata.articleTitle || chunk.metadata.section || null,
          category: 'oposiciones'
        });
      
      if (error) {
        console.error(`   ❌ Error insertando chunk ${actualChunkIndex}:`, error.message);
      } else {
        chunksInserted++;
        
        // Mostrar progreso cada 50 chunks
        if (chunksInserted % 50 === 0) {
          console.log(`   📊 Progreso: ${chunksInserted}/${chunksToUpload.length} chunks`);
        }
      }
      
      // Pequeña pausa para evitar rate limiting
      if (i % 10 === 0 && i > 0) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
    } catch (error: any) {
      if (error.message?.includes('maximum context length')) {
        console.log(`   ⚠️ Chunk ${actualChunkIndex} muy largo, saltando...`);
        continue;
      }
      console.error(`   ❌ Error procesando chunk ${actualChunkIndex}:`, error);
    }
  }
  
  console.log(`   ✅ ${lawTitle}: ${chunksInserted} chunks adicionales subidos`);
  return chunksInserted;
}

// Función para completar todas las leyes incompletas
async function completeAllIncompleteLaws() {
  console.log('🚀 Completando leyes incompletas...\n');
  
  const lawsToComplete = [
    {
      lawName: 'LEC',
      fileName: 'LEC Enjuiciamiento Civil.md',
      lawTitle: 'Ley de Enjuiciamiento Civil'
    },
    {
      lawName: 'TRLC', 
      fileName: 'TRLC Ley Concursal.md',
      lawTitle: 'Texto Refundido de la Ley Concursal'
    }
  ];
  
  let totalAdditionalChunks = 0;
  
  for (const lawConfig of lawsToComplete) {
    try {
      const additionalChunks = await completeLawUpload(
        lawConfig.lawName,
        lawConfig.fileName, 
        lawConfig.lawTitle
      );
      totalAdditionalChunks += additionalChunks;
      
    } catch (error) {
      console.error(`❌ Error completando ${lawConfig.lawTitle}:`, error);
    }
  }
  
  console.log(`\n🎉 Completado! ${totalAdditionalChunks} chunks adicionales subidos`);
  
  // Verificar estado final
  const { count: finalLawCount } = await supabase
    .from('document_embeddings')
    .select('*', { count: 'exact', head: true })
    .eq('document_type', 'law');
  
  console.log(`💾 Total chunks de leyes ahora: ${finalLawCount || 0}`);
}

// Ejecutar
completeAllIncompleteLaws();