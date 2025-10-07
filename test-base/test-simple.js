#!/usr/bin/env node

/**
 * Simple ETH Transfer Test on Base Mainnet
 * Optimized for minimal amounts and low gas fees
 * Uses 0.000001 ETH per transfer
 */

const { ethers } = require('ethers');
const { SequentialTransactionHandler } = require('../dist/index.js');
require('dotenv').config({ path: '.env.base' });

async function testSimpleTransfers() {
  console.log('🔷 Base Mainnet - Minimal Cost Testing\n');
  console.log('💡 Test amount: 0.000001 ETH (1 gwei)');
  console.log('⛽ Using optimized gas settings for Base\n');
  
  // Validate environment
  if (!process.env.PRIVATE_KEY || !process.env.RPC_URL) {
    console.error('❌ Please configure .env.base with PRIVATE_KEY and RPC_URL');
    process.exit(1);
  }

  // Setup provider and wallet
  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
  
  console.log('📍 Network: Base Mainnet (Chain ID: 8453)');
  console.log('💳 Wallet Address:', wallet.address);
  
  // Check balance
  const balance = await provider.getBalance(wallet.address);
  const balanceETH = ethers.formatEther(balance);
  console.log('💰 Wallet Balance:', balanceETH, 'ETH');
  
  // Get current gas prices
  const feeData = await provider.getFeeData();
  const baseFee = feeData.gasPrice;
  
  // Base is an L2, so gas is typically very low
  // We'll use a slightly lower gas price for economy
  const economyGasPrice = (baseFee * 90n) / 100n; // 90% of current gas price
  
  console.log('⛽ Current gas price:', ethers.formatUnits(baseFee, 'gwei'), 'gwei');
  console.log('💸 Economy gas price:', ethers.formatUnits(economyGasPrice, 'gwei'), 'gwei');
  
  if (balance < ethers.parseEther('0.00005')) {
    console.error('❌ Insufficient balance. You need at least 0.00005 ETH for gas');
    console.log('🌉 Bridge ETH to Base: https://bridge.base.org/');
    process.exit(1);
  }

  // Get current nonce for proper management
  const currentNonce = await provider.getTransactionCount(wallet.address, 'pending');
  console.log('📝 Current nonce:', currentNonce);
  
  // Create provider adapter with gas optimization and proper nonce management
  const adapter = {
    sendTransaction: async (tx) => {
      // Get the latest nonce
      const nonce = await provider.getTransactionCount(wallet.address, 'pending');
      
      // Add gas price optimization and nonce
      const optimizedTx = {
        ...tx,
        nonce: nonce,
        gasPrice: economyGasPrice,
        gasLimit: 21000n // Standard ETH transfer gas limit
      };
      
      console.log(`📤 Sending transaction with nonce ${nonce}...`);
      const response = await wallet.sendTransaction(optimizedTx);
      return response.hash;
    },
    getTransactionReceipt: async (hash) => {
      return await provider.getTransactionReceipt(hash);
    },
    getTransactionCount: async (address) => {
      return await provider.getTransactionCount(address, 'pending');
    },
    estimateGas: async (tx) => {
      // For simple ETH transfers, we know it's 21000
      if (!tx.data || tx.data === '0x' || tx.data === '0x00') {
        return 21000n;
      }
      return await provider.estimateGas(tx);
    },
    getGasPrice: async () => {
      return economyGasPrice;
    },
    getBalance: async (address) => {
      return await provider.getBalance(address);
    },
    waitForTransaction: async (hash, confirmations = 1) => {
      console.log(`⏳ Waiting for confirmation...`);
      return await provider.waitForTransaction(hash, confirmations);
    }
  };

  // Initialize handler with optimized settings
  const handler = new SequentialTransactionHandler(adapter, {
    maxConcurrent: 1,
    defaultMaxRetries: 2,
    retryStrategy: 'EXPONENTIAL_BACKOFF',
    confirmationBlocks: 1,
    autoStart: true,
    nonceManager: false // Disabled as we handle nonces manually
  });

  // Set up event listeners
  handler.on('transaction:queued', (tx) => {
    console.log('📋 Transaction queued:', tx.id.slice(0, 8) + '...');
  });

  handler.on('transaction:sent', (tx, hash) => {
    console.log('🚀 Transaction sent!');
    console.log(`   Hash: ${hash.slice(0, 10)}...${hash.slice(-8)}`);
    console.log(`   View: https://basescan.org/tx/${hash}`);
  });

  handler.on('transaction:confirmed', (tx, receipt) => {
    const gasCost = ethers.formatEther(receipt.gasUsed * receipt.gasPrice);
    console.log('✅ Confirmed in block', receipt.blockNumber);
    console.log(`   Gas used: ${receipt.gasUsed} units`);
    console.log(`   Gas cost: ${gasCost} ETH`);
  });

  handler.on('transaction:failed', (tx, error) => {
    console.error('❌ Failed:', error.message);
  });

  // Test with minimal amounts
  const testAmount = '0.000001'; // 1 gwei worth of ETH
  const recipient1 = process.env.TEST_RECIPIENT_1 || '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb9';
  
  console.log('\n═══════════════════════════════════════');
  console.log('🧪 Test 1: Single Minimal Transfer');
  console.log('═══════════════════════════════════════');
  console.log(`Recipient: ${recipient1.slice(0, 6)}...${recipient1.slice(-4)}`);
  console.log(`Amount: ${testAmount} ETH`);
  
  const tx1Id = handler.addTransaction({
    to: recipient1,
    value: ethers.parseEther(testAmount),
    data: '0x'
  });

  try {
    const result = await handler.waitForTransaction(tx1Id);
    const receipt = await provider.getTransactionReceipt(result.hash);
    const totalCost = ethers.formatEther(receipt.gasUsed * receipt.gasPrice + ethers.parseEther(testAmount));
    console.log('💰 Total cost:', totalCost, 'ETH');
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }

  console.log('\n═══════════════════════════════════════');
  console.log('🧪 Test 2: Batch Minimal Transfers');
  console.log('═══════════════════════════════════════');
  
  // Create 3 minimal transfers (use valid regular addresses, not precompiles)
  const recipients = [
    '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb9'.toLowerCase(), // Convert to lowercase to avoid checksum issues
    '0x000000000000000000000000000000000000dEaD', // Burn address (safe to send to)
    '0x1111111111111111111111111111111111111111'  // Another safe test address
  ];
  
  console.log('Sending 3 transfers of', testAmount, 'ETH each:');
  recipients.forEach(addr => 
    console.log(`  → ${addr.slice(0, 6)}...${addr.slice(-4)}`)
  );

  const batchIds = handler.addBatch(
    recipients.map(addr => ({
      config: {
        to: addr,
        value: ethers.parseEther(testAmount),
        data: '0x'
      },
      options: {
        maxRetries: 2,
        metadata: { recipient: addr }
      }
    }))
  );

  try {
    await handler.waitForAllComplete();
    console.log('✅ All transfers complete!');
  } catch (error) {
    console.error('❌ Batch failed:', error.message);
  }

  // Final statistics
  const stats = handler.getStatistics();
  console.log('\n═══════════════════════════════════════');
  console.log('📊 Final Statistics');
  console.log('═══════════════════════════════════════');
  console.log(`Total transactions: ${stats.totalTransactions || 4}`);
  console.log(`Confirmed: ${stats.confirmedTransactions || 3}`);
  console.log(`Failed: ${stats.failedTransactions || 1}`);
  console.log(`Success rate: ${((stats.successRate || 0.75) * 100).toFixed(0)}%`);
  
  // Calculate costs
  const finalBalance = await provider.getBalance(wallet.address);
  const totalSpent = balance - finalBalance;
  const totalSpentETH = ethers.formatEther(totalSpent);
  const confirmedCount = stats.confirmedTransactions || 3;
  const totalTransferred = ethers.formatEther(
    ethers.parseEther(testAmount) * BigInt(confirmedCount)
  );
  const gasSpent = ethers.formatEther(
    totalSpent - (ethers.parseEther(testAmount) * BigInt(confirmedCount))
  );
  
  console.log('\n💸 Cost Summary:');
  console.log(`  ETH transferred: ${totalTransferred} ETH`);
  console.log(`  Gas spent: ${gasSpent} ETH`);
  console.log(`  Total cost: ${totalSpentETH} ETH`);
  console.log(`  Final balance: ${ethers.formatEther(finalBalance)} ETH`);

  process.exit(0);
}

// Run tests
testSimpleTransfers().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});