#!/usr/bin/env node

/**
 * Base Mainnet Testing Setup
 * This script helps you test the Sequential Transaction Handler on Base mainnet
 */

const fs = require('fs');
const path = require('path');

console.log('🚀 Setting up Base mainnet testing environment...\n');

// Check if .env.base exists
const envPath = path.join(__dirname, '.env.base');
if (!fs.existsSync(envPath)) {
  console.log('📝 Creating .env.base file...');
  const envTemplate = `# Base Mainnet Configuration
# ⚠️  WARNING: This is for MAINNET - real money! Use small amounts for testing

# Base Mainnet RPC URLs (choose one)
RPC_URL=https://mainnet.base.org
# RPC_URL=https://base.llamarpc.com
# RPC_URL=https://base.blockpi.network/v1/rpc/public

# Your wallet private key (USE A TEST WALLET WITH SMALL AMOUNTS!)
# Create a new wallet specifically for testing
# NEVER commit this file with a real private key!
PRIVATE_KEY=YOUR_PRIVATE_KEY_HERE
        
# Base Network Configuration
CHAIN_ID=8453
NETWORK_NAME=base

# Base Block Explorer
EXPLORER_URL=https://basescan.org

# Transaction Settings
DEFAULT_GAS_LIMIT=100000
CONFIRMATION_BLOCKS=1
MAX_RETRIES=3

# Test Recipients (you can change these)
TEST_RECIPIENT_1=0x
TEST_RECIPIENT_2=0x

# Test Amounts (in ETH - keep these small!)
TEST_AMOUNT_ETH=0.000001

# Popular Base Tokens (for testing token transfers)
# USDC on Base
USDC_ADDRESS=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
# Wrapped ETH on Base
WETH_ADDRESS=0x4200000000000000000000000000000000000006

# DEX Contracts on Base
# Uniswap V3 Router
UNISWAP_V3_ROUTER=0x2626664c2603336E57B271c5C0b26F421741e481
# BaseSwap Router
BASESWAP_ROUTER=0x327Df1E6de05895d2ab08513aaDD9313Fe505d86

# Bridge Base ETH to Base:
# https://bridge.base.org/
`;
  
  fs.writeFileSync(envPath, envTemplate);
  console.log('✅ Created .env.base template\n');
  console.log('⚠️  IMPORTANT: Edit .env.base with your configuration before testing!\n');
} else {
  console.log('✅ .env.base already exists\n');
}

console.log('📌 Base Mainnet Information:');
console.log('   Chain ID: 8453');
console.log('   Native Token: ETH');
console.log('   Block Explorer: https://basescan.org');
console.log('   Bridge: https://bridge.base.org/\n');

console.log('🎯 Setup complete! Next steps:');
console.log('1. Edit .env.base with your private key (use a test wallet!)');
console.log('2. Bridge some ETH to Base: https://bridge.base.org/');
console.log('3. Run: node test-simple.js (for simple ETH transfers)');
console.log('4. Run: node test-sequential.js (for sequential transactions)');
console.log('5. Run: node test-tokens.js (for token operations)\n');

console.log('⚠️  SAFETY REMINDERS:');
console.log('   - This is MAINNET - transactions cost real money');
console.log('   - Use a dedicated test wallet with small amounts');
console.log('   - Start with very small test amounts (0.000001 ETH)');
console.log('   - Always double-check addresses before sending\n');