#!/bin/bash

# Backyard Builder Finder - Netlify Deployment Script
set -e

echo "🚀 Starting Netlify deployment for Backyard Builder Finder..."

# Check if we're in the right directory
if [ ! -f "netlify.toml" ]; then
    echo "❌ Error: netlify.toml not found. Please run this script from the project root."
    exit 1
fi

# Environment setup
export NODE_ENV=production
export NEXT_PUBLIC_NODE_ENV=production
export NEXT_PUBLIC_API_URL=https://backyard-builder-finder-api.onrender.com
export NEXT_PUBLIC_SUPABASE_URL=https://jgmiixdkhbmaeeoniajh.supabase.co
export NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpnbWlpeGRraGJtYWVlb25pYWpoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUxNDM1OTMsImV4cCI6MjA3MDcxOTU5M30.WB7Xqns_rHM_d4in52mldMQ2AAx5vMILLUaKrZ35U9s
export NEXT_PUBLIC_ENABLE_DEMO_MODE=false
export NEXT_PUBLIC_ENABLE_ANALYTICS=true
export NEXT_PUBLIC_ENABLE_DEBUG=false

echo "📦 Installing dependencies..."
cd apps/web
npm ci

echo "🔨 Building Next.js application..."
npm run build

echo "📂 Build completed. Output directory: apps/web/out"
ls -la out/ | head -10

echo ""
echo "✅ Build successful! Ready for deployment."
echo ""
echo "📋 Next steps:"
echo "1. Go to https://app.netlify.com"
echo "2. Drag and drop the 'apps/web/out' folder to deploy"
echo "3. Or connect the GitHub repository: ebfarnell/backyard-builder-finder"
echo ""
echo "🔗 GitHub Repository: https://github.com/ebfarnell/backyard-builder-finder"
echo "🔗 Expected backend: https://backyard-builder-finder-api.onrender.com"
echo ""