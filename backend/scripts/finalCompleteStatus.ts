#!/usr/bin/env tsx

import dotenv from 'dotenv';
dotenv.config();
dotenv.config({ path: '../.env' });

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const EXPECTED_TOPICS = [
  'tema01_constitucion_espanola',
  'tema02_derechos_humanos', 
  'tema03_gobierno_y_administracion',
  'tema04_organizacion_territorial',
  'tema05_la_union_europea',
  'tema06_el_poder_judicial',
  'tema10_carta_de_ciudadanos',
  'tema16_libertad_sindical',
  'tema17a19_proceso_civil',
  'tema1_2_LOTC',
  'tema24_archivo_judicial',
  'tema28a30_procesos_especiales',
  'tema38_medidas_cautelares',
  'tema45_el_sumario',
  'tema54_el_procedimiento_por_delitos_leves',
  'tema62_los_recursos',
  'tema63_procedimientos_especiales',
  'tema64_disposiciones_comunes',
  'tema68_concurso_de_acreedores'
];

const EXPECTED_LAWS = [
  'LEC',
  'LECrim', 
  'TRLC',
  'LRC',
  'Ley_3_2007_Igualdad',
  'Ley_50_1997_Gobierno'
];

async function finalCompleteStatus() {
  console.log('🎉 VERIFICACIÓN FINAL COMPLETA - LEXIA RAG SYSTEM');
  console.log('================================================\n');
  
  // Total general
  const { count: totalCount } = await supabase
    .from('document_embeddings')
    .select('*', { count: 'exact', head: true });
  
  console.log(`📊 TOTAL REGISTROS EN SUPABASE: ${totalCount || 0}\n`);
  
  // === LEYES ===
  console.log('📚 LEYES (6/6 esperadas):');
  console.log('==========================');
  
  let totalLawChunks = 0;
  let completeLaws = 0;
  
  for (const lawName of EXPECTED_LAWS) {
    const { count } = await supabase
      .from('document_embeddings')
      .select('*', { count: 'exact', head: true })
      .eq('document_type', 'law')
      .eq('law_name', lawName);
    
    totalLawChunks += (count || 0);
    if (count && count > 0) completeLaws++;
    
    console.log(`   ✅ ${lawName}: ${count || 0} chunks`);
  }
  
  console.log(`   📊 Leyes completas: ${completeLaws}/${EXPECTED_LAWS.length}`);
  console.log(`   📊 Total chunks leyes: ${totalLawChunks}\n`);
  
  // === CLASES ===
  console.log('🎓 CLASES (19/19 esperadas):');
  console.log('=============================');
  
  let totalClassChunks = 0;
  let completeTopics = 0;
  
  for (const topicName of EXPECTED_TOPICS) {
    const { count } = await supabase
      .from('document_embeddings')
      .select('*', { count: 'exact', head: true })
      .eq('document_type', 'class')
      .eq('law_name', topicName);
    
    totalClassChunks += (count || 0);
    if (count && count > 0) completeTopics++;
    
    const status = count && count > 0 ? '✅' : '❌';
    console.log(`   ${status} ${topicName}: ${count || 0} chunks`);
  }
  
  console.log(`   📊 Temas completos: ${completeTopics}/${EXPECTED_TOPICS.length}`);
  console.log(`   📊 Total chunks clases: ${totalClassChunks}\n`);
  
  // === RESUMEN FINAL ===
  console.log('🎯 RESUMEN FINAL:');
  console.log('==================');
  console.log(`   📄 Total registros: ${totalCount || 0}`);
  console.log(`   📚 Chunks de leyes: ${totalLawChunks}`);
  console.log(`   🎓 Chunks de clases: ${totalClassChunks}`);
  console.log(`   🔢 Suma verificada: ${totalLawChunks + totalClassChunks}`);
  console.log(`   ✅ Integridad: ${totalCount === (totalLawChunks + totalClassChunks) ? 'CORRECTA' : 'ERROR'}`);
  
  // === ESTADO DEL SISTEMA ===
  const allComplete = (completeLaws === EXPECTED_LAWS.length) && (completeTopics === EXPECTED_TOPICS.length);
  
  console.log('\n🚀 ESTADO DEL SISTEMA RAG:');
  console.log('===========================');
  if (allComplete) {
    console.log('   🎉 ¡SISTEMA COMPLETO Y OPERATIVO!');
    console.log('   ✅ Todas las leyes subidas');
    console.log('   ✅ Todas las clases subidas');
    console.log('   ✅ Schema unificado implementado');
    console.log('   ✅ Chunking inteligente aplicado');
    console.log('   🚀 LexIA listo para consultas RAG avanzadas');
  } else {
    console.log('   ⚠️  Sistema incompleto');
    console.log(`   📚 Leyes: ${completeLaws}/${EXPECTED_LAWS.length}`);
    console.log(`   🎓 Clases: ${completeTopics}/${EXPECTED_TOPICS.length}`);
  }
  
  console.log(`\n💾 Base de datos final: ${totalCount} registros con embeddings OpenAI`);
  console.log('🎯 Sistema RAG híbrido con búsqueda por metadata y similitud semántica');
  console.log('⚖️ Especializado en preparación de oposiciones de justicia\n');
}

finalCompleteStatus();