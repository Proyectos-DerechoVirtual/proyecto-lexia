#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Cargar variables de entorno
dotenv.config();

const logger = {
  info: (...args) => console.log('[INFO]', ...args),
  error: (...args) => console.error('[ERROR]', ...args),
  warn: (...args) => console.warn('[WARN]', ...args)
};

// Configuración
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

class SimpleChunker {
  static extractFileInfo(fileName, filePath) {
    // Hacer más flexible el regex para capturar diferentes formatos
    const match = fileName.match(/^(T\d{1,2}[._]?\d*)_C(\d{1,2})\s*(.+)_TRAMPA\.txt$/);
    
    if (!match) {
      logger.warn(`Formato no estándar, usando formato genérico para: ${fileName}`);
      // Fallback para archivos con formato no estándar
      const parts = fileName.replace('_TRAMPA.txt', '').split('_');
      if (parts.length < 3) {
        throw new Error(`No se puede procesar el archivo: ${fileName}`);
      }
      const topicCode = parts[0];
      const classNum = parts[1].replace('C', '');
      const classTitle = parts.slice(2).join(' ');
      
      return {
        topicName: 'tema01_constitucion_espanola', // default
        topicTitle: 'Constitución Española',
        topicNumber: 1,
        classTitle,
        classNumber: `${topicCode}_${parts[1]}`,
        classNumberInt: parseInt(classNum) || 1,
        fileName,
        filePath
      };
    }
    
    const [, topicCode, classNum, classTitle] = match;
    const topicNumber = parseInt(topicCode.replace('T', ''));
    const classNumberInt = parseInt(classNum);
    const classNumber = `${topicCode}_C${classNum}`;
    
    const pathParts = filePath.split('/');
    const topicFolderName = pathParts[pathParts.length - 2];
    const topicName = topicFolderName.replace('_TRAMPA', '');
    
    const topicTitles = {
      'tema01_constitucion_espanola': 'Constitución Española',
      'tema1_2_LOTC': 'Ley Orgánica del Tribunal Constitucional'
    };
    
    const topicTitle = topicTitles[topicName] || topicName.replace(/_/g, ' ');
    
    return {
      topicName,
      topicTitle,
      topicNumber,
      classTitle: classTitle.replace(/_/g, ' '),
      classNumber,
      classNumberInt,
      fileName,
      filePath
    };
  }
  
  static processFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const fileName = path.basename(filePath);
    const fileInfo = this.extractFileInfo(fileName, filePath);
    
    const sections = content.split(/\n---\n/).filter(section => section.trim());
    const chunks = [];
    
    for (let i = 0; i < sections.length; i++) {
      const section = sections[i].trim();
      if (!section) continue;
      
      const lines = section.split('\n').filter(line => line.trim());
      if (lines.length === 0) continue;
      
      const firstLine = lines[0].trim();
      const questionMatch = firstLine.match(/^(\d+)\.\s*(.+)$/);
      
      let questionNumber;
      let questionTitle;
      
      if (questionMatch) {
        questionNumber = parseInt(questionMatch[1]);
        questionTitle = questionMatch[2];
      } else {
        questionTitle = firstLine;
      }
      
      const hasReminder = section.includes('Recuerda:');
      const hasWarning = section.includes('Ten cuidado:');
      const hasMnemonic = section.includes('Regla mnemotécnica:');
      
      const metadata = {
        fileName: fileInfo.fileName,
        filePath,
        chunkType: 'question',
        chunkIndex: i,
        totalChunks: sections.length,
        topicName: fileInfo.topicName,
        topicTitle: fileInfo.topicTitle,
        topicNumber: fileInfo.topicNumber,
        classTitle: fileInfo.classTitle,
        classNumber: fileInfo.classNumber,
        classNumberInt: fileInfo.classNumberInt,
        questionNumber,
        questionTitle,
        hasReminder,
        hasWarning,
        hasMnemonic,
        originalIndex: i * 2,
        processedAt: new Date().toISOString(),
        embeddingModel: 'text-embedding-3-large'
      };
      
      chunks.push({ content: section, metadata });
    }
    
    return chunks;
  }
}

async function processAllTrapQuestions() {
  logger.info('🎯 Iniciando procesamiento de preguntas trampa...');
  
  const baseDir = './legal-docs/oposicionesjusticia/preguntas trampa';
  const allDocuments = [];
  
  const topicDirs = fs.readdirSync(baseDir, { withFileTypes: true })
    .filter(dir => dir.isDirectory())
    .map(dir => dir.name);
  
  for (const topicDir of topicDirs) {
    const topicPath = path.join(baseDir, topicDir);
    logger.info(`📁 Procesando tema: ${topicDir}`);
    
    const files = fs.readdirSync(topicPath, { withFileTypes: true });
    
    for (const file of files) {
      if (file.isFile() && file.name.endsWith('_TRAMPA.txt') && !file.name.includes('Zone.Identifier')) {
        const filePath = path.join(topicPath, file.name);
        logger.info(`📝 Procesando: ${file.name}`);
        
        const chunks = SimpleChunker.processFile(filePath);
        
        for (const chunk of chunks) {
          const document = {
            content: chunk.content,
            metadata: chunk.metadata,
            document_type: 'trap',
            law_name: chunk.metadata.topicName,
            section_title: chunk.metadata.questionTitle,
            category: 'preguntas_trampa'
          };
          
          allDocuments.push(document);
        }
      }
    }
  }
  
  logger.info(`✅ Procesados ${allDocuments.length} documentos`);
  
  // Generar embeddings
  logger.info('🤖 Generando embeddings...');
  const documentsWithEmbeddings = [];
  const batchSize = 50;
  
  for (let i = 0; i < allDocuments.length; i += batchSize) {
    const batch = allDocuments.slice(i, i + batchSize);
    const texts = batch.map(doc => doc.content);
    
    try {
      const response = await openai.embeddings.create({
        model: 'text-embedding-3-large',
        input: texts,
      });
      
      const embeddings = response.data.map(item => item.embedding);
      
      for (let j = 0; j < batch.length; j++) {
        documentsWithEmbeddings.push({
          ...batch[j],
          embedding: embeddings[j]
        });
      }
      
      logger.info(`⚡ Batch ${Math.floor(i / batchSize) + 1}: ${batch.length} embeddings generados`);
      
    } catch (error) {
      logger.error(`Error generando embeddings para batch ${Math.floor(i / batchSize) + 1}:`, error);
      throw error;
    }
  }
  
  // Subir a Supabase
  logger.info(`📤 Subiendo ${documentsWithEmbeddings.length} preguntas trampa a Supabase...`);
  
  const uploadBatchSize = 50;
  let uploaded = 0;
  
  for (let i = 0; i < documentsWithEmbeddings.length; i += uploadBatchSize) {
    const batch = documentsWithEmbeddings.slice(i, i + uploadBatchSize);
    
    const { error } = await supabase
      .from('document_embeddings')
      .insert(batch);
    
    if (error) {
      logger.error(`❌ Error subiendo lote ${Math.floor(i / uploadBatchSize) + 1}:`, error);
      throw error;
    }
    
    uploaded += batch.length;
    logger.info(`📤 Subido lote ${Math.floor(i / uploadBatchSize) + 1}/${Math.ceil(documentsWithEmbeddings.length / uploadBatchSize)} (${uploaded}/${documentsWithEmbeddings.length})`);
  }
  
  logger.info(`🎉 ¡Completado! ${uploaded} preguntas trampa subidas exitosamente`);
  return uploaded;
}

// Ejecutar
processAllTrapQuestions()
  .then((count) => {
    logger.info(`✅ Proceso finalizado: ${count} preguntas trampa procesadas y subidas`);
    process.exit(0);
  })
  .catch((error) => {
    logger.error('❌ Error:', error);
    process.exit(1);
  });