#!/usr/bin/env tsx

import dotenv from 'dotenv';
dotenv.config();
dotenv.config({ path: '../.env' });

import { getUnifiedRAGService } from '../src/services/ragServiceUnified';

async function testUpdatedRAGService() {
  console.log('🚀 Probando servicio RAG actualizado...\n');
  
  const ragService = getUnifiedRAGService();
  
  // Pruebas de consultas variadas
  const testQueries = [
    // Consultas de artículos específicos
    'Artículo 15',
    'Artículo 20 de la ley de igualdad', 
    'Qué dice el artículo 1',
    
    // Consultas por ley específica
    'Ley de Enjuiciamiento Civil',
    'LECrim',
    'Ley 50/1997 del Gobierno',
    'TRLC',
    
    // Consultas temáticas
    '¿Qué medidas establece la ley para promover la igualdad?',
    'discriminación laboral',
    'concurso de acreedores',
    
    // Consultas de clases
    'constitución española',
    'poder judicial',
    'proceso civil'
  ];
  
  for (const query of testQueries) {
    console.log(`\n🔍 Consulta: "${query}"`);
    console.log('=' + '='.repeat(query.length + 12));
    
    try {
      const startTime = Date.now();
      
      // Probar búsqueda de documentos relevantes
      const relevantDocs = await ragService.searchRelevantDocuments(query, 0.2, 3);
      
      const searchTime = Date.now() - startTime;
      
      console.log(`⚡ Búsqueda completada en ${searchTime}ms`);
      console.log(`📊 Documentos encontrados: ${relevantDocs.length}`);
      
      if (relevantDocs.length > 0) {
        console.log('\n📋 Resultados:');
        relevantDocs.forEach((doc, index) => {
          console.log(`\n   ${index + 1}. [${doc.document_type?.toUpperCase()}] ${doc.law_name || 'Sin ley'}`);
          console.log(`      📄 Similitud: ${(doc.similarity * 100).toFixed(1)}%`);
          console.log(`      🔍 Método: ${doc.search_method || 'embedding'}`);
          if (doc.article_number) {
            console.log(`      📖 Artículo: ${doc.article_number}`);
          }
          if (doc.section_title) {
            console.log(`      📑 Sección: ${doc.section_title}`);
          }
          console.log(`      📝 Contenido: ${doc.content.substring(0, 150).replace(/\n/g, ' ')}...`);
        });
        
        // Probar generación de contexto
        console.log('\n🧠 Generando contexto...');
        const contextStartTime = Date.now();
        const context = await ragService.getEnhancedContext(query);
        const contextTime = Date.now() - contextStartTime;
        
        console.log(`⚡ Contexto generado en ${contextTime}ms`);
        console.log(`📏 Longitud del contexto: ${context.length} caracteres`);
        
        if (context.length > 0) {
          console.log(`📄 Contexto (primeros 200 chars): ${context.substring(0, 200).replace(/\n/g, ' ')}...`);
        }
      } else {
        console.log('   ❌ No se encontraron documentos relevantes');
      }
      
    } catch (error) {
      console.error(`   ❌ Error en consulta: ${error}`);
    }
  }
  
  // Probar estadísticas del sistema
  console.log('\n📊 ESTADÍSTICAS DEL SISTEMA:');
  console.log('============================');
  
  try {
    const stats = await ragService.getDocumentStats();
    
    console.log(`📄 Total chunks: ${stats.totalChunks}`);
    console.log(`📚 Total leyes: ${stats.totalLaws}`);
    console.log(`🎓 Total temas de clases: ${stats.totalClassTopics}`);
    console.log(`⚖️ Chunks de leyes: ${stats.lawChunks}`);
    console.log(`📖 Chunks de clases: ${stats.classChunks}`);
    
    console.log('\n📚 Leyes disponibles:');
    stats.availableLaws.forEach((law: string) => {
      console.log(`   - ${law}`);
    });
    
    console.log('\n🎓 Temas de clases disponibles (primeros 10):');
    stats.availableClassTopics.slice(0, 10).forEach((topic: string) => {
      console.log(`   - ${topic}`);
    });
    
    if (stats.availableClassTopics.length > 10) {
      console.log(`   ... y ${stats.availableClassTopics.length - 10} temas más`);
    }
    
  } catch (error) {
    console.error(`❌ Error obteniendo estadísticas: ${error}`);
  }
  
  console.log('\n🎉 Prueba del RAG actualizado completada!');
}

testUpdatedRAGService();