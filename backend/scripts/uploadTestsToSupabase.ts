#!/usr/bin/env tsx

import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Cargar variables de entorno
dotenv.config();
dotenv.config({ path: '../.env' });

import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

// Configuración de los grupos de tests
interface TestGroupConfig {
  groupName: string;
  groupTitle: string;
  topicName: string;
  topicTitle: string;
  topicNumber: number;
  examRelevance: number;
  difficulty: 'básico' | 'intermedio' | 'avanzado';
}

const TEST_GROUPS: TestGroupConfig[] = [
  {
    groupName: 'gestion_1',
    groupTitle: 'Test Gestión Procesal - Grupo 1',
    topicName: 'test_gestion_procesal_1',
    topicTitle: 'Tests de Gestión Procesal',
    topicNumber: 1,
    examRelevance: 10,
    difficulty: 'avanzado'
  },
  {
    groupName: 'gestion_2',
    groupTitle: 'Test Gestión Procesal - Grupo 2',
    topicName: 'test_gestion_procesal_2',
    topicTitle: 'Tests de Gestión Procesal',
    topicNumber: 2,
    examRelevance: 10,
    difficulty: 'avanzado'
  },
  {
    groupName: 'gestion_3',
    groupTitle: 'Test Gestión Procesal - Grupo 3',
    topicName: 'test_gestion_procesal_3',
    topicTitle: 'Tests de Gestión Procesal',
    topicNumber: 3,
    examRelevance: 10,
    difficulty: 'avanzado'
  }
];

// Función para parsear un archivo de test en preguntas individuales
function parseTestQuestions(content: string): Array<{
  questionNumber: number;
  questionText: string;
  options: string[];
  correctAnswer: string;
  correctExplanation: string;
  wrongExplanation: string;
  fullContent: string;
}> {
  const questions: any[] = [];

  // Dividir por "## Pregunta"
  const questionBlocks = content.split(/## Pregunta \d+/);

  // Saltar el primer elemento vacío
  for (let i = 1; i < questionBlocks.length; i++) {
    const block = questionBlocks[i].trim();
    if (!block) continue;

    const lines = block.split('\n');

    let questionText = '';
    let options: string[] = [];
    let correctAnswer = '';
    let correctExplanation = '';
    let wrongExplanation = '';

    let currentSection = '';

    for (const line of lines) {
      const trimmedLine = line.trim();

      if (trimmedLine.startsWith('**') && trimmedLine.endsWith('**') && !trimmedLine.includes(':')) {
        // Es la pregunta
        questionText = trimmedLine.replace(/\*\*/g, '');
      } else if (trimmedLine === '**Opciones:**') {
        currentSection = 'options';
      } else if (trimmedLine.startsWith('**Respuesta correcta:**')) {
        currentSection = 'answer';
        correctAnswer = trimmedLine.replace('**Respuesta correcta:**', '').trim();
      } else if (trimmedLine.startsWith('**Explicación (correcta):**')) {
        currentSection = 'correct_explanation';
      } else if (trimmedLine.startsWith('**Explicación (errada):**')) {
        currentSection = 'wrong_explanation';
      } else if (trimmedLine === '---') {
        // Fin de pregunta
        break;
      } else if (trimmedLine) {
        // Contenido de la sección actual
        if (currentSection === 'options' && trimmedLine.startsWith('-')) {
          options.push(trimmedLine.substring(1).trim());
        } else if (currentSection === 'correct_explanation') {
          correctExplanation += trimmedLine + ' ';
        } else if (currentSection === 'wrong_explanation') {
          wrongExplanation += trimmedLine + ' ';
        }
      }
    }

    if (questionText) {
      questions.push({
        questionNumber: i,
        questionText: questionText.trim(),
        options: options,
        correctAnswer: correctAnswer.trim(),
        correctExplanation: correctExplanation.trim(),
        wrongExplanation: wrongExplanation.trim(),
        fullContent: block
      });
    }
  }

  return questions;
}

// Función para extraer keywords de una pregunta
function extractQuestionKeywords(question: any): string[] {
  const keywords: Set<string> = new Set();

  // Extraer términos importantes del texto de la pregunta
  const content = `${question.questionText} ${question.options.join(' ')} ${question.correctExplanation}`;

  const keywordPatterns = [
    /\b(?:LOPJ|LEC|LECrim|CP|CE|Constitución)\b/gi,
    /\bart(?:ículo)?s?\s+\d+/gi,
    /\b(?:Tribunal|Sala|Juzgado|Audiencia)\s+\w+/gi,
    /\b(?:competencia|jurisdicción|procedimiento|recurso|sentencia)\b/gi,
    /\bLey\s+(?:Orgánica\s+)?\d+\/\d+/gi
  ];

  keywordPatterns.forEach(pattern => {
    const matches = content.match(pattern);
    if (matches) {
      matches.forEach(match => keywords.add(match.toLowerCase()));
    }
  });

  return Array.from(keywords).slice(0, 15);
}

// Función para extraer referencias legales
function extractLegalRefs(question: any): string[] {
  const refs: Set<string> = new Set();
  const content = `${question.questionText} ${question.options.join(' ')} ${question.correctExplanation}`;

  const refPatterns = [
    /\bart(?:ículo)?s?\s+\d+(?:\s+(?:a|al|y)\s+\d+)?(?:\s+(?:CE|CP|LEC|LECrim|LOPJ))?/gi,
    /\bLey\s+(?:Orgánica\s+)?(?:\d+\/\d+)/gi,
    /\b(?:LEC|LECrim|LOPJ|CP|CC|LO|RD)\s+\d+\/\d+/gi
  ];

  refPatterns.forEach(pattern => {
    const matches = content.match(pattern);
    if (matches) {
      matches.forEach(match => refs.add(match));
    }
  });

  return Array.from(refs).slice(0, 10);
}

// Función para procesar un archivo de test
async function processTestFile(
  filePath: string,
  fileName: string,
  config: TestGroupConfig
): Promise<number> {
  const markdown = fs.readFileSync(filePath, 'utf-8');
  const questions = parseTestQuestions(markdown);

  console.log(`   📄 ${fileName}: ${questions.length} preguntas`);

  let questionsInserted = 0;
  const batchSize = 5;

  // Extraer información del archivo
  const fileNameMatch = fileName.match(/(?:test_|TEST_)?(.+)\.md$/i);
  const testTitle = fileNameMatch ? fileNameMatch[1].replace(/_/g, ' ') : fileName;

  // Procesar en lotes
  for (let i = 0; i < questions.length; i += batchSize) {
    const batch = questions.slice(i, Math.min(i + batchSize, questions.length));

    try {
      // Generar embeddings para el lote (usando el contenido completo de cada pregunta)
      const embeddingInputs = batch.map(q =>
        `${q.questionText}\n\nOpciones:\n${q.options.join('\n')}\n\nRespuesta: ${q.correctAnswer}\n\n${q.correctExplanation}`
      );

      const embeddingResponse = await openai.embeddings.create({
        model: 'text-embedding-3-large',
        input: embeddingInputs,
        dimensions: 3072
      });

      // Procesar cada pregunta del lote
      for (let j = 0; j < batch.length; j++) {
        const question = batch[j];
        const embedding = embeddingResponse.data[j].embedding;
        const questionIndex = i + j;

        // Extraer keywords y referencias
        const keywords = extractQuestionKeywords(question);
        const legalRefs = extractLegalRefs(question);

        // Preparar metadata según el esquema solicitado
        const metadata = {
          fileName: fileName,
          filePath: filePath,
          chunkType: 'question',
          topicName: config.topicName,
          chunkIndex: questionIndex,
          classTitle: testTitle,
          hasWarning: false,
          topicTitle: `Pregunta ${question.questionNumber}: ${question.questionText.substring(0, 50)}...`,
          classNumber: `${config.groupName}_${fileName.replace('.md', '')}`,
          hasMnemonic: false,
          hasReminder: false,
          processedAt: new Date().toISOString(),
          topicNumber: config.topicNumber,
          totalChunks: questions.length,
          originalIndex: questionIndex,
          questionTitle: question.questionText,
          classNumberInt: questionIndex + 1,
          embeddingModel: 'text-embedding-3-large',
          // Información específica de la pregunta
          questionNumber: question.questionNumber,
          options: question.options,
          correctAnswer: question.correctAnswer,
          correctExplanation: question.correctExplanation,
          wrongExplanation: question.wrongExplanation
        };

        // Preparar el contenido completo formateado
        const formattedContent = `# Pregunta ${question.questionNumber}

${question.questionText}

## Opciones:
${question.options.map((opt, idx) => `${idx + 1}. ${opt}`).join('\n')}

## Respuesta correcta: ${question.correctAnswer}

## Explicación (respuesta correcta):
${question.correctExplanation}

## Explicación (respuesta errada):
${question.wrongExplanation}`;

        // Insertar en Supabase
        const { error } = await supabase
          .from('document_embeddings')
          .insert({
            content: formattedContent,
            embedding: embedding,
            metadata: metadata,
            document_type: 'test',
            law_name: config.topicName,
            article_number: null,
            section_title: testTitle,
            category: 'oposiciones',
            topic_number: config.topicNumber,
            class_number: questionIndex + 1,
            difficulty_level: config.difficulty,
            exam_relevance: config.examRelevance,
            keywords: keywords,
            legal_refs: legalRefs
          });

        if (error) {
          console.error(`   ❌ Error insertando pregunta ${questionIndex + 1}:`, error.message);
        } else {
          questionsInserted++;
        }
      }

      // Pausa entre lotes
      if (i + batchSize < questions.length) {
        await new Promise(resolve => setTimeout(resolve, 300));
      }

    } catch (error) {
      console.error(`   ❌ Error procesando lote ${i}-${i+batchSize}:`, error);
    }
  }

  return questionsInserted;
}

// Función para procesar un grupo de tests
async function processTestGroup(config: TestGroupConfig): Promise<number> {
  const testDir = path.join('/home/brayan/lexia-chatbot/backend/legal-docs/oposicionesjusticia/Test.md', config.groupName);

  if (!fs.existsSync(testDir)) {
    console.log(`   ⚠️ No existe directorio para ${config.groupName}`);
    return 0;
  }

  const testFiles = fs.readdirSync(testDir).filter(f => f.endsWith('.md'));
  console.log(`   📚 ${testFiles.length} archivos de test encontrados`);

  let totalQuestions = 0;

  for (const testFile of testFiles) {
    const filePath = path.join(testDir, testFile);
    const questions = await processTestFile(filePath, testFile, config);
    totalQuestions += questions;
  }

  return totalQuestions;
}

// Función principal
async function uploadAllTests() {
  console.log('🚀 Iniciando carga de tests con text-embedding-3-large...');
  console.log('📊 Dimensiones: 3072 (mayor precisión semántica)');
  console.log('✨ Tipo de documento: test (preguntas de examen)');
  console.log('');

  let totalGroups = 0;
  let totalQuestions = 0;

  for (const groupConfig of TEST_GROUPS) {
    console.log(`\n📘 Procesando: ${groupConfig.groupTitle}`);
    console.log(`   📊 Relevancia examen: ${groupConfig.examRelevance}/10`);
    console.log(`   📈 Dificultad: ${groupConfig.difficulty}`);

    try {
      const questions = await processTestGroup(groupConfig);

      if (questions > 0) {
        totalGroups++;
        totalQuestions += questions;
        console.log(`   ✅ ${questions} preguntas procesadas`);
      }

    } catch (error) {
      console.error(`   ❌ Error procesando grupo:`, error);
    }
  }

  console.log('\n📊 RESUMEN FINAL:');
  console.log(`   ✅ Grupos procesados: ${totalGroups}/${TEST_GROUPS.length}`);
  console.log(`   ❓ Total preguntas: ${totalQuestions}`);
  console.log(`   🎯 Modelo: text-embedding-3-large (3072 dims)`);
  console.log(`   💾 Tabla: document_embeddings`);
  console.log(`   📝 Tipo: test (question)`);
}

// Ejecutar si es el archivo principal
if (require.main === module) {
  uploadAllTests()
    .then(() => {
      console.log('\n✅ Proceso completado exitosamente');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n❌ Error fatal:', error);
      process.exit(1);
    });
}
