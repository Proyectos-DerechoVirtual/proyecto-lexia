# Scripts de Administración - LexIA

## 📚 Scripts de Procesamiento

### `convertClassesToMarkdown.ts`
Convierte archivos TXT de clases a formato Markdown con metadata.
```bash
npx tsx scripts/convertClassesToMarkdown.ts
```

### `uploadClassesToSupabase.ts`
Procesa y sube materiales de clase a Supabase con chunking inteligente.
```bash
npx tsx scripts/uploadClassesToSupabase.ts
```

### `uploadLawsToSupabase.ts`
Procesa y sube las 6 leyes a Supabase.
```bash
npx tsx scripts/uploadLawsToSupabase.ts
```

### `completeLawsUpload.ts`
Completa uploads parciales o interrumpidos.
```bash
npx tsx scripts/completeLawsUpload.ts
```

## 🧪 Scripts de Testing

### `testUpdatedRAG.ts`
Test completo del sistema RAG con múltiples consultas.
```bash
npx tsx scripts/testUpdatedRAG.ts
```

### `finalCompleteStatus.ts`
Verifica el estado completo del sistema y base de datos.
```bash
npx tsx scripts/finalCompleteStatus.ts
```

### `checkSupabaseSchema.ts`
Verifica que el schema de Supabase esté correcto.
```bash
npx tsx scripts/checkSupabaseSchema.ts
```

## 🔧 Scripts de Configuración

### `setupUpdatedRPCFunction.ts`
Configura las funciones RPC necesarias en Supabase.
```bash
npx tsx scripts/setupUpdatedRPCFunction.ts
```

## 📊 Estado Actual del Sistema

- **Total registros**: 7,154
- **Leyes procesadas**: 6 (LEC, LECrim, TRLC, LRC, Ley 3/2007, Ley 50/1997)
- **Temas de clases**: 19 (Constitución, Derechos Humanos, Gobierno, etc.)
- **Chunks de leyes**: 3,315
- **Chunks de clases**: 3,839

## ⚠️ Notas Importantes

1. **Orden de ejecución** para setup inicial:
   - convertClassesToMarkdown.ts
   - uploadLawsToSupabase.ts
   - uploadClassesToSupabase.ts
   - finalCompleteStatus.ts (verificación)

2. **Verificación periódica**:
   - Ejecutar `finalCompleteStatus.ts` para verificar integridad
   - Usar `testUpdatedRAG.ts` para probar funcionalidad

3. **En caso de problemas**:
   - `checkSupabaseSchema.ts` para verificar estructura
   - `completeLawsUpload.ts` si hay uploads incompletos