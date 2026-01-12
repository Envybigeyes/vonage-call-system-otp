#!/bin/bash
set -e

echo "🚀 Deploying Vonage Call System to Fly.io..."

if [ ! -f "backend/private.key" ]; then
    echo "❌ ERROR: backend/private.key not found!"
    echo "Please add your Vonage private key file:"
    echo "  cp /path/to/your/private.key backend/private.key"
    exit 1
fi

if ! command -v flyctl &> /dev/null; then
    echo "❌ Fly.io CLI not found. Run the setup script first."
    exit 1
fi

echo "📦 Deploying to Fly.io..."
flyctl deploy

echo ""
echo "✅ DEPLOYMENT COMPLETE!"
echo "🌐 Access your app at: https://vonage-call-system.fly.dev"
echo "🔐 Login: admin / admin"
