#!/bin/bash

# Dragon Station 2026 - Deployment Script
# This script helps deploy all components to Cloudflare

set -e

echo "🚀 Dragon Station 2026 - Deployment Script"
echo "=========================================="
echo ""

# Check if wrangler is installed
if ! command -v wrangler &> /dev/null; then
    echo "❌ Wrangler CLI not found. Please install it:"
    echo "   npm install -g wrangler"
    exit 1
fi

# Check if authenticated
if ! wrangler whoami &> /dev/null; then
    echo "⚠️  Not authenticated with Cloudflare. Running 'wrangler login'..."
    wrangler login
fi

echo "✅ Authenticated with Cloudflare"
echo ""

# Deploy API Worker
echo "📦 Deploying API Worker..."
cd infra
wrangler deploy
cd ..

echo ""
echo "✅ API Worker deployed!"
echo ""

# Get worker URL
WORKER_URL=$(wrangler deployments list --config infra/wrangler.toml 2>/dev/null | head -1 | awk '{print $NF}' || echo "")
if [ -z "$WORKER_URL" ]; then
    echo "⚠️  Could not determine worker URL. Please check Cloudflare Dashboard."
    WORKER_URL="https://dragon-station-2026-api.your-subdomain.workers.dev"
fi

echo "🌐 Worker URL: $WORKER_URL"
echo ""
echo "📝 Next steps:"
echo "1. Deploy storefront to Cloudflare Pages:"
echo "   cd apps/store && npm run build"
echo "   wrangler pages deploy .next --project-name=dragon-station-store"
echo ""
echo "2. Deploy admin panel to Cloudflare Pages:"
echo "   cd apps/admin && npm run build"
echo "   wrangler pages deploy .next --project-name=dragon-station-admin"
echo ""
echo "3. Set NEXT_PUBLIC_API_URL=$WORKER_URL in Pages environment variables"
echo ""
echo "✨ Deployment complete!"

