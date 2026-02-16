# 🔧 Configuración de Supabase para LexIA

## ⚠️ IMPORTANTE: Configuración requerida

Para que la aplicación funcione correctamente, necesitas configurar Supabase:

### 1. 🗃️ **Ejecutar el esquema de base de datos**

1. Ve a: https://supabase.com/dashboard/project/yxcykvoxbtseawrigbcp
2. SQL Editor → New query
3. **PRIMERO ejecuta:** `docs/supabase-reset.sql` (para limpiar)
4. **DESPUÉS ejecuta:** `docs/supabase-schema-fixed.sql` (para crear)

### 2. 🔐 **Deshabilitar confirmación de email**

1. Ve a: **Authentication** → **Settings**
2. Busca: **"Enable email confirmations"**
3. **DESACTÍVALO** (toggle OFF)
4. **SAVE** los cambios

### 3. 🌐 **Configurar URLs permitidas**

En **Authentication** → **URL Configuration**:

- **Site URL:** `http://localhost:3000`
- **Redirect URLs:** `http://localhost:3000, http://localhost:3001`

### 4. 🔒 **Configurar políticas RLS**

Ve a **Authentication** → **Policies** y verifica que están creadas:

- `profiles` - Usuarios pueden ver/crear/actualizar su propio perfil
- `conversations` - Usuarios pueden ver/crear sus conversaciones
- `messages` - Usuarios pueden ver/crear mensajes en sus conversaciones

## ✅ **Verificar configuración**

Después de seguir estos pasos:

```bash
./test-app.sh
```

### 🐛 **Si sigue sin funcionar:**

1. **Verifica en Supabase Dashboard:**
   - Logs → realtime (para ver errores)
   - Tabla `profiles` se crea automáticamente al registrarse
   
2. **Verifica en el navegador:**
   - F12 → Console (para ver errores JS)
   - Network tab (para ver si las requests fallan)

3. **Verifica backend:**
   - http://localhost:5000/health debe responder

## 📞 **Si necesitas ayuda:**

1. Revisa que las tablas existan en Supabase
2. Verifica que email confirmation esté DESHABILITADO
3. Asegúrate de que el backend esté corriendo en puerto 5000