/**
 * Script para subir PDFs de "TU TEMARIO EN VÍDEO (AYUDANTE IIpp)"
 * al File Search Store EXISTENTE de Gemini
 *
 * Uso: node scripts/upload-iipp.js
 *
 * Store: manualesderecholegal-srbl7tpx6ke5
 */

import { GoogleGenAI } from '@google/genai';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuración
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'AIzaSyBBI__4o6Ru7ac3xRWr6U_bGwkY2vYwnlQ';
const ARCHIVOS_DIR = path.resolve(__dirname, '../../archivos/TU TEMARIO EN VÍDEO (AYUDANTE IIpp)');
const EXISTING_STORE_ID = 'manualesderecholegal-srbl7tpx6ke5';
const STORE_NAME = `fileSearchStores/${EXISTING_STORE_ID}`;

// Para continuar desde donde se quedó si falla
const START_FROM = 0; // Cambiar este número si necesitas retomar

async function main() {
  console.log('='.repeat(60));
  console.log('SUBIDA DE PDFs - TU TEMARIO EN VÍDEO (AYUDANTE IIpp)');
  console.log('='.repeat(60));
  console.log(`\nStore: ${STORE_NAME}`);
  console.log(`Directorio: ${ARCHIVOS_DIR}`);

  // 1. Inicializar cliente
  console.log('\n[1/4] Inicializando cliente Gemini...');
  const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

  // 2. Verificar que el store existe
  console.log('\n[2/4] Verificando store existente...');
  try {
    const stores = await ai.fileSearchStores.list({ config: { pageSize: 20 } });
    const storeExists = stores.page?.some(s => s.name === STORE_NAME);

    if (!storeExists) {
      console.error(`❌ Error: El store ${STORE_NAME} no existe.`);
      console.log('\nStores disponibles:');
      stores.page?.forEach(s => console.log(`  - ${s.name}`));
      process.exit(1);
    }
    console.log(`✓ Store verificado: ${STORE_NAME}`);
  } catch (error) {
    console.error('Error verificando store:', error.message);
    process.exit(1);
  }

  // 3. Obtener lista de archivos PDF
  console.log('\n[3/4] Buscando archivos PDF...');
  if (!fs.existsSync(ARCHIVOS_DIR)) {
    console.error(`❌ Directorio no encontrado: ${ARCHIVOS_DIR}`);
    process.exit(1);
  }

  const files = fs.readdirSync(ARCHIVOS_DIR)
    .filter(f => f.toLowerCase().endsWith('.pdf'))
    .sort();

  console.log(`Encontrados ${files.length} archivos PDF`);
  if (START_FROM > 0) {
    console.log(`⏩ Continuando desde archivo #${START_FROM}`);
  }

  // 4. Subir archivos
  console.log('\n[4/4] Subiendo archivos a Gemini...');
  const batchSize = 3;
  let uploaded = 0;
  let failed = 0;
  const errors = [];
  const startTime = Date.now();

  for (let i = START_FROM; i < files.length; i += batchSize) {
    const batch = files.slice(i, i + batchSize);

    await Promise.all(batch.map(async (file, batchIdx) => {
      const fileNum = i + batchIdx + 1;
      const filePath = path.join(ARCHIVOS_DIR, file);
      const displayName = `IIpp - ${file.replace('.pdf', '')}`;

      try {
        console.log(`  [${fileNum}/${files.length}] Subiendo: ${file}...`);

        let operation = await ai.fileSearchStores.uploadToFileSearchStore({
          file: filePath,
          fileSearchStoreName: STORE_NAME,
          config: {
            displayName: displayName,
          }
        });

        // Esperar procesamiento (max 2 min por archivo)
        let attempts = 0;
        const maxAttempts = 60;

        while (!operation.done && attempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 2000));
          operation = await ai.operations.get({ operation });
          attempts++;

          if (attempts % 15 === 0) {
            console.log(`      ... procesando ${file} (${attempts * 2}s)`);
          }
        }

        if (operation.done) {
          console.log(`  ✓ [${fileNum}/${files.length}] ${file}`);
          uploaded++;
        } else {
          console.log(`  ⚠ [${fileNum}/${files.length}] ${file} - Timeout (procesándose en background)`);
          uploaded++;
        }
      } catch (error) {
        console.error(`  ✗ [${fileNum}/${files.length}] ${file} - Error: ${error.message}`);
        failed++;
        errors.push({ file, index: fileNum, error: error.message });
      }
    }));

    // Progreso
    const elapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
    const progress = Math.min(i + batchSize, files.length);
    console.log(`  --- Progreso: ${progress}/${files.length} (${elapsed} min) ---`);

    // Pausa entre lotes
    if (i + batchSize < files.length) {
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }

  // Resumen
  const totalTime = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
  console.log('\n' + '='.repeat(60));
  console.log('RESUMEN');
  console.log('='.repeat(60));
  console.log(`Store: ${STORE_NAME}`);
  console.log(`Archivos subidos: ${uploaded}/${files.length}`);
  console.log(`Tiempo total: ${totalTime} minutos`);
  if (failed > 0) {
    console.log(`\nArchivos fallidos (${failed}):`);
    errors.forEach(e => console.log(`  - [#${e.index}] ${e.file}: ${e.error}`));
    console.log(`\n💡 Para reintentar, cambia START_FROM = ${errors[0]?.index - 1 || 0} en el script`);
  }
  console.log('\n✅ Subida completada.');
  console.log('='.repeat(60));
}

main().catch(error => {
  console.error('Error fatal:', error);
  process.exit(1);
});
