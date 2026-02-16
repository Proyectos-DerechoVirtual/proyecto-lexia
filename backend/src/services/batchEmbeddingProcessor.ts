import OpenAI from 'openai';
import { logger } from '../utils/logger';

export class BatchEmbeddingProcessor {
  private openai: OpenAI;
  private batchSize: number;

  constructor(batchSize: number = 50) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OpenAI API key not configured');
    }
    
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    
    this.batchSize = batchSize;
  }

  /**
   * Procesar embeddings en lotes para mejorar performance
   */
  async generateBatchEmbeddings(texts: string[]): Promise<number[][]> {
    const allEmbeddings: number[][] = [];
    
    // Procesar en lotes
    for (let i = 0; i < texts.length; i += this.batchSize) {
      const batch = texts.slice(i, i + this.batchSize);
      const startTime = Date.now();
      
      try {
        // OpenAI permite hasta 2048 inputs en una sola llamada
        const response = await this.openai.embeddings.create({
          model: 'text-embedding-3-small',
          input: batch,
        });
        
        const embeddings = response.data.map(item => item.embedding);
        allEmbeddings.push(...embeddings);
        
        const elapsed = Date.now() - startTime;
        logger.info(`⚡ Batch ${Math.floor(i / this.batchSize) + 1}: ${batch.length} embeddings generados en ${elapsed}ms`);
        
        // Pequeña pausa para evitar rate limiting
        if (i + this.batchSize < texts.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      } catch (error) {
        logger.error(`Error procesando batch ${Math.floor(i / this.batchSize) + 1}:`, error);
        // En caso de error, procesar uno por uno
        for (const text of batch) {
          try {
            const response = await this.openai.embeddings.create({
              model: 'text-embedding-3-small',
              input: text,
            });
            allEmbeddings.push(response.data[0].embedding);
          } catch (singleError) {
            logger.error('Error procesando embedding individual:', singleError);
            // Agregar embedding vacío para mantener sincronización
            allEmbeddings.push(new Array(1536).fill(0));
          }
        }
      }
    }
    
    return allEmbeddings;
  }

  /**
   * Calcular estadísticas de procesamiento
   */
  calculateStats(totalTexts: number, totalTime: number): void {
    const avgTimePerText = totalTime / totalTexts;
    const textsPerSecond = 1000 / avgTimePerText;
    
    logger.info(`📊 Estadísticas de procesamiento:`);
    logger.info(`   - Total de textos: ${totalTexts}`);
    logger.info(`   - Tiempo total: ${totalTime}ms`);
    logger.info(`   - Promedio por texto: ${avgTimePerText.toFixed(2)}ms`);
    logger.info(`   - Textos por segundo: ${textsPerSecond.toFixed(2)}`);
  }
}

export const createBatchProcessor = (batchSize?: number) => new BatchEmbeddingProcessor(batchSize);