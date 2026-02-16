/**
 * Script de prueba rápida de Gemini
 */

import { GoogleGenAI } from '@google/genai';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'AIzaSyBBI__4o6Ru7ac3xRWr6U_bGwkY2vYwnlQ';

async function main() {
  console.log('Probando conexión con Gemini...\n');

  try {
    const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

    // Prueba simple de generación
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: 'Responde solo "OK" si recibes este mensaje.',
      config: {
        maxOutputTokens: 10
      }
    });

    console.log('Respuesta:', response.text);
    console.log('\n✅ Conexión con Gemini exitosa!');

    // Listar File Search Stores existentes
    console.log('\nBuscando File Search Stores existentes...');
    const pager = await ai.fileSearchStores.list({ config: { pageSize: 10 } });

    if (pager.page && pager.page.length > 0) {
      console.log(`\nStores encontrados (${pager.page.length}):`);
      for (const store of pager.page) {
        console.log(`  - ${store.name}`);
        console.log(`    Display Name: ${store.displayName || 'N/A'}`);
      }
    } else {
      console.log('\nNo hay File Search Stores existentes.');
      console.log('Ejecuta: node scripts/upload-to-gemini.js para crear uno.');
    }

  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main();
