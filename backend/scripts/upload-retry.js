import { GoogleGenAI } from '@google/genai';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ai = new GoogleGenAI({ apiKey: 'AIzaSyBBI__4o6Ru7ac3xRWr6U_bGwkY2vYwnlQ' });
const STORE = 'fileSearchStores/manualesderecholegal-srbl7tpx6ke5';
const srcDir = path.resolve(__dirname, '../../archivos/TU TEMARIO EN VÍDEO (AYUDANTE IIpp)');

// Copiar archivo con nombre ASCII
const origFiles = fs.readdirSync(srcDir).filter(f => f.includes('ORGANOS JUDICIALES'));
if (origFiles.length === 0) { console.log('No encontrado'); process.exit(1); }

const origPath = path.join(srcDir, origFiles[0]);
const safePath = path.join(srcDir, 'ORGANIZACION_ORGANOS_JUDICIALES_LJCA.pdf');

fs.copyFileSync(origPath, safePath);
console.log('Copiado a nombre seguro. Subiendo...');

try {
  let op = await ai.fileSearchStores.uploadToFileSearchStore({
    file: safePath,
    fileSearchStoreName: STORE,
    config: { displayName: 'IIpp - ORGANIZACION DE LOS ORGANOS JUDICIALES LJCA' }
  });
  let attempts = 0;
  while (!op.done && attempts < 60) {
    await new Promise(r => setTimeout(r, 2000));
    op = await ai.operations.get({ operation: op });
    attempts++;
  }
  console.log('✓ Subido correctamente');
} catch (e) {
  console.error('✗ Error:', e.message);
}

fs.unlinkSync(safePath);
console.log('Limpio.');
