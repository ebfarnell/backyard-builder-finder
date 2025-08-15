#!/bin/bash

# Deployment script for Yard Qualifier with Real Data Integration

echo "🚀 Deploying Yard Qualifier with Real Data Integration..."

# Check if we're in a git repository
if [ ! -d ".git" ]; then
    echo "❌ Not in a git repository. Please run from project root."
    exit 1
fi

# Check for uncommitted changes
if [ -n "$(git status --porcelain)" ]; then
    echo "📝 Found uncommitted changes. Committing..."
    
    # Add all changes
    git add .
    
    # Commit with descriptive message
    git commit -m "feat: integrate real data from Regrid API

- Add RealDataService for fetching live parcel data
- Enhance SearchService with automatic real data fetching
- Add admin interface for data management
- Configure Regrid API key in render.yaml
- Add cost controls and caching
- Support for real property boundaries, addresses, and zoning
- Graceful fallback if real data fetch fails"
    
    echo "✅ Changes committed"
else
    echo "✅ No uncommitted changes found"
fi

# Push to main branch
echo "📤 Pushing to main branch..."
git push origin main

if [ $? -eq 0 ]; then
    echo "✅ Successfully pushed to main branch"
    echo ""
    echo "🎯 Deployment Status:"
    echo "   - Render.com will auto-deploy from main branch"
    echo "   - Monitor deployment at: https://dashboard.render.com"
    echo "   - API will be available at: https://yard-qualifier-api.onrender.com"
    echo "   - Web app will be available at: https://yard-qualifier-web.onrender.com"
    echo ""
    echo "🔍 After deployment, run verification:"
    echo "   node scripts/verify-deployment.js"
    echo ""
    echo "🎉 Real data integration is ready to go live!"
else
    echo "❌ Failed to push to main branch"
    exit 1
fi