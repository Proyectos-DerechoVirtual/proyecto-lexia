#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { TrapQuestionChunker } from '../services/trapQuestionChunker.js';
import logger from '../utils/logger.js';
import { BatchEmbeddingProcessor } from '../services/batchEmbeddingProcessor.js';

interface TrapQuestionDocument {
  id?: number;
  content: string;
  embedding?: number[];
  metadata: any;
  document_type: 'trap';
  law_name: string;
  article_number?: string;
  section_title: string;
  category: string;
}

class TrapQuestionProcessor {
  
  async processAllTrapQuestions() {
    logger.info('🎯 Iniciando procesamiento de preguntas trampa...');
    
    const baseDir = '/home/brayan/lexia-chatbot/backend/legal-docs/oposicionesjusticia/preguntas trampa';
    const outputDir = '/home/brayan/lexia-chatbot/backend/legal-docs/oposicionesjusticia/preguntas-trampa-md';
    
    // 1. Crear directorio de salida
    await this.createOutputDirectories(outputDir);
    
    // 2. Procesar todos los directorios de temas
    const topicDirs = fs.readdirSync(baseDir, { withFileTypes: true })
      .filter(dir => dir.isDirectory())
      .map(dir => dir.name);
    
    let allDocuments: TrapQuestionDocument[] = [];
    
    for (const topicDir of topicDirs) {
      const topicPath = path.join(baseDir, topicDir);
      logger.info(`📁 Procesando tema: ${topicDir}`);
      
      // Procesar chunks del tema
      const chunks = await TrapQuestionChunker.processDirectory(topicPath);
      
      // Convertir a markdown
      const markdownFiles = TrapQuestionChunker.convertToMarkdown(chunks);
      
      // Guardar archivos markdown
      for (const file of markdownFiles) {
        await this.saveMarkdownFile(file.filePath, file.content);
        
        // Crear documento para Supabase
        const document: TrapQuestionDocument = {
          content: file.content,
          metadata: file.metadata,
          document_type: 'trap',
          law_name: file.metadata.topicName,
          section_title: file.metadata.questionTitle,
          category: 'preguntas_trampa'
        };
        
        allDocuments.push(document);
      }
    }
    
    logger.info(`✅ Procesados ${allDocuments.length} documentos de preguntas trampa`);
    
    // 3. Generar embeddings
    logger.info('🤖 Generando embeddings...');
    const processor = new BatchEmbeddingProcessor();
    const documentsWithEmbeddings = await processor.processDocuments(allDocuments.map(doc => ({
      content: doc.content,
      metadata: doc.metadata
    })));
    
    // 4. Guardar documentos temporalmente para revisión
    const tempFile = '/home/brayan/lexia-chatbot/backend/temp/trap-questions-processed.json';
    fs.writeFileSync(tempFile, JSON.stringify({
      totalDocuments: documentsWithEmbeddings.length,
      processedAt: new Date().toISOString(),
      documents: documentsWithEmbeddings
    }, null, 2));
    
    logger.info(`💾 Documentos guardados temporalmente en: ${tempFile}`);
    logger.info(`🎯 ¡Procesamiento completado! ${documentsWithEmbeddings.length} preguntas trampa listas para subir`);
    
    return documentsWithEmbeddings;
  }
  
  private async createOutputDirectories(baseOutputDir: string) {
    // Crear directorio base
    if (!fs.existsSync(baseOutputDir)) {
      fs.mkdirSync(baseOutputDir, { recursive: true });
    }
    
    // Crear subdirectorios por tema
    const themes = [
      'tema01_constitucion_espanola',
      'tema1_2_LOTC'
    ];
    
    for (const theme of themes) {
      const themeDir = path.join(baseOutputDir, theme);
      if (!fs.existsSync(themeDir)) {
        fs.mkdirSync(themeDir, { recursive: true });
      }
    }
    
    logger.info(`📁 Directorios de salida creados en: ${baseOutputDir}`);
  }
  
  private async saveMarkdownFile(filePath: string, content: string) {
    const dir = path.dirname(filePath);
    
    // Crear directorio si no existe
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    // Guardar archivo
    fs.writeFileSync(filePath, content, 'utf8');
  }
  
  /**
   * Función auxiliar para subir a Supabase (se ejecuta después)
   */
  async uploadToSupabase(documents: any[]) {
    const { createClient } = await import('@supabase/supabase-js');
    
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
      throw new Error('Variables de entorno de Supabase no configuradas');
    }
    
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
    
    logger.info(`📤 Subiendo ${documents.length} preguntas trampa a Supabase...`);
    
    // Subir en lotes de 50
    const batchSize = 50;
    let uploaded = 0;
    
    for (let i = 0; i < documents.length; i += batchSize) {
      const batch = documents.slice(i, i + batchSize);
      
      const { error } = await supabase
        .from('document_embeddings')
        .insert(batch);
      
      if (error) {
        logger.error(`❌ Error subiendo lote ${Math.floor(i / batchSize) + 1}:`, error);
        throw error;
      }
      
      uploaded += batch.length;
      logger.info(`📤 Subido lote ${Math.floor(i / batchSize) + 1}/${Math.ceil(documents.length / batchSize)} (${uploaded}/${documents.length})`);
    }
    
    logger.info(`✅ ¡${uploaded} preguntas trampa subidas exitosamente a Supabase!`);
    return uploaded;
  }
}

// Ejecutar si se llama directamente
if (import.meta.url === `file://${process.argv[1]}`) {
  const processor = new TrapQuestionProcessor();
  
  processor.processAllTrapQuestions()
    .then((documents) => {
      logger.info('🎯 ¿Quieres subir las preguntas trampa a Supabase? (y/n)');
      
      // Para propósitos de demostración, subimos automáticamente
      // En un entorno real, podrías pedir confirmación del usuario
      return processor.uploadToSupabase(documents);
    })
    .then((uploaded) => {
      logger.info(`🎉 ¡Proceso completado! ${uploaded} preguntas trampa procesadas y subidas.`);
      process.exit(0);
    })
    .catch((error) => {
      logger.error('❌ Error en el procesamiento:', error);
      process.exit(1);
    });
}

export { TrapQuestionProcessor };