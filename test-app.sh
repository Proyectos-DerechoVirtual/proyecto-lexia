#!/bin/bash

echo "🧪 Testing LexIA Application..."
echo ""

# Matar procesos existentes
echo "🔄 Stopping existing processes..."
lsof -ti:3000 | xargs kill -9 2>/dev/null || true
lsof -ti:5000 | xargs kill -9 2>/dev/null || true

sleep 2

echo "🚀 Starting application..."
cd "$(dirname "$0")"

# Ejecutar en background para que no bloquee
npm run dev &
APP_PID=$!

echo "⏳ Waiting for application to start..."
sleep 10

echo ""
echo "🌐 Application URLs:"
echo "   Frontend: http://localhost:3000"
echo "   Backend:  http://localhost:5000/health"
echo ""
echo "📋 Testing checklist:"
echo "   1. ✅ Can access frontend"
echo "   2. ⏳ Can register new user"
echo "   3. ⏳ Can login with user"
echo "   4. ⏳ Category buttons work"
echo "   5. ⏳ Can send messages"
echo ""

# Test backend health
echo "🔍 Testing backend health..."
if curl -s http://localhost:5000/health > /dev/null; then
    echo "   ✅ Backend is responding"
else
    echo "   ❌ Backend is not responding"
fi

echo ""
echo "Press CTRL+C to stop the application"

# Wait for user to interrupt
trap "echo ''; echo '🛑 Stopping application...'; kill $APP_PID; exit" INT
wait $APP_PID