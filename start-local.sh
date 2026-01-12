#!/bin/bash
set -e

echo "🚀 Starting Vonage Call System Locally..."

if [ ! -f "backend/private.key" ]; then
    echo "❌ ERROR: backend/private.key not found!"
    exit 1
fi

if [ ! -f "backend/.env" ]; then
    echo "⚠️  Creating backend/.env file..."
    cat > backend/.env << 'ENVFILE'
VONAGE_API_KEY=your_api_key_here
VONAGE_API_SECRET=your_api_secret_here
VONAGE_APPLICATION_ID=your_app_id_here
VONAGE_PHONE_NUMBER=+1234567890
JWT_SECRET=change_this_secret
BASE_URL=http://localhost:8080
ADMIN_PHONE=+1234567890
ENVFILE
    echo "✅ Created backend/.env - PLEASE EDIT WITH YOUR VONAGE CREDENTIALS"
    exit 1
fi

if [ ! -d "backend/node_modules" ]; then
    echo "📦 Installing backend dependencies..."
    cd backend && npm install && cd ..
fi

if [ ! -d "frontend/node_modules" ]; then
    echo "📦 Installing frontend dependencies..."
    cd frontend && npm install && cd ..
fi

echo "🏗️  Building frontend..."
cd frontend && npm run build && cd ..

echo "🚀 Starting server on http://localhost:8080"
cd backend && node server.js
