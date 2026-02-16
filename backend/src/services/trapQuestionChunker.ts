import fs from 'fs';
import path from 'path';
import logger from '../utils/logger.js';

export interface TrapQuestionMetadata {
  fileName: string;
  filePath: string;
  chunkType: 'question' | 'concept';
  chunkIndex: number;
  totalChunks: number;
  topicName: string;
  topicTitle: string;
  topicNumber: number;
  classTitle: string;
  classNumber: string;
  classNumberInt: number;
  questionNumber?: number;
  questionTitle: string;
  conceptTitle?: string;
  hasReminder: boolean;
  hasWarning: boolean;
  hasMnemonic: boolean;
  originalIndex: number;
  processedAt: string;
  embeddingModel: string;
}

export interface TrapQuestionChunk {
  content: string;
  metadata: TrapQuestionMetadata;
}

export class TrapQuestionChunker {
  
  /**
   * Procesa un archivo de preguntas trampa y lo divide en chunks inteligentes
   */
  static chunkTrapQuestionFile(filePath: string): TrapQuestionChunk[] {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const fileName = path.basename(filePath);
      
      // Extraer información del nombre del archivo
      const fileInfo = this.extractFileInfo(fileName, filePath);
      
      // Dividir el contenido en secciones por "---"
      const sections = content.split(/\n---\n/).filter(section => section.trim());
      
      const chunks: TrapQuestionChunk[] = [];
      let chunkIndex = 0;
      
      for (let i = 0; i < sections.length; i++) {
        const section = sections[i].trim();
        if (!section) continue;
        
        const chunk = this.processSection(section, chunkIndex, sections.length, fileInfo, filePath);
        if (chunk) {
          chunks.push(chunk);
          chunkIndex++;
        }
      }
      
      logger.info(`📝 Procesado archivo trampa: ${fileName} → ${chunks.length} chunks`);
      return chunks;
      
    } catch (error) {
      logger.error(`❌ Error procesando archivo trampa ${filePath}:`, error);
      return [];
    }
  }
  
  /**
   * Extrae información del nombre del archivo
   */
  private static extractFileInfo(fileName: string, filePath: string) {
    // Ejemplo: T01_C01_Titulo_Preliminar_TRAMPA.txt
    const match = fileName.match(/^(T\d{1,2})_C(\d{1,2})_(.+)_TRAMPA\.txt$/);
    
    if (!match) {
      throw new Error(`Formato de archivo no válido: ${fileName}`);
    }
    
    const [, topicCode, classNum, classTitle] = match;
    const topicNumber = parseInt(topicCode.replace('T', ''));
    const classNumberInt = parseInt(classNum);
    const classNumber = `${topicCode}_C${classNum}`;
    
    // Extraer nombre del tema del path
    const pathParts = filePath.split('/');
    const topicFolderName = pathParts[pathParts.length - 2]; // tema01_constitucion_espanola_TRAMPA
    const topicName = topicFolderName.replace('_TRAMPA', '');
    
    // Mapear temas a títulos
    const topicTitles: Record<string, string> = {
      'tema01_constitucion_espanola': 'Constitución Española',
      'tema1_2_LOTC': 'Ley Orgánica del Tribunal Constitucional',
      // Añadir más según vayan apareciendo
    };
    
    const topicTitle = topicTitles[topicName] || topicName.replace(/_/g, ' ').replace(/tema\d+/, '').trim();
    
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
  
  /**
   * Procesa una sección individual del archivo
   */
  private static processSection(
    section: string, 
    chunkIndex: number, 
    totalChunks: number, 
    fileInfo: any, 
    filePath: string
  ): TrapQuestionChunk | null {
    
    const lines = section.split('\n').filter(line => line.trim());
    if (lines.length === 0) return null;
    
    // Primera línea es el título (puede tener número)
    const firstLine = lines[0].trim();
    const questionMatch = firstLine.match(/^(\d+)\.\s*(.+)$/);
    
    let questionNumber: number | undefined;
    let questionTitle: string;
    
    if (questionMatch) {
      questionNumber = parseInt(questionMatch[1]);
      questionTitle = questionMatch[2];
    } else {
      questionTitle = firstLine;
    }
    
    // Analizar contenido para detectar secciones
    const hasReminder = section.includes('Recuerda:');
    const hasWarning = section.includes('Ten cuidado:');
    const hasMnemonic = section.includes('Regla mnemotécnica:');
    
    // Crear metadata específica para preguntas trampa
    const metadata: TrapQuestionMetadata = {
      fileName: fileInfo.fileName,
      filePath,
      chunkType: 'question',
      chunkIndex,
      totalChunks,
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
      originalIndex: chunkIndex * 2, // Para compatibilidad
      processedAt: new Date().toISOString(),
      embeddingModel: 'text-embedding-3-large'
    };
    
    return {
      content: section,
      metadata
    };
  }
  
  /**
   * Procesa todos los archivos en un directorio de preguntas trampa
   */
  static async processDirectory(dirPath: string): Promise<TrapQuestionChunk[]> {
    const allChunks: TrapQuestionChunk[] = [];
    
    try {
      const files = fs.readdirSync(dirPath, { withFileTypes: true });
      
      for (const file of files) {
        if (file.isFile() && file.name.endsWith('_TRAMPA.txt') && !file.name.includes('Zone.Identifier')) {
          const filePath = path.join(dirPath, file.name);
          const chunks = this.chunkTrapQuestionFile(filePath);
          allChunks.push(...chunks);
        }
      }
      
      logger.info(`📚 Procesado directorio: ${dirPath} → ${allChunks.length} chunks totales`);
      return allChunks;
      
    } catch (error) {
      logger.error(`❌ Error procesando directorio ${dirPath}:`, error);
      return [];
    }
  }
  
  /**
   * Convierte chunks a formato markdown
   */
  static convertToMarkdown(chunks: TrapQuestionChunk[]): { filePath: string; content: string; metadata: TrapQuestionMetadata }[] {
    return chunks.map(chunk => {
      const metadata = chunk.metadata;
      const outputPath = path.join(
        '/home/brayan/lexia-chatbot/backend/legal-docs/oposicionesjusticia/preguntas-trampa-md',
        metadata.topicName,
        `${metadata.classNumber}_${metadata.questionTitle.replace(/[^a-zA-Z0-9]/g, '_')}_TRAMPA.md`
      );
      
      // Crear contenido markdown mejorado
      const markdownContent = `# ${metadata.questionTitle}

**Tema:** ${metadata.topicTitle}  
**Clase:** ${metadata.classTitle}  
**Tipo:** Pregunta trampa / Punto clave

---

${chunk.content}

---

**Información del chunk:**
- Chunk ${metadata.chunkIndex + 1} de ${metadata.totalChunks}
- ${metadata.hasReminder ? '✅ Incluye recordatorios' : '❌ Sin recordatorios'}
- ${metadata.hasWarning ? '⚠️ Incluye advertencias' : '❌ Sin advertencias'}  
- ${metadata.hasMnemonic ? '🧠 Incluye regla mnemotécnica' : '❌ Sin mnemotécnica'}
`;
      
      return {
        filePath: outputPath,
        content: markdownContent,
        metadata
      };
    });
  }
}