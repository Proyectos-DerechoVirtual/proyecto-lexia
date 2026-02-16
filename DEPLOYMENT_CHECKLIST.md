# 🚀 LexIA Deployment Checklist

## ✅ Pre-Deployment
- [x] Backend configurado para Vercel
- [x] Frontend configurado para Vercel
- [x] Variables de entorno preparadas
- [x] CORS configurado para producción
- [x] Compression habilitado

## 🔧 Backend Deployment
- [ ] Deploy inicial con `vercel`
- [ ] Configurar variables de entorno en Vercel Dashboard:
  - [ ] SUPABASE_URL
  - [ ] SUPABASE_ANON_KEY
  - [ ] SUPABASE_SERVICE_ROLE_KEY
  - [ ] OPENAI_API_KEY
  - [ ] ANTHROPIC_API_KEY (opcional)
  - [ ] NODE_ENV=production
  - [ ] FRONTEND_URL
- [ ] Re-deploy con `vercel --prod`
- [ ] Verificar endpoint: https://tu-backend.vercel.app/health

## 🎨 Frontend Deployment
- [ ] Actualizar VITE_API_URL en .env.production
- [ ] Deploy inicial con `vercel`
- [ ] Configurar variables de entorno en Vercel Dashboard:
  - [ ] VITE_API_URL
  - [ ] VITE_SUPABASE_URL
  - [ ] VITE_SUPABASE_ANON_KEY
- [ ] Re-deploy con `vercel --prod`
- [ ] Verificar acceso: https://lexia-chatbot.vercel.app

## 🧪 Testing Post-Deploy
- [ ] Verificar login/registro
- [ ] Crear nueva conversación
- [ ] Enviar mensaje y recibir respuesta
- [ ] Verificar que el RAG funciona
- [ ] Probar los botones de sugerencias
- [ ] Editar nombre de conversación
- [ ] Verificar modo oscuro/claro

## 📊 Monitoreo
- [ ] Revisar logs en Vercel Dashboard
- [ ] Verificar métricas en Supabase
- [ ] Comprobar uso de OpenAI

## 🎯 Optimizaciones Opcionales
- [ ] Configurar dominio personalizado
- [ ] Habilitar analytics
- [ ] Configurar alertas de error
- [ ] Implementar rate limiting
- [ ] Agregar Sentry para tracking de errores

## 📝 Notas Importantes
- El backend puede tardar 1-2 minutos en estar completamente activo
- Las funciones serverless tienen un timeout de 30 segundos
- Vercel Free incluye 100GB de bandwidth mensual
- Supabase Free incluye 500MB de almacenamiento

## 🆘 Troubleshooting

### Si el frontend no conecta con el backend:
1. Verifica que VITE_API_URL esté correcta
2. Revisa CORS en el backend
3. Confirma que las variables de entorno están configuradas

### Si el RAG no funciona:
1. Verifica SUPABASE_SERVICE_ROLE_KEY
2. Confirma que la tabla document_embeddings existe
3. Revisa los logs en Vercel Dashboard

### Si OpenAI no responde:
1. Verifica OPENAI_API_KEY
2. Confirma tu cuota en OpenAI Dashboard
3. Revisa rate limits