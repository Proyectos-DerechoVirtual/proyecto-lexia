#!/usr/bin/env tsx

import path from 'path';
import fs from 'fs';

// Configuración de temas y clases
interface ClassConfig {
  topicName: string;      // Nombre del tema (tema01_constitucion_espanola)
  topicTitle: string;     // Título legible (Constitución Española)
  files: string[];        // Array de archivos .txt
  basePath: string;       // Ruta base del tema
  outputPath: string;     // Ruta de salida para Markdown
}

// Función para obtener configuración de todos los temas
async function getClassTopicsConfig(): Promise<ClassConfig[]> {
  const clasesBasePath = '/home/brayan/lexia-chatbot/backend/legal-docs/oposicionesjusticia/clases';
  const outputBasePath = '/home/brayan/lexia-chatbot/backend/legal-docs/oposicionesjusticia/clases-md';
  const topics: ClassConfig[] = [];
  
  // Mapeo de nombres de carpetas a títulos legibles
  const topicTitles: { [key: string]: string } = {
    'tema01_constitucion_espanola': 'Constitución Española',
    'tema02_derechos_humanos': 'Derechos Humanos',
    'tema03_gobierno_y_administracion': 'Gobierno y Administración',
    'tema04_organizacion_territorial': 'Organización Territorial del Estado',
    'tema05_la_union_europea': 'La Unión Europea',
    'tema06_el_poder_judicial': 'El Poder Judicial',
    'tema10_carta_de_ciudadanos': 'Carta de Derechos de los Ciudadanos',
    'tema16_libertad_sindical': 'Libertad Sindical',
    'tema17a19_proceso_civil': 'Proceso Civil',
    'tema1_2_LOTC': 'Ley Orgánica del Tribunal Constitucional',
    'tema24_archivo_judicial': 'Archivo Judicial',
    'tema28a30_procesos_especiales': 'Procesos Especiales',
    'tema38_medidas_cautelares': 'Medidas Cautelares',
    'tema45_el_sumario': 'El Sumario',
    'tema54_el_procedimiento_por_delitos_leves': 'Procedimiento por Delitos Leves',
    'tema62_los_recursos': 'Los Recursos',
    'tema63_procedimientos_especiales': 'Procedimientos Especiales',
    'tema64_disposiciones_comunes': 'Disposiciones Comunes',
    'tema68_concurso_de_acreedores': 'Concurso de Acreedores'
  };
  
  // Crear directorio base de salida si no existe
  if (!fs.existsSync(outputBasePath)) {
    fs.mkdirSync(outputBasePath, { recursive: true });
  }
  
  // Leer todos los temas disponibles
  const topicDirs = fs.readdirSync(clasesBasePath, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => dirent.name)
    .sort(); // Ordenar alfabéticamente
  
  for (const topicDir of topicDirs) {
    const topicPath = path.join(clasesBasePath, topicDir);
    const outputPath = path.join(outputBasePath, topicDir);
    
    // Crear directorio de salida para este tema
    if (!fs.existsSync(outputPath)) {
      fs.mkdirSync(outputPath, { recursive: true });
    }
    
    // Obtener todos los archivos .txt del tema
    const files = fs.readdirSync(topicPath)
      .filter(file => file.endsWith('.txt'))
      .sort(); // Ordenar alfabéticamente
    
    if (files.length > 0) {
      topics.push({
        topicName: topicDir,
        topicTitle: topicTitles[topicDir] || topicDir,
        files: files,
        basePath: topicPath,
        outputPath: outputPath
      });
    }
  }
  
  return topics;
}

// Función para convertir archivo TXT a Markdown
function convertClassToMarkdown(inputPath: string, config: ClassConfig, fileName: string): string {
  const content = fs.readFileSync(inputPath, 'utf-8');
  const lines = content.split('\n');
  
  let markdown = '';
  
  // Extraer información del nombre del archivo
  const fileInfo = extractFileInfo(fileName);
  
  // Header del documento
  markdown += `# ${config.topicTitle}\n\n`;
  markdown += `## ${fileInfo.title}\n\n`;
  
  // Metadatos
  markdown += `**Tema:** ${config.topicTitle}  \n`;
  markdown += `**Clase:** ${fileInfo.classNumber}  \n`;
  markdown += `**Archivo:** ${fileName}  \n`;
  markdown += `**Tipo:** Material de Clase  \n`;
  markdown += `**Categoría:** Oposiciones de Justicia  \n\n`;
  markdown += `---\n\n`;
  
  let previousLineEmpty = true;
  
  // Procesar contenido línea por línea
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Saltar líneas vacías múltiples
    if (line === '') {
      if (!previousLineEmpty) {
        markdown += '\n';
        previousLineEmpty = true;
      }
      continue;
    }
    
    previousLineEmpty = false;
    
    // Detectar títulos grandes (todo en mayúsculas)
    if (line.match(/^[A-ZÁÉÍÓÚÑÜ][A-ZÁÉÍÓÚÑÜ\s\d\.\-\(\)]+[A-ZÁÉÍÓÚÑÜ]$/)) {
      markdown += `### ${line}\n\n`;
    }
    // Detectar artículos de leyes
    else if (line.match(/^Art[ií]culo\s+\d+/i)) {
      markdown += `#### ${line}\n\n`;
    }
    // Detectar apartados numerados
    else if (line.match(/^\d+[\.\-\)]\s+/)) {
      markdown += `${line}\n\n`;
    }
    // Detectar apartados con letras
    else if (line.match(/^[a-z]\)\s+/)) {
      markdown += `${line}\n\n`;
    }
    // Detectar subtítulos (primera palabra capitalizada seguida de dos puntos)
    else if (line.match(/^[A-ZÁÉÍÓÚÑÜ][a-záéíóúñü\s]+:\s*/)) {
      markdown += `**${line}**\n\n`;
    }
    // Texto normal
    else {
      markdown += `${line}\n\n`;
    }
  }
  
  return markdown;
}

// Función para extraer información del nombre del archivo
function extractFileInfo(fileName: string): { classNumber: string, title: string } {
  // Ejemplos: T01_C01_Empezamos con la Constitucion.txt
  const match = fileName.match(/T(\d+)_C(\d+)_(.+)\.txt$/);
  
  if (match) {
    const [, tema, clase, titulo] = match;
    return {
      classNumber: `T${tema}_C${clase}`,
      title: titulo.replace(/_/g, ' ')
    };
  }
  
  return {
    classNumber: fileName.replace('.txt', ''),
    title: fileName.replace('.txt', '').replace(/_/g, ' ')
  };
}

// Función para convertir todos los temas
async function convertAllClassesToMarkdown() {
  console.log('🚀 Iniciando conversión de materiales de clase a Markdown...');
  
  const topics = await getClassTopicsConfig();
  console.log(`📚 Encontrados ${topics.length} temas con material de clase`);
  
  let totalConverted = 0;
  const conversionSummary: { [key: string]: number } = {};
  
  for (const topic of topics) {
    console.log(`\n📖 Convirtiendo tema: ${topic.topicTitle}`);
    console.log(`   📁 Archivos: ${topic.files.length}`);
    
    let topicConverted = 0;
    
    for (const fileName of topic.files) {
      const inputPath = path.join(topic.basePath, fileName);
      const outputPath = path.join(topic.outputPath, fileName.replace('.txt', '.md'));
      
      try {
        // Convertir a Markdown
        const markdown = convertClassToMarkdown(inputPath, topic, fileName);
        
        // Guardar archivo Markdown
        fs.writeFileSync(outputPath, markdown, 'utf-8');
        
        console.log(`   ✅ ${fileName} → ${fileName.replace('.txt', '.md')}`);
        topicConverted++;
        totalConverted++;
        
      } catch (error) {
        console.error(`   ❌ Error convirtiendo ${fileName}:`, error);
      }
    }
    
    conversionSummary[topic.topicTitle] = topicConverted;
    console.log(`   📊 Convertidos: ${topicConverted}/${topic.files.length} archivos`);
  }
  
  console.log(`\n🎉 Conversión completada!`);
  console.log(`   📄 Total archivos convertidos: ${totalConverted}`);
  console.log(`   📁 Directorio de salida: /backend/legal-docs/oposicionesjusticia/clases-md/`);
  
  // Mostrar resumen por tema
  console.log(`\n📊 Resumen por tema:`);
  console.log(`${'='.repeat(50)}`);
  for (const [topicTitle, count] of Object.entries(conversionSummary)) {
    console.log(`   ${topicTitle}: ${count} archivos`);
  }
  
  // Crear archivo de resumen
  const summaryPath = '/home/brayan/lexia-chatbot/backend/legal-docs/oposicionesjusticia/clases-md/CONVERSION_SUMMARY.md';
  let summaryContent = `# Resumen de Conversión - Materiales de Clase\n\n`;
  summaryContent += `**Fecha de conversión:** ${new Date().toLocaleString('es-ES')}\n`;
  summaryContent += `**Total archivos convertidos:** ${totalConverted}\n\n`;
  summaryContent += `## Archivos por tema:\n\n`;
  
  for (const [topicTitle, count] of Object.entries(conversionSummary)) {
    summaryContent += `- **${topicTitle}:** ${count} archivos\n`;
  }
  
  summaryContent += `\n## Próximos pasos:\n\n`;
  summaryContent += `1. Revisar archivos Markdown generados\n`;
  summaryContent += `2. Ejecutar script de procesamiento para Supabase:\n`;
  summaryContent += `   \`\`\`bash\n`;
  summaryContent += `   tsx scripts/uploadClassesToSupabase.ts all\n`;
  summaryContent += `   \`\`\`\n`;
  
  fs.writeFileSync(summaryPath, summaryContent, 'utf-8');
  console.log(`\n📋 Resumen guardado en: CONVERSION_SUMMARY.md`);
}

// Función para convertir un tema específico
async function convertSingleTopic(topicName: string) {
  const topics = await getClassTopicsConfig();
  const topic = topics.find(t => t.topicName === topicName);
  
  if (!topic) {
    console.error(`❌ Tema no encontrado: ${topicName}`);
    console.log('Temas disponibles:');
    topics.forEach(t => console.log(`  - ${t.topicName}: ${t.topicTitle}`));
    return;
  }
  
  console.log(`🚀 Convirtiendo tema específico: ${topic.topicTitle}`);
  
  let converted = 0;
  
  for (const fileName of topic.files) {
    const inputPath = path.join(topic.basePath, fileName);
    const outputPath = path.join(topic.outputPath, fileName.replace('.txt', '.md'));
    
    try {
      const markdown = convertClassToMarkdown(inputPath, topic, fileName);
      fs.writeFileSync(outputPath, markdown, 'utf-8');
      
      console.log(`   ✅ ${fileName} → ${fileName.replace('.txt', '.md')}`);
      converted++;
      
    } catch (error) {
      console.error(`   ❌ Error convirtiendo ${fileName}:`, error);
    }
  }
  
  console.log(`\n🎉 Tema completado!`);
  console.log(`   📄 Archivos convertidos: ${converted}/${topic.files.length}`);
  console.log(`   📁 Ubicación: ${topic.outputPath}`);
}

// Función para listar temas disponibles
async function listAvailableTopics() {
  const topics = await getClassTopicsConfig();
  console.log('\n📚 Temas disponibles para conversión:');
  console.log('======================================');
  
  let totalFiles = 0;
  for (const topic of topics) {
    console.log(`${topic.topicName}: ${topic.topicTitle} (${topic.files.length} archivos)`);
    totalFiles += topic.files.length;
  }
  
  console.log(`\n📊 Total: ${topics.length} temas, ${totalFiles} archivos`);
}

// Ejecutar según argumentos de línea de comandos
async function main() {
  const command = process.argv[2];
  const topicName = process.argv[3];
  
  try {
    switch (command) {
      case 'all':
        await convertAllClassesToMarkdown();
        break;
      case 'topic':
        if (!topicName) {
          console.error('❌ Especifica el nombre del tema');
          await listAvailableTopics();
          return;
        }
        await convertSingleTopic(topicName);
        break;
      case 'list':
        await listAvailableTopics();
        break;
      default:
        console.log('🚀 Script de conversión TXT → Markdown');
        console.log('\nUso:');
        console.log('  tsx convertClassesToMarkdown.ts all           # Convertir todos los temas');
        console.log('  tsx convertClassesToMarkdown.ts topic <tema>  # Convertir un tema específico');
        console.log('  tsx convertClassesToMarkdown.ts list          # Listar temas disponibles');
        console.log('\nEjemplo:');
        console.log('  tsx convertClassesToMarkdown.ts topic tema01_constitucion_espanola');
        console.log('\nLos archivos Markdown se guardarán en:');
        console.log('  /backend/legal-docs/oposicionesjusticia/clases-md/');
        break;
    }
  } catch (error) {
    console.error('❌ Error durante la conversión:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export { convertAllClassesToMarkdown, convertSingleTopic, listAvailableTopics };