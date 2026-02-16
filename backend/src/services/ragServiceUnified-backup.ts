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
  document_type: 'law' | 'class';
  law_name: string | null;
  article_number: string | null;
  section_title: string | null;
  category: string;
  search_method?: 'metadata' | 'embedding';
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

  // ========== PROCESAMIENTO DE DOCUMENTOS ==========
  // Los documentos se procesan ahora externamente con scripts especializados
  // uploadLawsToSupabase.ts y uploadClassesToSupabase.ts

  // ========== BÚSQUEDA OPTIMIZADA ==========

  async searchRelevantDocuments(
    query: string, 
    matchThreshold: number = 0.2, 
    matchCount: number = 5,
    targetLaw?: string
  ): Promise<SearchResult[]> {
    const startTime = Date.now();
    
    try {
      logger.info(`🚀 Búsqueda RAG - Query: "${query}"`);
      
      // Detectar si buscan artículos específicos (múltiples)
      // Patrón 1: "artículo 22" (formato estándar)
      const articleMatches = query.match(/art[íi]culos?\s*(\d+)/gi) || [];
      let articleNumbers = articleMatches.map(match => {
        const num = match.match(/(\d+)/);
        return num ? num[1] : null;
      }).filter(Boolean);
      
      // Patrón 2: "artículos 22, 23, 25 y 27" o "articulos 22,23,25 y 27"
      const multiplePattern = /art[íi]culos?\s+(?:\d+(?:\s*[,y]\s*|\s+y\s+|\s+)*)+/gi;
      const multipleMatch = query.match(multiplePattern);
      if (multipleMatch && multipleMatch.length > 0) {
        const numbersInMultiple = multipleMatch[0].match(/\d+/g) || [];
        articleNumbers = [...new Set([...articleNumbers, ...numbersInMultiple])];
      }
      
      // Patrón 3: números sueltos después de mencionar artículos
      if (query.toLowerCase().includes('articulo') && articleNumbers.length === 0) {
        const allNumbers = query.match(/\b\d+\b/g) || [];
        if (allNumbers.length > 1) {
          articleNumbers = allNumbers.filter(num => parseInt(num) < 1000); // Filtrar números razonables para artículos
        }
      }
      
      // Para compatibilidad, usar el primer artículo como primary
      const articleNumber = articleNumbers.length > 0 ? articleNumbers[0] : undefined;
      
      logger.info(`🎯 Artículos detectados: [${articleNumbers.join(', ')}]`);
      
      // Ejecutar búsquedas en paralelo
      const [metadataResults, embeddingResults] = await Promise.all([
        articleNumbers.length > 0 ? this.searchMultipleArticlesByMetadata(articleNumbers, targetLaw) : Promise.resolve([]),
        this.searchByEmbedding(query, articleNumber, matchThreshold, matchCount)
      ]);
      
      // Combinar resultados
      const combinedResults = this.combineResults(metadataResults, embeddingResults, articleNumber);
      
      const elapsed = Date.now() - startTime;
      logger.info(`✅ Búsqueda completada en ${elapsed}ms - ${combinedResults.length} resultados`);
      
      return combinedResults.slice(0, matchCount);
    } catch (error) {
      logger.error('Error en búsqueda:', error);
      return [];
    }
  }

  private async searchByMetadata(articleNumber: string, targetLaw?: string): Promise<SearchResult[]> {
    // Si tenemos una ley específica, priorizarla
    if (targetLaw) {
      const { data: specificLaw, error: specificError } = await this.supabase
        .from('document_embeddings')
        .select('id, content, metadata, document_type, law_name, article_number, section_title, category')
        .eq('article_number', articleNumber)
        .eq('law_name', targetLaw)
        .eq('document_type', 'law')
        .limit(3);
      
      if (!specificError && specificLaw && specificLaw.length > 0) {
        return specificLaw.map((item: any) => ({
          ...item,
          similarity: 1.0,
          search_method: 'metadata' as const
        }));
      }
    }
    
    // Búsqueda general si no hay ley específica o no se encontró
    const { data, error } = await this.supabase
      .from('document_embeddings')
      .select('id, content, metadata, document_type, law_name, article_number, section_title, category')
      .eq('article_number', articleNumber)
      .eq('document_type', 'law')
      .limit(10); // Aumentar límite para incluir más leyes
    
    if (error || !data) return [];
    
    return data.map((item: any) => ({
      ...item,
      similarity: 1.0,
      search_method: 'metadata' as const
    }));
  }

  private async searchMultipleArticlesByMetadata(articleNumbers: string[], targetLaw?: string): Promise<SearchResult[]> {
    try {
      logger.info(`🔍 Buscando múltiples artículos: [${articleNumbers.join(', ')}] en ${targetLaw || 'todas las leyes'}`);
      
      // Si tenemos una ley específica, buscar todos los artículos en esa ley
      if (targetLaw) {
        const { data: specificLaw, error: specificError } = await this.supabase
          .from('document_embeddings')
          .select('id, content, metadata, document_type, law_name, article_number, section_title, category')
          .in('article_number', articleNumbers)
          .eq('law_name', targetLaw)
          .eq('document_type', 'law')
          .limit(20); // Más límite para múltiples artículos
        
        if (!specificError && specificLaw && specificLaw.length > 0) {
          logger.info(`✅ Encontrados ${specificLaw.length} artículos en ${targetLaw}`);
          return specificLaw.map((item: any) => ({
            ...item,
            similarity: 1.0,
            search_method: 'metadata' as const
          }));
        }
      }
      
      // Búsqueda general si no hay ley específica o no se encontró
      const { data, error } = await this.supabase
        .from('document_embeddings')
        .select('id, content, metadata, document_type, law_name, article_number, section_title, category')
        .in('article_number', articleNumbers)
        .eq('document_type', 'law')
        .limit(30); // Límite generoso para múltiples artículos de múltiples leyes
      
      if (error || !data) {
        logger.error('Error en búsqueda múltiple:', error);
        return [];
      }
      
      logger.info(`✅ Encontrados ${data.length} artículos en total`);
      
      return data.map((item: any) => ({
        ...item,
        similarity: 1.0,
        search_method: 'metadata' as const
      }));
    } catch (error) {
      logger.error('Error en searchMultipleArticlesByMetadata:', error);
      return [];
    }
  }

  private async searchByEmbedding(
    query: string, 
    articleNumber: string | undefined,
    matchThreshold: number,
    matchCount: number
  ): Promise<SearchResult[]> {
    let expandedQuery = query;
    if (articleNumber) {
      expandedQuery = `Artículo ${articleNumber}`;
    } else {
      expandedQuery = query.replace(/¿|qué dice|de la ley.*|del.*|[\?]/gi, '').trim();
    }
    
    const queryEmbedding = await this.generateEmbeddingCached(expandedQuery);
    
    const { data, error } = await this.supabase.rpc('search_documents', {
      query_embedding: queryEmbedding,
      match_threshold: articleNumber ? 0.1 : matchThreshold,
      match_count: matchCount * 2
    });

    if (error || !data) return [];
    
    return data.map((item: any) => ({
      ...item,
      search_method: 'embedding' as const
    }));
  }

  private combineResults(
    metadataResults: SearchResult[],
    embeddingResults: SearchResult[],
    articleNumber?: string
  ): SearchResult[] {
    const results: SearchResult[] = [...metadataResults];
    const existingIds = new Set(metadataResults.map(r => r.id));
    
    for (const embResult of embeddingResults) {
      if (!existingIds.has(embResult.id)) {
        results.push(embResult);
      }
    }
    
    return results.sort((a, b) => {
      if (articleNumber) {
        if (a.search_method === 'metadata' && b.search_method !== 'metadata') return -1;
        if (b.search_method === 'metadata' && a.search_method !== 'metadata') return 1;
        
        const aHasArticle = a.article_number === articleNumber;
        const bHasArticle = b.article_number === articleNumber;
        if (aHasArticle && !bHasArticle) return -1;
        if (bHasArticle && !aHasArticle) return 1;
      }
      
      return (b.similarity || 0) - (a.similarity || 0);
    });
  }

  async getEnhancedContext(query: string, _conversationCategory?: string): Promise<string> {
    const startTime = Date.now();
    
    try {
      // Detectar si buscan un artículo específico
      const articleMatch = query.match(/art[íi]culo\s*(\d+)/i);
      const articleNumber = articleMatch ? articleMatch[1] : undefined;
      
      // Detectar qué ley específica están pidiendo con patrones mejorados
      let targetLaw: string | undefined;
      const queryLower = query.toLowerCase().replace(/[^\w\s]/g, ' '); // Limpiar puntuación
      
      // Ley 50/1997 del Gobierno - Patrones múltiples
      if (this.matchesLawPattern(queryLower, [
        // Formas oficiales
        /ley\s*(?:50|cincuenta)\s*[\/-]?\s*(?:19)?97/,
        /ley\s*50\s+97/,
        /ley\s+del\s+gobierno/,
        /ley\s+de\s+gobierno/,
        // Variaciones comunes
        /l\s*e\s*y\s+gobierno/,
        /ley\s*50/,
        /gobierno\s+ley/,
        // Con typos
        /ley\s+del\s+govierno/,
        /ley\s+del\s+gobieno/,
        /gob[ie]erno/
      ])) {
        targetLaw = 'Ley_50_1997_Gobierno';
      }
      
      // Ley Registro Civil - Múltiples formas
      else if (this.matchesLawPattern(queryLower, [
        // Formas oficiales
        /registro\s+civil/,
        /ley\s+(?:20|veinte)\s*[\/-]?\s*2011/,
        /ley\s+del\s+registro\s+civil/,
        // Abreviaciones
        /\bl\s*r\s*c\b/,
        /\blrc\b/,
        // Con typos y variaciones
        /regist[ro]+\s+civil/,
        /registro\s+civ[il]+/,
        /reg[iy]stro\s+civil/,
        /civil\s+registro/
      ])) {
        targetLaw = 'LRC';
      }
      
      // LEC - Enjuiciamiento Civil
      else if (this.matchesLawPattern(queryLower, [
        // Formas oficiales
        /ley\s+(?:de\s+)?enjuiciamiento\s+civil/,
        /enjuiciamiento\s+civil/,
        // Abreviaciones
        /\bl\s*e\s*c\b/,
        /\blec\b/,
        // Variaciones
        /proceso\s+civil/,
        /procedimiento\s+civil/,
        /juicio\s+civil/,
        // Con typos
        /enju[iy]ciamiento\s+civil/,
        /enjuisciamiento\s+civil/,
        /civil\s+enjuiciamiento/
      ])) {
        targetLaw = 'LEC';
      }
      
      // LECrim - Enjuiciamiento Criminal
      else if (this.matchesLawPattern(queryLower, [
        // Formas oficiales
        /ley\s+(?:de\s+)?enjuiciamiento\s+criminal/,
        /enjuiciamiento\s+criminal/,
        /enjuiciamiento\s+penal/,
        // Abreviaciones
        /\bl\s*e\s*crim\b/,
        /\blecrim\b/,
        /\bl\s*e\s*c\s*rim\b/,
        // Variaciones
        /proceso\s+penal/,
        /procedimiento\s+penal/,
        /juicio\s+penal/,
        // Con typos
        /enju[iy]ciamiento\s+criminal/,
        /enjuisciamiento\s+criminal/,
        /criminal\s+enjuiciamiento/,
        /penal\s+enjuiciamiento/
      ])) {
        targetLaw = 'LECrim';
      }
      
      // Ley 3/2007 de Igualdad
      else if (this.matchesLawPattern(queryLower, [
        // Formas oficiales
        /ley\s*(?:3|tres)\s*[\/-]?\s*(?:20)?07/,
        /ley\s*3\s+(?:20)?07/,
        /ley\s+(?:de\s+)?igualdad/,
        /igualdad\s+(?:efectiva\s+)?(?:de\s+)?(?:mujeres?\s+y\s+hombres?|genero)/,
        // Variaciones
        /igualdad\s+de\s+genero/,
        /igualdad\s+efectiva/,
        /mujeres?\s+y\s+hombres?/,
        /ley\s*3/,
        // Con typos
        /igua?l*dad/,
        /iguld[a]*d/,
        /ig[iu]l?dad/,
        /igu[al]*d[ad]*/,
        /ley\s+igualda[d]*/
      ])) {
        targetLaw = 'Ley_3_2007_Igualdad';
      }
      
      // TRLC - Ley Concursal
      else if (this.matchesLawPattern(queryLower, [
        // Formas oficiales
        /(?:real\s+decreto\s+)?(?:legislativo\s+)?1\s*[\/-]?\s*2020/,
        /ley\s+concursal/,
        /texto\s+refundido.*concursal/,
        // Abreviaciones
        /\bt\s*r\s*l\s*c\b/,
        /\btrlc\b/,
        // Variaciones
        /concurso\s+(?:de\s+)?acreedores/,
        /insolvencia/,
        /quiebra/,
        // Con typos
        /conc[ou]rsal/,
        /concurs[ao]l/
      ])) {
        targetLaw = 'TRLC';
      }
      
      // Ajustar threshold según el tipo de pregunta
      let threshold = 0.2;
      // Para preguntas generales, bajar el threshold para ser más inclusivo
      if (!articleNumber && (
        query.toLowerCase().includes('requisitos') ||
        query.toLowerCase().includes('funciones') ||
        query.toLowerCase().includes('qué es') ||
        query.toLowerCase().includes('establecimiento')
      )) {
        threshold = 0.15;
      }
      
      // Para términos muy específicos, bajar aún más el threshold
      if (query.toLowerCase().includes('racismo') ||
          query.toLowerCase().includes('inmobiliario') ||
          query.toLowerCase().includes('lucas') ||
          query.toLowerCase().includes('institutos preconcursales') ||
          query.toLowerCase().includes('discriminación')) {
        threshold = 0.1; // Muy bajo para capturar contenido específico
      }
      
      // Para términos muy específicos, buscar también por texto directo
      let relevantDocs = await this.searchRelevantDocuments(query, threshold, 20, targetLaw);
      
      // Búsqueda adicional por texto para términos específicos
      if (query.toLowerCase().includes('racismo inmobiliario')) {
        const { data: textSearchData, error } = await this.supabase
          .from('document_embeddings')
          .select('id, content, metadata, document_type, law_name, article_number, section_title, category')
          .ilike('content', '%racismo inmobiliario%')
          .limit(5);
        
        if (!error && textSearchData) {
          const textResults = textSearchData.map((doc: any) => ({
            id: doc.id,
            content: doc.content,
            metadata: doc.metadata,
            document_type: doc.document_type,
            law_name: doc.law_name,
            article_number: doc.article_number,
            section_title: doc.section_title,
            category: doc.category,
            similarity: 0.9, // Alta similitud artificial para priorizarlo
            search_method: 'text_search' as const
          }));
          
          // Agregar al principio los resultados de búsqueda por texto
          relevantDocs = [...textResults, ...relevantDocs];
          logger.info(`🔍 Búsqueda por texto añadió ${textResults.length} resultados específicos`);
        }
      }
      
      if (relevantDocs.length === 0) {
        return '';
      }

      // Aplicar filtros de priorización
      let filteredDocs = relevantDocs;
      
      // 1. Si buscan un artículo específico de una ley específica
      if (articleNumber && targetLaw) {
        const exactMatch = relevantDocs.filter(doc => 
          doc.article_number === articleNumber && 
          doc.law_name === targetLaw
        );
        
        if (exactMatch.length > 0) {
          const otherFromSameLaw = relevantDocs.filter(doc => 
            doc.law_name === targetLaw && 
            doc.article_number !== articleNumber
          );
          const otherDocs = relevantDocs.filter(doc => 
            doc.law_name !== targetLaw
          );
          filteredDocs = [...exactMatch, ...otherFromSameLaw, ...otherDocs];
        }
      }
      // 2. Si buscan solo un artículo específico (sin ley específica)
      else if (articleNumber) {
        const exactArticleDocs = relevantDocs.filter(doc => 
          doc.article_number === articleNumber
        );
        
        if (exactArticleDocs.length > 0) {
          const otherDocs = relevantDocs.filter(doc => 
            doc.article_number !== articleNumber
          );
          filteredDocs = [...exactArticleDocs, ...otherDocs];
        }
      }
      // 3. Si buscan una ley específica (sin artículo)
      else if (targetLaw) {
        const sameLawDocs = relevantDocs.filter(doc => 
          doc.law_name === targetLaw
        );
        const otherDocs = relevantDocs.filter(doc => 
          doc.law_name !== targetLaw
        );
        filteredDocs = [...sameLawDocs, ...otherDocs];
        
        // Si no encontramos chunks de la ley específica, usar fallback
        if (sameLawDocs.length === 0) {
          logger.info(`🔍 Fallback: No se encontraron chunks de ${targetLaw}, obteniendo contexto general`);
          
          const { data: fallbackData, error } = await this.supabase
            .from('document_embeddings')
            .select('id, content, metadata, document_type, law_name, article_number, section_title, category')
            .eq('law_name', targetLaw)
            .eq('document_type', 'law')
            .limit(6);
          
          if (!error && fallbackData && fallbackData.length > 0) {
            const fallbackDocs = fallbackData.map((doc: any) => ({
              id: doc.id,
              content: doc.content,
              metadata: doc.metadata,
              document_type: doc.document_type,
              law_name: doc.law_name,
              article_number: doc.article_number,
              section_title: doc.section_title,
              category: doc.category,
              similarity: 0.1
            }));
            filteredDocs = [...fallbackDocs, ...otherDocs];
            logger.info(`✅ Fallback añadió ${fallbackDocs.length} chunks de ${targetLaw}`);
          }
        }
      }

      const maxContextLength = 20000; // ~5000 tokens para 15 chunks (4 chars/token)
      let contextParts: string[] = [];
      let currentLength = 0;
      
      // Priorizar chunks que contengan palabras clave específicas
      const keywordQueries = ['racismo', 'inmobiliario', 'lucas', 'patria potestad', 'institutos preconcursales'];
      const queryWords = query.toLowerCase().split(' ');
      const hasSpecialKeywords = keywordQueries.some(keyword => 
        query.toLowerCase().includes(keyword)
      );
      
      let prioritizedDocs = filteredDocs;
      if (hasSpecialKeywords) {
        // Separar chunks que contienen keywords vs los que no
        const matchingChunks = filteredDocs.filter(doc => 
          keywordQueries.some(keyword => 
            doc.content.toLowerCase().includes(keyword)
          )
        );
        const otherChunks = filteredDocs.filter(doc => 
          !keywordQueries.some(keyword => 
            doc.content.toLowerCase().includes(keyword)
          )
        );
        // Priorizar los que tienen keywords
        prioritizedDocs = [...matchingChunks, ...otherChunks];
        
        if (matchingChunks.length > 0) {
          logger.info(`🎯 Priorizando ${matchingChunks.length} chunks con keywords específicas`);
        }
      }
      
      // Aumentado a 15 chunks máximos para mayor precisión
      for (const doc of prioritizedDocs.slice(0, 15)) {
        const docText = `\n${doc.content}\n`;
        
        if (currentLength + docText.length > maxContextLength) break;
        
        contextParts.push(docText);
        currentLength += docText.length;
      }

      // DEBUG: Mostrar detalles de los chunks seleccionados
      logger.info(`📋 CHUNKS SELECCIONADOS PARA CONTEXTO:`);
      prioritizedDocs.slice(0, contextParts.length).forEach((doc, i) => {
        const preview = doc.content.substring(0, 150).replace(/\n/g, ' ');
        logger.info(`  ${i + 1}. ID: ${doc.id} | ${doc.law_name || 'Sin ley'} | Art: ${doc.article_number || 'N/A'} | Sim: ${(doc.similarity * 100).toFixed(1)}% | ${doc.search_method || 'embedding'}`);
        logger.info(`     Preview: ${preview}...`);
        logger.info(`     SQL Query: SELECT * FROM document_embeddings WHERE id = '${doc.id}';`);
      });

      const finalContext = 'CONTEXTO:\n' + contextParts.join('\n---\n');
      
      const elapsed = Date.now() - startTime;
      logger.info(`✅ Contexto generado en ${elapsed}ms - ${contextParts.length} chunks, artículo: ${articleNumber || 'ninguno'}, ley: ${targetLaw || 'ninguna'}, threshold: ${threshold}`);
      
      return finalContext;
    } catch (error) {
      logger.error('Error generando contexto:', error);
      return '';
    }
  }

  // ========== UTILIDADES ==========

  private matchesLawPattern(query: string, patterns: RegExp[]): boolean {
    return patterns.some(pattern => pattern.test(query));
  }

  private async generateEmbeddingCached(text: string): Promise<number[]> {
    const cached = this.embeddingCache.get(text);
    if (cached) {
      logger.info('✨ Embedding encontrado en cache');
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

  // Función mejorada que usa keywords adicionales para refinar la búsqueda
  async getEnhancedContextWithKeywords(
    query: string, 
    keywords: string[] = [], 
    category?: string, 
    threshold: number = 0.2
  ): Promise<string> {
    try {
      logger.info(`🔍 Búsqueda refinada con keywords: ${keywords.join(', ')}`);
      
      // Combinar query original con keywords para una búsqueda más específica
      const enhancedQuery = keywords.length > 0 
        ? `${query} ${keywords.join(' ')}`
        : query;
      
      // Usar la función existente con la query mejorada
      const context = await this.getEnhancedContext(enhancedQuery, category);
      
      // Si no obtuvimos buen contexto con keywords, intentar con query original
      if (!context || context.length < 500) {
        logger.info('🔄 Fallback: Usando query original sin keywords');
        return await this.getEnhancedContext(query, category);
      }
      
      return context;
    } catch (error) {
      logger.error('Error en búsqueda refinada:', error);
      // Fallback a búsqueda normal
      return await this.getEnhancedContext(query, category);
    }
  }

  async warmupCache(): Promise<void> {
    const commonQueries = [
      'Artículo 15', 'Artículo 20', 'Artículo 1',
      'igualdad', 'discriminación', 'medidas de igualdad'
    ];
    
    logger.info('🔥 Pre-calentando cache...');
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

    const laws = new Set(allDocs.filter(d => d.document_type === 'law').map(d => d.law_name));
    const classTopics = new Set(allDocs.filter(d => d.document_type === 'class').map(d => d.law_name));
    
    const documentsByType: { [key: string]: number } = {};
    const documentsByCategory: { [key: string]: number } = {};
    
    allDocs.forEach(doc => {
      documentsByType[doc.document_type] = (documentsByType[doc.document_type] || 0) + 1;
      documentsByCategory[doc.category] = (documentsByCategory[doc.category] || 0) + 1;
    });

    const stats = {
      totalChunks: totalChunks || 0,
      totalLaws: laws.size,
      totalClassTopics: classTopics.size,
      lawChunks: documentsByType['law'] || 0,
      classChunks: documentsByType['class'] || 0,
      documentsByType,
      documentsByCategory,
      availableLaws: Array.from(laws),
      availableClassTopics: Array.from(classTopics)
    };

    return stats;
  }
}

// Exportar singleton
let instance: UnifiedRAGService | null = null;

export const getUnifiedRAGService = () => {
  if (!instance) {
    instance = new UnifiedRAGService();
  }
  return instance;
};