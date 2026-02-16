import fs from 'fs';
import path from 'path';
import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';
import { logger } from '../utils/logger';
import { IntelligentLegalChunker, ArticleChunk } from './intelligentChunker';
import { createBatchProcessor } from './batchEmbeddingProcessor';

// Cache simple en memoria para embeddings
class EmbeddingCache {
  private cache: Map<string, number[]> = new Map();
  private maxSize: number = 100;
  
  get(text: string): number[] | undefined {
    return this.cache.get(text);
  }
  
  set(text: string, embedding: number[]): void {
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }
    this.cache.set(text, embedding);
  }
}

// Configuración de áreas y categorías
interface AreaConfig {
  areaName: string;
  areaTitle: string;
  categories: {
    folderName: string;
    categoryId: string;
    processSubfolders: boolean;
  }[];
}

const AREAS_CONFIG: AreaConfig[] = [
  {
    areaName: 'oposicionesjusticia',
    areaTitle: 'Oposiciones de Justicia',
    categories: [
      { folderName: 'legislacion', categoryId: 'legislacion', processSubfolders: false },
      { folderName: 'clases', categoryId: 'clases', processSubfolders: true },
      { folderName: 'preguntas trampa', categoryId: 'preguntas_trampa', processSubfolders: false }
    ]
  }
];

interface SearchResult {
  id: string;
  content: string;
  similarity: number;
  metadata: any;
  document_type: 'law' | 'class' | 'trap';
  law_name: string | null;
  article_number: string | null;
  section_title: string | null;
  category: string;
  search_method?: 'metadata' | 'embedding' | 'keyword';
  topic_number?: number;
  difficulty_level?: string;
  keywords?: string[];
  legal_refs?: string[];
}

export class UnifiedRAGService {
  private openai: OpenAI;
  private supabase: any;
  private chunker: IntelligentLegalChunker;
  private batchProcessor: any;
  private embeddingCache: EmbeddingCache;

  constructor() {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Supabase credentials not configured');
    }
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OpenAI API key not configured');
    }

    this.supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    this.chunker = new IntelligentLegalChunker(1500, 300);
    this.batchProcessor = createBatchProcessor(50);
    this.embeddingCache = new EmbeddingCache();
  }

  // ========== BÚSQUEDA OPTIMIZADA MEJORADA ==========

  async searchRelevantDocuments(
    query: string, 
    threshold: number = 0.2,
    limit: number = 20,
    analysisData?: any
  ): Promise<SearchResult[]> {
    try {
      const startTime = Date.now();
      logger.info(`🔍 Búsqueda inteligente iniciada - Query: "${query}"`);
      
      // Generar embedding para la consulta
      const queryEmbedding = await this.generateEmbeddingCached(query);
      
      // Preparar parámetros para búsqueda vectorial
      const searchParams: any = {
        query_embedding: queryEmbedding,
        match_threshold: threshold,
        match_count: limit
      };
      
      // MEJORA: Búsqueda híbrida más inteligente
      let vectorResults: any[] = [];
      
      // PRIMERA BÚSQUEDA: Si hay ley específica detectada, buscar en esa ley
      if (analysisData?.detected_law) {
        logger.info(`📚 Filtrando por ley detectada: ${analysisData.detected_law}`);
        const lawParams = { ...searchParams, filter_law_name: analysisData.detected_law };
        const { data: lawResults } = await this.supabase.rpc('search_documents', lawParams);
        if (lawResults?.length > 0) {
          vectorResults.push(...lawResults);
        }
      }
      
      // SEGUNDA BÚSQUEDA: Si hay temas detectados, buscar en clases
      if (analysisData?.topic_numbers?.length > 0) {
        logger.info(`📖 Filtrando por temas: ${analysisData.topic_numbers.join(', ')}`);
        for (const topicNum of analysisData.topic_numbers.slice(0, 2)) { // Máximo 2 temas
          const topicParams = { 
            ...searchParams, 
            filter_topic_number: topicNum,
            match_count: Math.ceil(limit / 2) // Dividir espacio
          };
          const { data: topicResults } = await this.supabase.rpc('search_documents', topicParams);
          if (topicResults?.length > 0) {
            vectorResults.push(...topicResults);
          }
        }
      }
      
      // TERCERA BÚSQUEDA: Preguntas trampa (siempre activa, busca puntos clave y advertencias)
      logger.info(`🎯 Búsqueda de preguntas trampa - puntos clave y advertencias`);
      const trapParams = { 
        ...searchParams, 
        filter_document_type: 'trap',
        match_count: Math.ceil(limit / 4) // Asignar espacio para trampas
      };
      const { data: trapResults } = await this.supabase.rpc('search_documents', trapParams);
      if (trapResults?.length > 0) {
        logger.info(`🎯 Encontradas ${trapResults.length} preguntas trampa relevantes`);
        vectorResults.push(...trapResults);
      }
      
      // CUARTA BÚSQUEDA: Si no hay resultados específicos, búsqueda general SIN filtros
      if (vectorResults.length < 3) {
        logger.info(`🔍 Búsqueda general sin filtros - Resultados previos: ${vectorResults.length}`);
        const { data: generalResults, error: vectorError } = await this.supabase
          .rpc('search_documents', searchParams);
        
        if (vectorError) {
          logger.error('Error en búsqueda vectorial:', vectorError);
        } else if (generalResults?.length > 0) {
          vectorResults.push(...generalResults);
        }
      }
      
      // Eliminar duplicados tempranos
      const uniqueResultsMap = new Map();
      vectorResults.forEach(result => {
        if (!uniqueResultsMap.has(result.id)) {
          uniqueResultsMap.set(result.id, result);
        }
      });
      const lawFilteredResults = Array.from(uniqueResultsMap.values());
      
      // Búsqueda adicional por metadata si hay keywords
      let metadataResults: any[] = [];
      if (analysisData?.keywords_busqueda && analysisData.keywords_busqueda.length > 0) {
        logger.info(`🔑 Usando keywords del análisis: ${analysisData.keywords_busqueda.join(', ')}`);
        
        let keywordQuery = this.supabase
          .from('document_embeddings')
          .select('*');
        
        // Si hay ley detectada, filtrar también en búsqueda por keywords
        if (analysisData?.detected_law) {
          keywordQuery = keywordQuery.eq('law_name', analysisData.detected_law);
        }
        
        for (const keyword of analysisData.keywords_busqueda) {
          const { data: keywordData } = await keywordQuery
            .ilike('content', `%${keyword}%`)
            .limit(5);
          
          if (keywordData) {
            metadataResults.push(...keywordData);
          }
        }
      }
      
      // Combinar resultados de búsqueda vectorial y metadata
      const allResults = [...(lawFilteredResults || []), ...metadataResults];
      
      // Eliminar duplicados y calcular similitud
      const uniqueResults = new Map<string, any>();
      
      for (const doc of allResults) {
        if (!uniqueResults.has(doc.id)) {
          uniqueResults.set(doc.id, {
            ...doc,
            similarity: doc.similarity || this.cosineSimilarity(queryEmbedding, doc.embedding || []),
            search_method: doc.similarity ? 'embedding' : 'keyword'
          });
        }
      }
      
      const results = Array.from(uniqueResults.values());
      
      if (!results || results.length === 0) {
        logger.info('⚠️ No se encontraron documentos');
        return [];
      }
      
      // Enriquecer resultados con boost de similitud
      const enrichedResults = results.map((doc: any) => {
        let adjustedSimilarity = doc.similarity || 0;
        let searchMethod = doc.search_method || 'embedding';
        
        // Boost si hay match de keywords
        if (doc.keywords && analysisData?.keywords_busqueda) {
          const matchedKeywords = analysisData.keywords_busqueda.filter((kw: string) => 
            doc.keywords?.some((dk: string) => dk.toLowerCase().includes(kw.toLowerCase()))
          );
          if (matchedKeywords.length > 0) {
            adjustedSimilarity = Math.min(adjustedSimilarity + 0.1 * matchedKeywords.length, 1);
            if (searchMethod === 'embedding') searchMethod = 'keyword';
          }
        }
        
        // Boost si hay match de referencias legales
        if (doc.legal_refs && analysisData?.legal_references) {
          const matchedRefs = analysisData.legal_references.filter((ref: string) =>
            doc.legal_refs?.some((dr: string) => dr.includes(ref))
          );
          if (matchedRefs.length > 0) {
            adjustedSimilarity = Math.min(adjustedSimilarity + 0.05 * matchedRefs.length, 1);
            if (searchMethod === 'embedding') searchMethod = 'metadata';
          }
        }
        
        return {
          ...doc,
          similarity: adjustedSimilarity,
          search_method: searchMethod
        };
      });
      
      // Ordenar por similitud ajustada
      enrichedResults.sort((a, b) => b.similarity - a.similarity);
      
      // Filtrar por threshold ajustado dinámicamente
      const dynamicThreshold = this.calculateDynamicThreshold(query, analysisData, threshold);
      const filteredResults = enrichedResults.filter(doc => doc.similarity >= dynamicThreshold);
      
      const elapsed = Date.now() - startTime;
      logger.info(`✅ Búsqueda completada en ${elapsed}ms - ${filteredResults.length} documentos encontrados`);
      
      return filteredResults;
      
    } catch (error) {
      logger.error('Error en búsqueda de documentos:', error);
      return [];
    }
  }

  // Calcula threshold dinámico basado en el tipo de consulta
  private calculateDynamicThreshold(query: string, analysisData: any, baseThreshold: number): number {
    // Si el análisis indica alta complejidad, ser más permisivo
    if (analysisData?.complejidad === 'alta') {
      return Math.max(baseThreshold - 0.05, 0.1);
    }
    
    // Si es una búsqueda de artículo específico, ser más estricto
    if (analysisData?.tipo === 'articulo_especifico') {
      return Math.min(baseThreshold + 0.05, 0.3);
    }
    
    // Si hay muchos keywords, ser más permisivo para capturar contexto amplio
    if (analysisData?.keywords_busqueda && analysisData.keywords_busqueda.length > 5) {
      return Math.max(baseThreshold - 0.03, 0.15);
    }
    
    return baseThreshold;
  }

  // Búsqueda por metadata específica (artículos, secciones, etc.)
  async searchByMetadata(
    field: string,
    value: string,
    limit: number = 10
  ): Promise<SearchResult[]> {
    try {
      const { data, error } = await this.supabase
        .from('document_embeddings')
        .select('*')
        .eq(field, value)
        .limit(limit);
      
      if (error) {
        logger.error(`Error buscando por ${field}:`, error);
        return [];
      }
      
      return data?.map((doc: any) => ({
        ...doc,
        similarity: 1.0, // Perfect match for metadata search
        search_method: 'metadata' as const
      })) || [];
      
    } catch (error) {
      logger.error('Error en búsqueda por metadata:', error);
      return [];
    }
  }

  // Función principal para obtener contexto mejorado
  async getEnhancedContext(
    query: string, 
    category?: string,
    analysisData?: any
  ): Promise<string> {
    try {
      const startTime = Date.now();
      logger.info(`🚀 Generando contexto mejorado con análisis AI`);
      
      // Usar análisis para ajustar parámetros de búsqueda
      const threshold = this.calculateDynamicThreshold(query, analysisData, 0.2);
      
      // Buscar documentos relevantes con análisis enriquecido
      let relevantDocs = await this.searchRelevantDocuments(query, threshold, 20, analysisData);
      
      // Si es búsqueda de artículo específico, intentar búsqueda directa por metadata
      if (analysisData?.tipo === 'articulo_especifico' && analysisData?.article_number) {
        const articleDocs = await this.searchByMetadata('article_number', analysisData.article_number, 5);
        
        // Combinar resultados, priorizando búsqueda por metadata
        if (articleDocs.length > 0) {
          const articleIds = new Set(articleDocs.map(d => d.id));
          const otherDocs = relevantDocs.filter(d => !articleIds.has(d.id));
          relevantDocs = [...articleDocs, ...otherDocs];
        }
      }
      
      // Si no hay suficientes resultados, ampliar búsqueda
      if (relevantDocs.length < 3) {
        const fallbackThreshold = Math.max(threshold - 0.1, 0.05);
        relevantDocs = await this.searchRelevantDocuments(query, fallbackThreshold, 30, analysisData);
      }
      
      return this.buildContextFromDocs(relevantDocs, analysisData, startTime);
      
    } catch (error) {
      logger.error('Error generando contexto:', error);
      return '';
    }
  }

  // Función optimizada que usa keywords adicionales del análisis AI
  async getEnhancedContextWithKeywords(
    query: string, 
    keywords: string[] = [], 
    category?: string,
    analysisData?: any
  ): Promise<string> {
    try {
      logger.info(`🔍 Búsqueda refinada con ${keywords.length} keywords del análisis AI`);
      
      // Enriquecer analysisData con keywords si no los tiene
      const enrichedAnalysis = {
        ...analysisData,
        keywords_busqueda: [...(analysisData?.keywords_busqueda || []), ...keywords]
      };
      
      return await this.getEnhancedContext(query, category, enrichedAnalysis);
      
    } catch (error) {
      logger.error('Error en búsqueda refinada:', error);
      return await this.getEnhancedContext(query, category, analysisData);
    }
  }

  // Función separada para construir contexto desde documentos
  private buildContextFromDocs(relevantDocs: SearchResult[], analysisData: any, startTime: number): string {
    const maxContextLength = 20000;
    const contextParts: string[] = [];
    let currentLength = 0;
    
    // Agrupar y priorizar documentos según el tipo de consulta
    const prioritizedDocs = this.prioritizeDocuments(relevantDocs, analysisData);
    
    // Construir contexto respetando límite de caracteres
    for (const doc of prioritizedDocs.slice(0, 15)) {
      const docText = `\n${doc.content}\n`;
      
      if (currentLength + docText.length > maxContextLength) break;
      
      contextParts.push(docText);
      currentLength += docText.length;
    }
    
    // Log de chunks seleccionados para debugging
    logger.info(`📋 CHUNKS SELECCIONADOS PARA CONTEXTO:`);
    prioritizedDocs.slice(0, contextParts.length).forEach((doc, i) => {
      logger.info(`  ${i + 1}. [${doc.document_type}] ${doc.law_name || doc.section_title || 'Sin título'} | Sim: ${(doc.similarity * 100).toFixed(1)}% | Método: ${doc.search_method}`);
      if (doc.keywords?.length) {
        logger.info(`     Keywords: ${doc.keywords.slice(0, 5).join(', ')}`);
      }
    });
    
    const finalContext = contextParts.length > 0 
      ? 'CONTEXTO:\n' + contextParts.join('\n---\n')
      : '';
    
    const elapsed = Date.now() - startTime;
    logger.info(`✅ Contexto generado en ${elapsed}ms - ${contextParts.length} chunks, ${currentLength} caracteres`);
    
    return finalContext;
  }

  // Función para priorizar documentos según el tipo de consulta
  private prioritizeDocuments(relevantDocs: SearchResult[], analysisData: any): SearchResult[] {
    const lawDocs = relevantDocs.filter(d => d.document_type === 'law');
    const classDocs = relevantDocs.filter(d => d.document_type === 'class');
    const trapDocs = relevantDocs.filter(d => d.document_type === 'trap');
    
    if (analysisData?.tipo === 'articulo_especifico' || analysisData?.requiere_articulos) {
      return [...lawDocs, ...trapDocs, ...classDocs];
    } else if (analysisData?.tipo === 'concepto_general') {
      return [...classDocs, ...trapDocs, ...lawDocs];
    } else if (analysisData?.document_type === 'trap') {
      return [...trapDocs, ...classDocs, ...lawDocs];
    } else {
      return relevantDocs.sort((a, b) => b.similarity - a.similarity);
    }
  }

  // ========== UTILIDADES ==========

  private cosineSimilarity(vec1: number[], vec2: number[]): number {
    if (vec1.length !== vec2.length) return 0;
    
    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;
    
    for (let i = 0; i < vec1.length; i++) {
      dotProduct += vec1[i] * vec2[i];
      norm1 += vec1[i] * vec1[i];
      norm2 += vec2[i] * vec2[i];
    }
    
    const denominator = Math.sqrt(norm1) * Math.sqrt(norm2);
    return denominator === 0 ? 0 : dotProduct / denominator;
  }

  private async generateEmbeddingCached(text: string): Promise<number[]> {
    const cached = this.embeddingCache.get(text);
    if (cached) {
      return cached;
    }
    
    const startTime = Date.now();
    const response = await this.openai.embeddings.create({
      model: 'text-embedding-3-large',
      input: text,
      dimensions: 3072
    });
    
    const embedding = response.data[0].embedding;
    this.embeddingCache.set(text, embedding);
    
    const elapsed = Date.now() - startTime;
    logger.info(`⚡ Embedding generado en ${elapsed}ms`);
    
    return embedding;
  }

  private splitTextIntoChunks(
    text: string, 
    maxChunkSize: number = 1000, 
    _overlap: number = 200
  ): string[] {
    const chunks: string[] = [];
    const sentences = text.split(/(?<=[.!?])\s+/);
    let currentChunk = '';

    for (const sentence of sentences) {
      if (currentChunk.length + sentence.length > maxChunkSize && currentChunk.length > 0) {
        chunks.push(currentChunk.trim());
        
        const overlapText = currentChunk.split(/(?<=[.!?])\s+/).slice(-2).join(' ');
        currentChunk = overlapText + ' ' + sentence;
      } else {
        currentChunk += (currentChunk ? ' ' : '') + sentence;
      }
    }

    if (currentChunk.trim()) {
      chunks.push(currentChunk.trim());
    }

    return chunks;
  }

  async warmupCache(): Promise<void> {
    const commonQueries = [
      'constitución', 'derechos fundamentales', 'poder judicial',
      'igualdad', 'discriminación', 'proceso civil', 'concurso acreedores'
    ];
    
    await Promise.all(commonQueries.map(q => this.generateEmbeddingCached(q)));
    logger.info('✅ Cache pre-calentado');
  }

  async getDocumentStats(): Promise<any> {
    const { count: totalChunks } = await this.supabase
      .from('document_embeddings')
      .select('*', { count: 'exact', head: true });

    const { data: allDocs } = await this.supabase
      .from('document_embeddings')
      .select('law_name, document_type, category');

    if (!allDocs) {
      return {
        totalChunks: 0,
        totalLaws: 0,
        totalClassTopics: 0,
        lawChunks: 0,
        classChunks: 0,
        documentsByType: {},
        documentsByCategory: {}
      };
    }

    const uniqueLaws = new Set(allDocs.filter((d: any) => d.law_name).map((d: any) => d.law_name));
    const uniqueClassTopics = new Set(
      allDocs
        .filter((d: any) => d.document_type === 'class')
        .map((d: any) => d.category)
    );

    const documentsByType = allDocs.reduce((acc: any, doc: any) => {
      acc[doc.document_type] = (acc[doc.document_type] || 0) + 1;
      return acc;
    }, {});

    const documentsByCategory = allDocs.reduce((acc: any, doc: any) => {
      if (doc.category) {
        acc[doc.category] = (acc[doc.category] || 0) + 1;
      }
      return acc;
    }, {});

    return {
      totalChunks,
      totalLaws: uniqueLaws.size,
      totalClassTopics: uniqueClassTopics.size,
      lawChunks: documentsByType.law || 0,
      classChunks: documentsByType.class || 0,
      documentsByType,
      documentsByCategory
    };
  }
}

// Singleton para mantener una única instancia
let ragServiceInstance: UnifiedRAGService | null = null;

export function getUnifiedRAGService(): UnifiedRAGService {
  if (!ragServiceInstance) {
    ragServiceInstance = new UnifiedRAGService();
  }
  return ragServiceInstance;
}