#!/usr/bin/env tsx

import dotenv from 'dotenv';
dotenv.config();
dotenv.config({ path: '../.env' });

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function setupRPCFunction() {
  console.log('🛠️ Configurando función RPC actualizada para búsqueda por embeddings...\n');
  
  try {
    // Leer el archivo SQL
    const sqlPath = path.join(__dirname, '../sql/update_search_function.sql');
    const sqlContent = fs.readFileSync(sqlPath, 'utf-8');
    
    // Ejecutar el SQL
    const { data, error } = await supabase.rpc('sql', {
      query: sqlContent
    });
    
    if (error) {
      // Intentar método alternativo usando una consulta directa
      console.log('⚠️ Método RPC no disponible, intentando configuración manual...');
      
      // Eliminar función existente
      const { error: dropError } = await supabase.rpc('search_documents');
      console.log('🗑️ Eliminando función existente (si existe)...');
      
      // La función se debe crear manualmente en Supabase SQL Editor
      console.log('\n📋 INSTRUCCIONES MANUALES:');
      console.log('==========================');
      console.log('1. Ve a tu panel de Supabase');
      console.log('2. Abre el SQL Editor');
      console.log('3. Ejecuta el siguiente SQL:\n');
      console.log(sqlContent);
      console.log('\n4. Después ejecuta el script de prueba');
      
      return;
    }
    
    console.log('✅ Función RPC configurada exitosamente');
    console.log('🚀 Sistema listo para pruebas');
    
  } catch (error) {
    console.error('❌ Error configurando función RPC:', error);
    
    console.log('\n📋 CONFIGURACIÓN MANUAL REQUERIDA:');
    console.log('==================================');
    console.log('Ejecuta este SQL en tu Supabase SQL Editor:\n');
    
    const sqlPath = path.join(__dirname, '../sql/update_search_function.sql');
    const sqlContent = fs.readFileSync(sqlPath, 'utf-8');
    console.log(sqlContent);
  }
}

setupRPCFunction();