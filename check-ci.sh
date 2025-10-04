#!/bin/bash

# Check GitHub Actions CI status

echo "🔍 Checking CI status for walletconnect-sequential-tx..."
echo ""

# Get latest run
LATEST_RUN=$(curl -s "https://api.github.com/repos/cryptoflops/walletconnect-sequential-tx/actions/runs?per_page=1" | grep -E '"(status|conclusion|display_title|html_url)"' | head -8)

# Parse the response
TITLE=$(echo "$LATEST_RUN" | grep "display_title" | cut -d'"' -f4)
STATUS=$(echo "$LATEST_RUN" | grep "\"status\"" | head -1 | cut -d'"' -f4)
CONCLUSION=$(echo "$LATEST_RUN" | grep "conclusion" | cut -d'"' -f4 | cut -d',' -f1)
URL=$(echo "$LATEST_RUN" | grep "html_url" | head -1 | cut -d'"' -f4)

echo "📝 Latest commit: $TITLE"
echo "🏃 Status: $STATUS"

if [ "$STATUS" = "completed" ]; then
    if [ "$CONCLUSION" = "success" ]; then
        echo "✅ Result: SUCCESS"
    else
        echo "❌ Result: FAILED"
    fi
else
    echo "⏳ Build in progress..."
fi

echo ""
echo "🔗 View details: $URL"
echo ""

# Show badge
echo "📊 CI Badge:"
echo "[![CI](https://github.com/cryptoflops/walletconnect-sequential-tx/actions/workflows/ci.yml/badge.svg)](https://github.com/cryptoflops/walletconnect-sequential-tx/actions/workflows/ci.yml)"