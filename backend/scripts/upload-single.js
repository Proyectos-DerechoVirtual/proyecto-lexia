import { GoogleGenAI } from '@google/genai';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ai = new GoogleGenAI({ apiKey: 'AIzaSyBBI__4o6Ru7ac3xRWr6U_bGwkY2vYwnlQ' });
const STORE = 'fileSearchStores/manualesderecholegal-srbl7tpx6ke5';
const tempDir = path.resolve(__dirname, '../../archivos/_temp_upload');

const files = fs.readdirSync(tempDir).filter(f => f.endsWith('.pdf'));
console.log(`Archivos pendientes: ${files.length}`);

for (const file of files) {
  const filePath = path.join(tempDir, file);
  console.log(`Subiendo: ${file}...`);
  try {
    let op = await ai.fileSearchStores.uploadToFileSearchStore({
      file: filePath,
      fileSearchStoreName: STORE,
      config: { displayName: `IIpp - ${file.replace('.pdf', '')}` }
    });
    let attempts = 0;
    while (!op.done && attempts < 60) {
      await new Promise(r => setTimeout(r, 2000));
      op = await ai.operations.get({ operation: op });
      attempts++;
    }
    console.log(`✓ ${file}`);
    fs.unlinkSync(filePath);
  } catch (e) {
    console.error(`✗ ${file}: ${e.message}`);
  }
}

// Limpiar temp
fs.rmSync(tempDir, { recursive: true, force: true });
console.log('Temp limpiado. Listo.');
