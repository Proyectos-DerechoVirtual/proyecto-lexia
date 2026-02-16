import { getUnifiedRAGService } from '../src/services/ragServiceUnified';
import dotenv from 'dotenv';

dotenv.config();

async function debugRacismoContext() {
  const rag = getUnifiedRAGService();
  
  console.log('🔍 Debugging "racismo inmobiliario" search...\n');
  
  const query = 'racismo inmobiliario';
  
  // Search for documents
  const results = await rag.searchRelevantDocuments(query, 0.2, 10);
  
  console.log(`📊 Found ${results.length} documents\n`);
  
  // Check each result for the terms
  results.forEach((doc, i) => {
    const hasRacismo = doc.content.toLowerCase().includes('racismo');
    const hasInmobiliario = doc.content.toLowerCase().includes('inmobiliario');
    
    console.log(`\n📄 Document ${i + 1}:`);
    console.log(`  Law/Topic: ${doc.law_name}`);
    console.log(`  Similarity: ${(doc.similarity * 100).toFixed(1)}%`);
    console.log(`  Contains "racismo": ${hasRacismo ? '✅' : '❌'}`);
    console.log(`  Contains "inmobiliario": ${hasInmobiliario ? '✅' : '❌'}`);
    
    if (hasRacismo || hasInmobiliario) {
      console.log(`  Preview: ${doc.content.substring(0, 200)}...`);
    }
  });
  
  // Get enhanced context
  const context = await rag.getEnhancedContext(query);
  console.log('\n📝 Enhanced Context:');
  console.log(`  Length: ${context.length} chars`);
  console.log(`  Contains "racismo": ${context.toLowerCase().includes('racismo') ? '✅' : '❌'}`);
  console.log(`  Contains "inmobiliario": ${context.toLowerCase().includes('inmobiliario') ? '✅' : '❌'}`);
  
  // Search specifically in tema02_derechos_humanos
  console.log('\n🔍 Searching specifically in tema02_derechos_humanos...');
  const { createClient } = require('@supabase/supabase-js');
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  
  const { data: tema02Docs } = await supabase
    .from('document_embeddings')
    .select('content, section_title')
    .eq('law_name', 'tema02_derechos_humanos')
    .ilike('content', '%racismo%')
    .limit(5);
  
  if (tema02Docs && tema02Docs.length > 0) {
    console.log(`\n✅ Found ${tema02Docs.length} documents with "racismo" in tema02:`)
    tema02Docs.forEach((doc, i) => {
      console.log(`\n${i + 1}. Section: ${doc.section_title}`);
      const racismoIndex = doc.content.toLowerCase().indexOf('racismo');
      if (racismoIndex > -1) {
        const start = Math.max(0, racismoIndex - 50);
        const end = Math.min(doc.content.length, racismoIndex + 150);
        console.log(`   ...${doc.content.substring(start, end)}...`);
      }
    });
  } else {
    console.log('❌ No documents found with "racismo" in tema02_derechos_humanos');
  }
}

debugRacismoContext().catch(console.error);