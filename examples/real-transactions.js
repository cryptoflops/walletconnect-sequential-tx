/**
 * Real On-Chain Transaction Example
 * This example shows how to use the Sequential Transaction Handler
 * to make actual blockchain transactions
 */

// For Node.js environment
const { ethers } = require('ethers');
const { SequentialTransactionHandler } = require('@cryptoflops/walletconnect-sequential-tx');

// ============================================
// CONFIGURATION - Update these values
// ============================================
const CONFIG = {
  // Your private key (NEVER commit this to git!)
  // For testing, use a test wallet with small amounts
  PRIVATE_KEY: process.env.PRIVATE_KEY, // Always use environment variables, never hardcode
  
  // RPC URLs (you can get free ones from Infura, Alchemy, etc.)
  RPC_URLS: {
    ethereum: 'https://mainnet.infura.io/v3/YOUR_PROJECT_ID',
    polygon: 'https://polygon-rpc.com',
    base: 'https://mainnet.base.org',
    arbitrum: 'https://arb1.arbitrum.io/rpc',
    optimism: 'https://mainnet.optimism.io',
    // For testing, use testnets:
    sepolia: 'https://sepolia.infura.io/v3/YOUR_PROJECT_ID',
    goerli: 'https://goerli.infura.io/v3/YOUR_PROJECT_ID'
  },
  
  // Choose your network
  NETWORK: 'sepolia' // Change to 'ethereum', 'polygon', etc.
};

// ============================================
// SETUP PROVIDER AND WALLET
// ============================================
async function setupWallet() {
  // Create provider
  const provider = new ethers.JsonRpcProvider(CONFIG.RPC_URLS[CONFIG.NETWORK]);
  
  // Create wallet
  const wallet = new ethers.Wallet(CONFIG.PRIVATE_KEY, provider);
  
  console.log('Wallet Address:', wallet.address);
  
  // Check balance
  const balance = await provider.getBalance(wallet.address);
  console.log('Balance:', ethers.formatEther(balance), 'ETH');
  
  return { provider, wallet };
}

// ============================================
// CREATE PROVIDER ADAPTER
// ============================================
function createProviderAdapter(wallet) {
  return {
    sendTransaction: async (tx) => {
      console.log('Sending transaction:', {
        to: tx.to,
        value: tx.value ? ethers.formatEther(tx.value) + ' ETH' : '0 ETH',
        data: tx.data ? tx.data.slice(0, 10) + '...' : '0x'
      });
      
      // Send the actual transaction
      const txResponse = await wallet.sendTransaction({
        to: tx.to,
        value: tx.value,
        data: tx.data || '0x',
        gasLimit: tx.gasLimit,
        gasPrice: tx.gasPrice,
        nonce: tx.nonce
      });
      
      return txResponse.hash;
    },
    
    getTransactionReceipt: async (hash) => {
      const receipt = await wallet.provider.getTransactionReceipt(hash);
      return receipt;
    },
    
    getTransactionCount: async (address) => {
      return await wallet.provider.getTransactionCount(address, 'pending');
    },
    
    estimateGas: async (tx) => {
      try {
        const estimate = await wallet.provider.estimateGas({
          from: wallet.address,
          to: tx.to,
          value: tx.value,
          data: tx.data
        });
        // Add 20% buffer
        return estimate * 120n / 100n;
      } catch (error) {
        console.log('Gas estimation failed, using default:', error.message);
        return 100000n; // Default gas limit
      }
    },
    
    getGasPrice: async () => {
      const feeData = await wallet.provider.getFeeData();
      return feeData.gasPrice || ethers.parseUnits('20', 'gwei');
    },
    
    getBalance: async (address) => {
      return await wallet.provider.getBalance(address);
    },
    
    waitForTransaction: async (hash, confirmations = 1) => {
      const receipt = await wallet.provider.waitForTransaction(hash, confirmations);
      return receipt;
    }
  };
}

// ============================================
// EXAMPLE 1: Simple ETH Transfer
// ============================================
async function example1_simpleTransfer(handler, recipientAddress) {
  console.log('\n=== Example 1: Simple ETH Transfer ===');
  
  const txId = handler.addTransaction({
    to: recipientAddress,
    value: ethers.parseEther('0.001'), // Send 0.001 ETH
    data: '0x'
  });
  
  console.log('Transaction queued with ID:', txId);
  
  // Wait for confirmation
  const result = await handler.waitForTransaction(txId, 30000); // 30 second timeout
  console.log('Transaction confirmed!');
  console.log('Hash:', result.hash);
  console.log('Block:', result.receipt.blockNumber);
  
  return result;
}

// ============================================
// EXAMPLE 2: Sequential ERC20 Operations
// ============================================
async function example2_erc20Operations(handler, tokenAddress, spenderAddress) {
  console.log('\n=== Example 2: Sequential ERC20 Operations ===');
  
  // ERC20 ABI for approve and transfer
  const erc20Interface = new ethers.Interface([
    'function approve(address spender, uint256 amount)',
    'function transfer(address to, uint256 amount)'
  ]);
  
  // Create sequential transactions
  const ids = handler.addSequence([
    {
      // Transaction 1: Approve spender
      to: tokenAddress,
      data: erc20Interface.encodeFunctionData('approve', [
        spenderAddress,
        ethers.parseUnits('100', 18) // Approve 100 tokens
      ])
    },
    {
      // Transaction 2: Transfer tokens (depends on approval)
      to: tokenAddress,
      data: erc20Interface.encodeFunctionData('transfer', [
        spenderAddress,
        ethers.parseUnits('50', 18) // Transfer 50 tokens
      ])
    }
  ]);
  
  console.log('Queued transactions:', ids);
  
  // Wait for all to complete
  await handler.waitForAllComplete(60000); // 60 second timeout
  console.log('All ERC20 operations completed!');
}

// ============================================
// EXAMPLE 3: DeFi Protocol Interaction
// ============================================
async function example3_defiProtocol(handler, contractAddress) {
  console.log('\n=== Example 3: DeFi Protocol Interaction ===');
  
  // Example: Interacting with a DeFi protocol
  // This could be Uniswap, Aave, Compound, etc.
  
  const defiInterface = new ethers.Interface([
    'function deposit() payable',
    'function stake(uint256 amount)',
    'function claim()'
  ]);
  
  // Add transactions with dependencies
  const depositId = handler.addTransaction({
    to: contractAddress,
    value: ethers.parseEther('0.1'),
    data: defiInterface.encodeFunctionData('deposit')
  }, { metadata: { type: 'deposit' } });
  
  const stakeId = handler.addTransaction({
    to: contractAddress,
    data: defiInterface.encodeFunctionData('stake', [ethers.parseEther('0.1')])
  }, { 
    dependencies: [depositId], // Must deposit before staking
    metadata: { type: 'stake' }
  });
  
  const claimId = handler.addTransaction({
    to: contractAddress,
    data: defiInterface.encodeFunctionData('claim')
  }, { 
    dependencies: [stakeId], // Must stake before claiming
    metadata: { type: 'claim' }
  });
  
  console.log('DeFi operations queued:', { depositId, stakeId, claimId });
  
  // Monitor progress
  handler.on('transaction:confirmed', (tx) => {
    console.log(`✅ ${tx.metadata?.type || 'Transaction'} confirmed:`, tx.hash);
  });
  
  await handler.waitForAllComplete(90000);
  console.log('DeFi protocol interaction completed!');
}

// ============================================
// EXAMPLE 4: Smart Contract Deployment
// ============================================
async function example4_deployContract(handler, wallet) {
  console.log('\n=== Example 4: Deploy Smart Contract ===');
  
  // Simple contract bytecode (a basic storage contract)
  const bytecode = '0x608060405234801561001057600080fd5b50610150806100206000396000f3fe608060405234801561001057600080fd5b50600436106100365760003560e01c80632e64cec11461003b5780636057361d14610059575b600080fd5b610043610075565b60405161005091906100d9565b60405180910390f35b610073600480360381019061006e919061009d565b61007e565b005b60008054905090565b8060008190555050565b60008135905061009781610103565b92915050565b6000602082840312156100b3576100b26100fe565b5b60006100c184828501610088565b91505092915050565b6100d3816100f4565b82525050565b60006020820190506100ee60008301846100ca565b92915050565b6000819050919050565b600080fd5b61010c816100f4565b811461011757600080fd5b5056fea2646970667358221220';
  
  const txId = handler.addTransaction({
    to: null, // Contract deployment
    data: bytecode,
    gasLimit: 500000n
  });
  
  console.log('Deployment transaction queued:', txId);
  
  const result = await handler.waitForTransaction(txId, 60000);
  console.log('Contract deployed at:', result.receipt.contractAddress);
  
  return result.receipt.contractAddress;
}

// ============================================
// EXAMPLE 5: Batch Transactions with Retry
// ============================================
async function example5_batchWithRetry(handler, recipients) {
  console.log('\n=== Example 5: Batch Transfers with Retry ===');
  
  const transactions = recipients.map(recipient => ({
    config: {
      to: recipient.address,
      value: ethers.parseEther(recipient.amount)
    },
    options: {
      maxRetries: 3,
      metadata: { 
        recipient: recipient.name,
        amount: recipient.amount 
      }
    }
  }));
  
  const ids = handler.addBatch(transactions);
  console.log('Batch transactions queued:', ids.length, 'transactions');
  
  // Monitor events
  handler.on('transaction:retry', (tx, attempt) => {
    console.log(`⚠️ Retrying ${tx.metadata?.recipient || 'transaction'}, attempt ${attempt}`);
  });
  
  handler.on('transaction:failed', (tx, error) => {
    console.error(`❌ Failed to send to ${tx.metadata?.recipient}:`, error.message);
  });
  
  await handler.waitForAllComplete(120000);
  
  const stats = handler.getStatistics();
  console.log('Batch complete!');
  console.log(`Success rate: ${(stats.successRate * 100).toFixed(2)}%`);
}

// ============================================
// MAIN FUNCTION - Run Examples
// ============================================
async function main() {
  try {
    console.log('🚀 Sequential Transaction Handler - Real Examples\n');
    
    // Setup wallet
    const { provider, wallet } = await setupWallet();
    
    // Create provider adapter
    const providerAdapter = createProviderAdapter(wallet);
    
    // Initialize handler
    const handler = new SequentialTransactionHandler(providerAdapter, {
      maxConcurrent: 1,
      defaultMaxRetries: 3,
      retryStrategy: 'EXPONENTIAL_BACKOFF',
      confirmationBlocks: 1,
      autoStart: true,
      nonceManager: true,
      debug: true
    });
    
    // Listen to all events
    handler.on('transaction:queued', (tx) => {
      console.log('📋 Queued:', tx.id);
    });
    
    handler.on('transaction:sent', (tx, hash) => {
      console.log('📤 Sent:', tx.id, 'Hash:', hash);
    });
    
    handler.on('transaction:confirmed', (tx, receipt) => {
      console.log('✅ Confirmed:', tx.id, 'Block:', receipt.blockNumber);
    });
    
    handler.on('transaction:failed', (tx, error) => {
      console.error('❌ Failed:', tx.id, error.message);
    });
    
    // ========================================
    // Choose which examples to run
    // ========================================
    
    // Example 1: Simple transfer
    // await example1_simpleTransfer(handler, '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb9');
    
    // Example 2: ERC20 operations (need a token address)
    // await example2_erc20Operations(handler, 'TOKEN_ADDRESS', 'SPENDER_ADDRESS');
    
    // Example 3: DeFi protocol (need a protocol address)
    // await example3_defiProtocol(handler, 'DEFI_CONTRACT_ADDRESS');
    
    // Example 4: Deploy a contract
    // const contractAddress = await example4_deployContract(handler, wallet);
    
    // Example 5: Batch transfers
    // await example5_batchWithRetry(handler, [
    //   { address: '0xAddress1...', amount: '0.001', name: 'Alice' },
    //   { address: '0xAddress2...', amount: '0.002', name: 'Bob' }
    // ]);
    
    console.log('\n✅ All examples completed!');
    
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main().then(() => process.exit(0));
}

module.exports = { setupWallet, createProviderAdapter };