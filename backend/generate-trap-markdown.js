#!/usr/bin/env node

import fs from 'fs';
import path from 'path';

const logger = {
  info: (...args) => console.log('[INFO]', ...args),
  error: (...args) => console.error('[ERROR]', ...args)
};

class TrapMarkdownGenerator {
  static extractFileInfo(fileName, filePath) {
    const match = fileName.match(/^(T\d{1,2}[._]?\d*)_C(\d{1,2})\s*(.+)_TRAMPA\.txt$/);
    
    if (!match) {
      // Fallback para archivos con formato no estándar
      const parts = fileName.replace('_TRAMPA.txt', '').split('_');
      if (parts.length < 3) {
        throw new Error(`No se puede procesar el archivo: ${fileName}`);
      }
      const topicCode = parts[0];
      const classNum = parts[1].replace('C', '');
      const classTitle = parts.slice(2).join(' ');
      
      return {
        topicName: 'tema01_constitucion_espanola',
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
    const topicNumber = parseInt(topicCode.replace('T', '').replace('.', ''));
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
    const markdownFiles = [];
    
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
      
      // Crear nombre de archivo markdown
      const cleanTitle = questionTitle.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_').substring(0, 50);
      const markdownFileName = `${fileInfo.classNumber}_${cleanTitle}_TRAMPA.md`;
      
      // Crear contenido markdown mejorado
      const markdownContent = `# ${questionTitle}

**📚 Tema:** ${fileInfo.topicTitle}  
**🎓 Clase:** ${fileInfo.classTitle}  
**🎯 Tipo:** Pregunta trampa / Punto clave  
**📋 Archivo:** ${fileName}

---

${section}

---

## 📊 **Información del chunk:**

- **Chunk ${i + 1}** de ${sections.length}
- ${hasReminder ? '✅ **Incluye recordatorios**' : '❌ Sin recordatorios'}
- ${hasWarning ? '⚠️ **Incluye advertencias**' : '❌ Sin advertencias'}  
- ${hasMnemonic ? '🧠 **Incluye regla mnemotécnica**' : '❌ Sin mnemotécnica'}

## 🔍 **Metadata:**

\`\`\`json
{
  "topicName": "${fileInfo.topicName}",
  "topicTitle": "${fileInfo.topicTitle}",
  "topicNumber": ${fileInfo.topicNumber},
  "classTitle": "${fileInfo.classTitle}",
  "classNumber": "${fileInfo.classNumber}",
  "questionTitle": "${questionTitle}",
  "questionNumber": ${questionNumber || 'null'},
  "chunkType": "question",
  "chunkIndex": ${i},
  "hasReminder": ${hasReminder},
  "hasWarning": ${hasWarning},
  "hasMnemonic": ${hasMnemonic},
  "embeddingModel": "text-embedding-3-large"
}
\`\`\`
`;
      
      const outputPath = path.join(
        '/home/brayan/lexia-chatbot/backend/legal-docs/oposicionesjusticia/preguntas-trampa-md',
        fileInfo.topicName,
        markdownFileName
      );
      
      markdownFiles.push({
        filePath: outputPath,
        content: markdownContent,
        questionTitle,
        topicName: fileInfo.topicName
      });
    }
    
    return markdownFiles;
  }
  
  static async generateAllMarkdown() {
    logger.info('📝 Generando archivos markdown de preguntas trampa...');
    
    const baseDir = './legal-docs/oposicionesjusticia/preguntas trampa';
    let totalFiles = 0;
    
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
          
          const markdownFiles = this.processFile(filePath);
          
          // Guardar cada archivo markdown
          for (const mdFile of markdownFiles) {
            const dir = path.dirname(mdFile.filePath);
            
            // Crear directorio si no existe
            if (!fs.existsSync(dir)) {
              fs.mkdirSync(dir, { recursive: true });
            }
            
            // Guardar archivo
            fs.writeFileSync(mdFile.filePath, mdFile.content, 'utf8');
            totalFiles++;
            
            logger.info(`💾 Guardado: ${path.basename(mdFile.filePath)}`);
          }
        }
      }
    }
    
    logger.info(`✅ ¡Completado! ${totalFiles} archivos markdown generados en preguntas-trampa-md/`);
    return totalFiles;
  }
}

// Ejecutar
TrapMarkdownGenerator.generateAllMarkdown()
  .then((count) => {
    logger.info(`🎉 Proceso finalizado: ${count} archivos markdown creados`);
    process.exit(0);
  })
  .catch((error) => {
    logger.error('❌ Error:', error);
    process.exit(1);
  });