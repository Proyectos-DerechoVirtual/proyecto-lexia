#!/usr/bin/env tsx

import dotenv from 'dotenv';
dotenv.config();
dotenv.config({ path: '../.env' });

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkCurrentSchema() {
  console.log('🔍 Verificando schema actual de document_embeddings...\n');
  
  try {
    // Obtener información sobre la tabla
    const { data: tableInfo, error: tableError } = await supabase.rpc('get_table_columns', {
      table_name: 'document_embeddings'
    });
    
    if (tableError) {
      console.log('⚠️  No se pudo obtener info con RPC, intentando consulta directa...');
      
      // Método alternativo: consultar datos existentes
      const { data: existingData, error: dataError } = await supabase
        .from('document_embeddings')
        .select('*')
        .limit(1);
      
      if (dataError) {
        console.error('❌ Error consultando tabla:', dataError.message);
        
        if (dataError.message.includes('does not exist')) {
          console.log('📝 La tabla document_embeddings NO EXISTE');
          console.log('   ✅ Necesitas ejecutar setup_rag.sql completo');
          return;
        }
      } else {
        console.log('✅ Tabla existe, verificando estructura...');
        
        if (existingData && existingData.length > 0) {
          console.log('📊 Datos encontrados:');
          console.log(`   📄 Registros: ${existingData.length}`);
          console.log('   🔑 Columnas disponibles:');
          
          const record = existingData[0];
          Object.keys(record).forEach(column => {
            const value = record[column];
            const type = typeof value;
            const preview = type === 'string' ? 
              (value.length > 50 ? value.substring(0, 50) + '...' : value) :
              value;
            console.log(`      - ${column}: ${type} ${type === 'object' && value !== null ? '(object)' : `= "${preview}"`}`);
          });
          
        } else {
          console.log('📊 Tabla vacía, no hay datos para analizar estructura');
        }
      }
    }
    
    // Intentar consultar con columnas específicas para verificar qué existe
    console.log('\n🧪 Probando columnas esperadas...');
    
    const columnsToTest = [
      'id',
      'content', 
      'embedding',
      'metadata',
      'document_type',
      'law_name', 
      'article_number',
      'section_title',
      'category',
      'created_at',
      'updated_at'
    ];
    
    const availableColumns: string[] = [];
    const missingColumns: string[] = [];
    
    for (const column of columnsToTest) {
      try {
        const { error } = await supabase
          .from('document_embeddings')
          .select(column)
          .limit(1);
        
        if (error) {
          if (error.message.includes(`column "${column}" does not exist`)) {
            missingColumns.push(column);
          } else {
            console.log(`   ⚠️  Error inesperado en ${column}: ${error.message}`);
          }
        } else {
          availableColumns.push(column);
        }
      } catch (err) {
        missingColumns.push(column);
      }
    }
    
    console.log('\n📋 Resultado del análisis:');
    console.log(`✅ Columnas disponibles (${availableColumns.length}):`);
    availableColumns.forEach(col => console.log(`   - ${col}`));
    
    if (missingColumns.length > 0) {
      console.log(`\n❌ Columnas faltantes (${missingColumns.length}):`);
      missingColumns.forEach(col => console.log(`   - ${col}`));
    }
    
    // Contar registros existentes
    const { count, error: countError } = await supabase
      .from('document_embeddings')
      .select('*', { count: 'exact', head: true });
    
    if (!countError) {
      console.log(`\n📈 Total registros existentes: ${count || 0}`);
      
      if (count && count > 0) {
        console.log('\n⚠️  IMPORTANTE: Tienes datos existentes');
        console.log('   Opciones para migración:');
        console.log('   1. 🗑️  DROP + CREATE: Perder datos existentes');
        console.log('   2. 🔄 ALTER TABLE: Mantener datos + agregar columnas');
        console.log('   3. 📋 BACKUP + RESTORE: Respaldar datos + recrear tabla');
      }
    }
    
  } catch (error) {
    console.error('❌ Error general:', error);
  }
}

async function main() {
  await checkCurrentSchema();
}

if (require.main === module) {
  main();
}