#!/bin/bash

# Script to push to GitHub after repository is created

echo "🚀 Pushing to GitHub..."

# Try to push
git push -u origin main

# Check if push was successful
if [ $? -eq 0 ]; then
    echo "✅ Successfully pushed to GitHub!"
    echo "🔗 Repository URL: https://github.com/cryptoflops/walletconnect-sequential-tx"
    echo ""
    echo "📋 Next steps:"
    echo "1. Add a description and topics on GitHub"
    echo "2. Consider enabling GitHub Pages for documentation"
    echo "3. Set up GitHub Actions for CI/CD"
    echo "4. Create releases for version management"
    echo "5. Share in WalletConnect Discord!"
else
    echo "❌ Push failed. Please ensure:"
    echo "1. Repository exists at https://github.com/cryptoflops/walletconnect-sequential-tx"
    echo "2. You have push access to the repository"
    echo "3. Your GitHub credentials are configured correctly"
    echo ""
    echo "To configure GitHub credentials:"
    echo "  git config --global user.name 'Your Name'"
    echo "  git config --global user.email 'your.email@example.com'"
fi