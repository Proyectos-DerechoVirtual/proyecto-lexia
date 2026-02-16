#!/usr/bin/env node

// Script para procesar preguntas trampa
import { TrapQuestionProcessor } from './src/scripts/processTrapQuestions.js';
import logger from './src/utils/logger.js';

async function main() {
  logger.info('🎯 Iniciando procesamiento de preguntas trampa...');
  
  try {
    const processor = new TrapQuestionProcessor();
    const documents = await processor.processAllTrapQuestions();
    
    logger.info(`✅ ${documents.length} preguntas trampa procesadas`);
    logger.info('🤔 ¿Subir a Supabase? (continuando automáticamente...)');
    
    const uploaded = await processor.uploadToSupabase(documents);
    logger.info(`🎉 ¡Completado! ${uploaded} preguntas trampa subidas a Supabase`);
    
  } catch (error) {
    logger.error('❌ Error:', error);
    process.exit(1);
  }
}

main();