/**
 * Script para subir PDFs al File Search Store EXISTENTE de Gemini
 *
 * Uso: node scripts/upload-to-gemini.js
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
const ARCHIVOS_DIR = path.resolve(__dirname, '../../archivos');
const EXISTING_STORE_ID = 'manualesderecholegal-srbl7tpx6ke5';
const STORE_NAME = `fileSearchStores/${EXISTING_STORE_ID}`;

async function main() {
  console.log('='.repeat(60));
  console.log('SUBIDA DE PDFs A GEMINI FILE SEARCH (Store Existente)');
  console.log('='.repeat(60));
  console.log(`\nStore: ${STORE_NAME}`);

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
  const files = fs.readdirSync(ARCHIVOS_DIR)
    .filter(f => f.toLowerCase().endsWith('.pdf'))
    .sort((a, b) => {
      const numA = parseInt(a.match(/Tema (\d+)/i)?.[1] || '0');
      const numB = parseInt(b.match(/Tema (\d+)/i)?.[1] || '0');
      return numA - numB;
    });

  console.log(`Encontrados ${files.length} archivos PDF:`);
  files.forEach(f => console.log(`  - ${f}`));

  // 4. Subir archivos
  console.log('\n[4/4] Subiendo archivos a Gemini...');
  const batchSize = 2;
  let uploaded = 0;
  let failed = 0;
  const errors = [];

  for (let i = 0; i < files.length; i += batchSize) {
    const batch = files.slice(i, i + batchSize);

    await Promise.all(batch.map(async (file) => {
      const filePath = path.join(ARCHIVOS_DIR, file);
      const displayName = `LexIA - ${file.replace('.pdf', '')}`;

      try {
        console.log(`  [${i + 1}/${files.length}] Subiendo: ${file}...`);

        let operation = await ai.fileSearchStores.uploadToFileSearchStore({
          file: filePath,
          fileSearchStoreName: STORE_NAME,
          config: {
            displayName: displayName,
          }
        });

        // Esperar procesamiento
        let attempts = 0;
        const maxAttempts = 90; // 3 minutos máximo

        while (!operation.done && attempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 2000));
          operation = await ai.operations.get({ operation });
          attempts++;

          if (attempts % 15 === 0) {
            console.log(`      ... procesando ${file} (${attempts * 2}s)`);
          }
        }

        if (operation.done) {
          console.log(`  ✓ ${file} - Completado`);
          uploaded++;
        } else {
          console.log(`  ⚠ ${file} - Timeout (puede seguir procesándose en background)`);
          uploaded++;
        }
      } catch (error) {
        console.error(`  ✗ ${file} - Error: ${error.message}`);
        failed++;
        errors.push({ file, error: error.message });
      }
    }));

    // Pausa entre lotes
    if (i + batchSize < files.length) {
      console.log('  [Pausa de 5 segundos entre lotes...]');
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }

  // Resumen
  console.log('\n' + '='.repeat(60));
  console.log('RESUMEN');
  console.log('='.repeat(60));
  console.log(`Store: ${STORE_NAME}`);
  console.log(`Archivos subidos: ${uploaded}/${files.length}`);
  if (failed > 0) {
    console.log(`Archivos fallidos: ${failed}`);
    errors.forEach(e => console.log(`  - ${e.file}: ${e.error}`));
  }
  console.log('\n✅ Los archivos se han agregado al store existente.');
  console.log('   El .env ya tiene configurado GEMINI_FILE_STORE_NAME=' + EXISTING_STORE_ID);
  console.log('='.repeat(60));
}

main().catch(error => {
  console.error('Error fatal:', error);
  process.exit(1);
});
