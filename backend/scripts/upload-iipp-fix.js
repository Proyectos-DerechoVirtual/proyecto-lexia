/**
 * Script para resubir los PDFs que fallaron por caracteres Unicode
 * Copia temporalmente con nombre normalizado y sube
 */

import { GoogleGenAI } from '@google/genai';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'AIzaSyBBI__4o6Ru7ac3xRWr6U_bGwkY2vYwnlQ';
const ARCHIVOS_DIR = path.resolve(__dirname, '../../archivos/TU TEMARIO EN VÍDEO (AYUDANTE IIpp)');
const STORE_NAME = 'fileSearchStores/manualesderecholegal-srbl7tpx6ke5';
const TEMP_DIR = path.resolve(__dirname, '../../archivos/_temp_upload');

// Normalizar string Unicode (NFD -> NFC) para eliminar combining characters
function normalizeFileName(name) {
  return name.normalize('NFC');
}

async function main() {
  console.log('='.repeat(60));
  console.log('RESUBIDA DE PDFs CON NOMBRES UNICODE PROBLEMÁTICOS');
  console.log('='.repeat(60));

  const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

  // Crear directorio temporal
  if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR, { recursive: true });
  }

  // Encontrar archivos con caracteres Unicode problemáticos
  const allFiles = fs.readdirSync(ARCHIVOS_DIR).filter(f => f.toLowerCase().endsWith('.pdf'));
  const problematicFiles = allFiles.filter(f => {
    const normalized = f.normalize('NFC');
    return normalized !== f || /[\u0300-\u036f]/.test(f);
  });

  // Si no encontramos con el filtro anterior, intentar subir TODOS los que tienen acentos
  // y dejar que fallen los que ya están subidos
  const filesToRetry = problematicFiles.length > 0 ? problematicFiles : allFiles.filter(f => {
    try {
      // Intentar convertir a buffer - si falla, es problemático
      Buffer.from(f, 'latin1');
      return false;
    } catch {
      return true;
    }
  });

  console.log(`\nArchivos problemáticos encontrados: ${filesToRetry.length}`);

  if (filesToRetry.length === 0) {
    // Fallback: buscar por los nombres conocidos que fallaron
    console.log('Intentando búsqueda manual de archivos fallidos...');
    const knownPatterns = [
      'JURISDICCI', 'POSICI', 'COMPOSICI', 'DECLARACI', 'PROPOSICI',
      'ADMISI', 'AUTONOMI', 'ORGANIZACI', 'COMISI', 'JURI', 'VIOLACI',
      'FUNCIO', 'ELECCIO', 'DISTRIBUCIO', 'ESTADO+AUTONO', 'RGANOS',
      'CARA', 'presupuestaria', 'parlamentarios'
    ];

    const manualFiles = allFiles.filter(f => {
      const nfc = f.normalize('NFC');
      // Check if normalization changes it
      if (nfc !== f) return true;
      // Check known patterns with combining chars
      const nfd = f.normalize('NFD');
      return nfd !== f;
    });

    if (manualFiles.length > 0) {
      console.log(`Encontrados ${manualFiles.length} archivos por normalización NFD/NFC`);
      filesToRetry.push(...manualFiles);
    }
  }

  // Si aún no hay archivos, listar todos y copiar los que tengan caracteres > 255
  if (filesToRetry.length === 0) {
    console.log('Buscando por caracteres con código > 255...');
    for (const f of allFiles) {
      for (let i = 0; i < f.length; i++) {
        if (f.charCodeAt(i) > 255) {
          filesToRetry.push(f);
          break;
        }
      }
    }
    console.log(`Encontrados: ${filesToRetry.length}`);
  }

  let uploaded = 0;
  let failed = 0;

  for (let i = 0; i < filesToRetry.length; i++) {
    const origFile = filesToRetry[i];
    const origPath = path.join(ARCHIVOS_DIR, origFile);

    // Crear nombre normalizado (reemplazar combining characters)
    const safeName = origFile.normalize('NFC')
      .replace(/[^\x00-\xFF]/g, c => {
        // Mapear caracteres comunes
        const map = { 'á': 'a', 'é': 'e', 'í': 'i', 'ó': 'o', 'ú': 'u',
                      'Á': 'A', 'É': 'E', 'Í': 'I', 'Ó': 'O', 'Ú': 'U',
                      'ñ': 'n', 'Ñ': 'N', 'ü': 'u', 'Ü': 'U' };
        return map[c] || '_';
      });

    const tempPath = path.join(TEMP_DIR, safeName);
    const displayName = `IIpp - ${origFile.normalize('NFC').replace('.pdf', '')}`;

    try {
      // Copiar con nombre seguro
      fs.copyFileSync(origPath, tempPath);

      console.log(`  [${i + 1}/${filesToRetry.length}] Subiendo: ${safeName}...`);

      let operation = await ai.fileSearchStores.uploadToFileSearchStore({
        file: tempPath,
        fileSearchStoreName: STORE_NAME,
        config: { displayName }
      });

      let attempts = 0;
      while (!operation.done && attempts < 60) {
        await new Promise(resolve => setTimeout(resolve, 2000));
        operation = await ai.operations.get({ operation });
        attempts++;
      }

      console.log(`  ✓ ${safeName}`);
      uploaded++;

      // Limpiar temporal
      fs.unlinkSync(tempPath);
    } catch (error) {
      console.error(`  ✗ ${safeName} - Error: ${error.message}`);
      failed++;
      if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
    }

    // Pausa
    if (i < filesToRetry.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  // Limpiar directorio temporal
  if (fs.existsSync(TEMP_DIR)) {
    fs.rmdirSync(TEMP_DIR, { recursive: true });
  }

  console.log('\n' + '='.repeat(60));
  console.log(`Subidos: ${uploaded}/${filesToRetry.length}`);
  if (failed > 0) console.log(`Fallidos: ${failed}`);
  console.log('='.repeat(60));
}

main().catch(error => {
  console.error('Error fatal:', error);
  process.exit(1);
});
