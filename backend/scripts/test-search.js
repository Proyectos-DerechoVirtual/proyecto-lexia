import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: 'AIzaSyBBI__4o6Ru7ac3xRWr6U_bGwkY2vYwnlQ' });
const STORE = 'fileSearchStores/manualesderecholegal-srbl7tpx6ke5';

const query = 'Qué es el régimen cerrado en instituciones penitenciarias y cuáles son sus características';

console.log('Pregunta:', query);
console.log('Buscando en File Search Store...\n');

try {
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: query,
    config: {
      tools: [{
        fileSearch: {
          fileSearchStoreNames: [STORE]
        }
      }],
      temperature: 0.5,
      maxOutputTokens: 1000
    }
  });

  console.log('=== RESPUESTA ===');
  console.log(response.text);
} catch (error) {
  console.error('Error:', error.message);
}
