import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

async function findRacismoChunk() {
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  console.log('🔍 Buscando chunk específico con racismo inmobiliario...');
  
  const { data, error } = await supabase
    .from('document_embeddings')
    .select('id, content, law_name, section_title, document_type')
    .ilike('content', '%racismo inmobiliario%')
    .limit(5);
  
  if (error) {
    console.error('Error:', error);
    return;
  }
  
  console.log(`📊 Encontrados ${data?.length || 0} chunks con 'racismo inmobiliario'`);
  
  if (data && data.length > 0) {
    data.forEach((chunk, i) => {
      console.log(`\n📄 Chunk ${i + 1}:`);
      console.log(`  ID: ${chunk.id}`);
      console.log(`  Ley/Tema: ${chunk.law_name}`);
      console.log(`  Sección: ${chunk.section_title}`);
      console.log(`  Tipo: ${chunk.document_type}`);
      
      const racismoIndex = chunk.content.toLowerCase().indexOf('racismo inmobiliario');
      if (racismoIndex > -1) {
        const start = Math.max(0, racismoIndex - 100);
        const end = Math.min(chunk.content.length, racismoIndex + 200);
        console.log(`  Contexto: ...${chunk.content.substring(start, end)}...`);
      }
    });

    // Ahora intentar buscar con embedding para ver su similitud
    console.log('\n🔍 Verificando similitud de embedding...');
    
    const openai = require('openai');
    const client = new openai.OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    
    const embeddingResponse = await client.embeddings.create({
      model: 'text-embedding-3-small',
      input: '¿Qué dice sobre racismo inmobiliario?'
    });
    
    const queryEmbedding = embeddingResponse.data[0].embedding;
    
    // Buscar usando la función RPC
    const { data: similarData, error: rpcError } = await supabase
      .rpc('search_documents', {
        query_embedding: queryEmbedding,
        match_threshold: 0.1,
        match_count: 10
      });
    
    if (!rpcError && similarData) {
      console.log(`\n📈 Resultados por similitud (threshold 0.1):`);
      similarData.forEach((doc: any, i: number) => {
        const hasRacismo = doc.content.toLowerCase().includes('racismo');
        const hasInmobiliario = doc.content.toLowerCase().includes('inmobiliario');
        console.log(`${i + 1}. Similitud: ${(doc.similarity * 100).toFixed(1)}% | Ley: ${doc.law_name} | Racismo: ${hasRacismo ? '✅' : '❌'} | Inmobiliario: ${hasInmobiliario ? '✅' : '❌'}`);
        
        if (hasRacismo && hasInmobiliario) {
          console.log(`   🎯 FOUND IT! Preview: ${doc.content.substring(0, 200)}...`);
        }
      });
    }
    
  } else {
    console.log('❌ No se encontró ningún chunk con "racismo inmobiliario"');
  }
}

findRacismoChunk().catch(console.error);