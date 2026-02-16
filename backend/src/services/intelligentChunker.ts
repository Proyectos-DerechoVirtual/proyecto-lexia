import { logger } from '../utils/logger';

export interface ArticleChunk {
  content: string;
  metadata: {
    articleNumber?: string;
    articleTitle?: string;
    section?: string;
    subsection?: string;
    chunkType: 'article' | 'section' | 'preamble' | 'disposition';
    originalIndex: number;
    // Nuevos campos para escalabilidad
    lawName?: string;        // Ej: "Ley_3_2007_Igualdad"
    lawTitle?: string;       // Ej: "Ley 3/2007 para la igualdad efectiva de mujeres y hombres"
    documentType?: string;   // Ej: "law", "constitution", "code", "decree"
  };
}

/**
 * Sistema de chunking inteligente para documentos legales
 * Respeta la estructura de artículos y secciones
 */
export class IntelligentLegalChunker {
  private readonly maxChunkSize: number;
  private readonly minChunkSize: number;
  
  constructor(maxChunkSize: number = 1500, minChunkSize: number = 300) {
    this.maxChunkSize = maxChunkSize;
    this.minChunkSize = minChunkSize;
  }

  /**
   * Procesa un documento legal en Markdown y lo divide en chunks inteligentes
   */
  chunkLegalDocument(markdownContent: string): ArticleChunk[] {
    const chunks: ArticleChunk[] = [];
    const lines = markdownContent.split('\n');
    
    let currentChunk: string[] = [];
    let currentMetadata: ArticleChunk['metadata'] = {
      chunkType: 'preamble',
      originalIndex: 0
    };
    let currentSection = '';
    let currentSubsection = '';
    let chunkIndex = 0;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Detectar secciones principales (TÍTULO)
      if (line.match(/^## TÍTULO [IVXLCDM]+\./)) {
        // Guardar chunk actual si existe
        if (currentChunk.length > 0) {
          chunks.push(this.createChunk(currentChunk, currentMetadata, chunkIndex++));
          currentChunk = [];
        }
        
        currentSection = line.replace('## ', '').trim();
        currentSubsection = '';
        currentMetadata = {
          section: currentSection,
          chunkType: 'section',
          originalIndex: i
        };
        currentChunk.push(line);
        continue;
      }
      
      // Detectar subsecciones (CAPÍTULO)
      if (line.match(/^### CAPÍTULO [IVXLCDM]+\./)) {
        // Guardar chunk actual si existe
        if (currentChunk.length > 0) {
          chunks.push(this.createChunk(currentChunk, currentMetadata, chunkIndex++));
          currentChunk = [];
        }
        
        currentSubsection = line.replace('### ', '').trim();
        currentMetadata = {
          section: currentSection,
          subsection: currentSubsection,
          chunkType: 'section',
          originalIndex: i
        };
        currentChunk.push(line);
        continue;
      }
      
      // Detectar artículos
      if (line.match(/^#### Artículo (\d+)\./)) {
        // Guardar chunk actual si existe
        if (currentChunk.length > 0) {
          chunks.push(this.createChunk(currentChunk, currentMetadata, chunkIndex++));
          currentChunk = [];
        }
        
        const match = line.match(/^#### Artículo (\d+)\.\s*(.+)?/);
        const articleNumber = match?.[1] || '';
        const articleTitle = match?.[2] || '';
        
        currentMetadata = {
          articleNumber,
          articleTitle,
          section: currentSection,
          subsection: currentSubsection,
          chunkType: 'article',
          originalIndex: i
        };
        
        // Iniciar nuevo chunk con el artículo
        currentChunk = [line];
        
        // Continuar agregando el contenido del artículo
        let j = i + 1;
        while (j < lines.length) {
          const nextLine = lines[j];
          
          // Si encontramos otro artículo o sección, detenemos
          if (nextLine.match(/^#{2,4} /)) {
            break;
          }
          
          // Agregar línea al chunk del artículo
          currentChunk.push(nextLine);
          j++;
          
          // Si el artículo es muy largo, lo dividimos pero manteniendo contexto
          const currentSize = currentChunk.join('\n').length;
          if (currentSize > this.maxChunkSize) {
            // Buscar un punto de corte apropiado (final de párrafo)
            const cutPoint = this.findCutPoint(currentChunk);
            
            if (cutPoint > 0) {
              const firstPart = currentChunk.slice(0, cutPoint);
              chunks.push(this.createChunk(firstPart, currentMetadata, chunkIndex++));
              
              // Mantener el título del artículo en la continuación
              currentChunk = [line, '*(continuación)*', ...currentChunk.slice(cutPoint)];
            }
          }
        }
        
        i = j - 1; // Actualizar índice principal
        continue;
      }
      
      // Detectar disposiciones
      if (line.match(/^### Disposición (adicional|transitoria|derogatoria|final)/)) {
        // Guardar chunk actual si existe
        if (currentChunk.length > 0) {
          chunks.push(this.createChunk(currentChunk, currentMetadata, chunkIndex++));
          currentChunk = [];
        }
        
        currentMetadata = {
          section: line.replace('### ', '').trim(),
          chunkType: 'disposition',
          originalIndex: i
        };
        currentChunk.push(line);
        continue;
      }
      
      // Agregar línea al chunk actual
      currentChunk.push(line);
      
      // Verificar si debemos crear un nuevo chunk por tamaño
      const currentSize = currentChunk.join('\n').length;
      if (currentSize > this.maxChunkSize && currentMetadata.chunkType !== 'article') {
        const cutPoint = this.findCutPoint(currentChunk);
        
        if (cutPoint > 0) {
          const firstPart = currentChunk.slice(0, cutPoint);
          chunks.push(this.createChunk(firstPart, currentMetadata, chunkIndex++));
          currentChunk = currentChunk.slice(cutPoint);
        }
      }
    }
    
    // Guardar último chunk si existe
    if (currentChunk.length > 0) {
      chunks.push(this.createChunk(currentChunk, currentMetadata, chunkIndex));
    }
    
    // Filtrar chunks vacíos o muy pequeños
    return chunks.filter(chunk => 
      chunk.content.trim().length >= this.minChunkSize
    );
  }
  
  /**
   * Encuentra un punto de corte apropiado en el chunk
   */
  private findCutPoint(lines: string[]): number {
    // Buscar desde el 60% del chunk hacia adelante
    const startSearch = Math.floor(lines.length * 0.6);
    
    for (let i = startSearch; i < lines.length - 1; i++) {
      // Cortar en líneas vacías (final de párrafo)
      if (lines[i].trim() === '' && lines[i + 1].trim() !== '') {
        return i + 1;
      }
      
      // Cortar antes de listas numeradas
      if (lines[i + 1].match(/^\d+\./)) {
        return i + 1;
      }
    }
    
    // Si no encontramos buen punto, cortar en el 75%
    return Math.floor(lines.length * 0.75);
  }
  
  /**
   * Crea un chunk con su contenido y metadata
   */
  private createChunk(
    lines: string[], 
    metadata: ArticleChunk['metadata'], 
    index: number
  ): ArticleChunk {
    let content = lines.join('\n').trim();
    
    // Agregar contexto al inicio del chunk si es necesario
    if (metadata.chunkType === 'article' && metadata.articleNumber) {
      // Asegurar que el artículo siempre tenga su número al inicio
      if (!content.startsWith('#### Artículo')) {
        const header = `#### Artículo ${metadata.articleNumber}. ${metadata.articleTitle || ''}`.trim();
        content = `${header}\n\n${content}`;
      }
    }
    
    // Agregar información de sección para contexto
    if (metadata.section && !content.includes(metadata.section)) {
      content = `[${metadata.section}]\n\n${content}`;
    }
    
    return {
      content,
      metadata: {
        ...metadata,
        originalIndex: index
      }
    };
  }
  
  /**
   * Genera un resumen del chunking realizado
   */
  generateChunkingSummary(chunks: ArticleChunk[]): void {
    const articleChunks = chunks.filter(c => c.metadata.chunkType === 'article');
    const sectionChunks = chunks.filter(c => c.metadata.chunkType === 'section');
    const otherChunks = chunks.filter(c => 
      c.metadata.chunkType !== 'article' && c.metadata.chunkType !== 'section'
    );
    
    logger.info('📊 Resumen del Chunking Inteligente:');
    logger.info(`  - Total de chunks: ${chunks.length}`);
    logger.info(`  - Chunks de artículos: ${articleChunks.length}`);
    logger.info(`  - Chunks de secciones: ${sectionChunks.length}`);
    logger.info(`  - Otros chunks: ${otherChunks.length}`);
    
    // Verificar artículos específicos
    const article15 = chunks.find(c => 
      c.metadata.articleNumber === '15'
    );
    
    if (article15) {
      logger.info(`  ✅ Artículo 15 encontrado: ${article15.content.substring(0, 100)}...`);
    }
    
    // Estadísticas de tamaño
    const sizes = chunks.map(c => c.content.length);
    const avgSize = sizes.reduce((a, b) => a + b, 0) / sizes.length;
    const maxSize = Math.max(...sizes);
    const minSize = Math.min(...sizes);
    
    logger.info(`  - Tamaño promedio: ${Math.round(avgSize)} caracteres`);
    logger.info(`  - Tamaño máximo: ${maxSize} caracteres`);
    logger.info(`  - Tamaño mínimo: ${minSize} caracteres`);
  }
}

export const intelligentChunker = new IntelligentLegalChunker();