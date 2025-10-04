// Example usage of the WalletConnect Sequential Transaction Handler
const { SequentialTransactionHandler, RetryStrategy } = require('./dist/index');

// Example: Using with a mock provider
async function example() {
  // Mock provider for demonstration
  const mockProvider = {
    sendTransaction: async (tx) => {
      console.log('Sending transaction:', tx.to);
      // Simulate transaction hash
      return `0x${Math.random().toString(16).substr(2, 64)}`;
    },
    getTransactionReceipt: async (hash) => {
      console.log('Getting receipt for:', hash);
      // Simulate receipt
      return {
        hash,
        blockNumber: 123456,
        status: 1,
        gasUsed: BigInt(21000),
      };
    },
    getTransactionCount: async () => 10,
    estimateGas: async () => BigInt(21000),
    getGasPrice: async () => BigInt(20000000000),
    getBalance: async () => BigInt(1000000000000000000),
    waitForTransaction: async (hash) => {
      console.log('Waiting for:', hash);
      return {
        hash,
        blockNumber: 123456,
        status: 1,
      };
    },
  };

  // Create handler instance
  const handler = new SequentialTransactionHandler(mockProvider, {
    maxConcurrent: 1,
    defaultMaxRetries: 3,
    retryStrategy: RetryStrategy.EXPONENTIAL_BACKOFF,
    confirmationBlocks: 1,
    autoStart: false, // We'll start manually for demo
    nonceManager: true,
  });

  // Listen to events
  handler.on('transaction:queued', (tx) => {
    console.log(`✅ Transaction queued: ${tx.id}`);
  });

  handler.on('transaction:sent', (tx, hash) => {
    console.log(`📤 Transaction sent: ${tx.id} with hash: ${hash}`);
  });

  handler.on('transaction:confirmed', (tx, receipt) => {
    console.log(`✅ Transaction confirmed: ${tx.id} in block ${receipt.blockNumber}`);
  });

  handler.on('transaction:failed', (tx, error) => {
    console.error(`❌ Transaction failed: ${tx.id}`, error.message);
  });

  // Example 1: Simple transaction
  console.log('\n--- Example 1: Simple Transaction ---');
  const txId1 = handler.addTransaction({
    to: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb9',
    value: BigInt('1000000000000000'), // 0.001 ETH
    data: '0x',
  });
  console.log(`Added transaction: ${txId1}`);

  // Example 2: Sequential transactions with dependencies
  console.log('\n--- Example 2: Sequential Transactions ---');
  const sequenceIds = handler.addSequence([
    {
      to: '0x1111111111111111111111111111111111111111',
      data: '0xabcd', // Start sequence
    },
    {
      to: '0x2222222222222222222222222222222222222222',
      data: '0xef01', // Step 2
    },
    {
      to: '0x3333333333333333333333333333333333333333',
      value: BigInt('1000000000000000'),
      data: '0x2345', // Step 3 with ETH
    },
    {
      to: '0x4444444444444444444444444444444444444444',
      data: '0x6789', // Complete sequence
    },
  ]);
  console.log(`Added sequence with IDs: ${sequenceIds.join(', ')}`);

  // Example 3: Batch transactions with priority
  console.log('\n--- Example 3: Batch with Priority ---');
  handler.addTransaction(
    { to: '0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' },
    { priority: 1, metadata: { type: 'low-priority' } }
  );
  
  handler.addTransaction(
    { to: '0xBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB' },
    { priority: 10, metadata: { type: 'high-priority' } }
  );

  // Get statistics
  const stats = handler.getStatistics();
  console.log('\n--- Queue Statistics ---');
  console.log(`Total queued: ${stats.totalQueued}`);
  console.log(`Total executing: ${stats.totalExecuting}`);
  console.log(`Total confirmed: ${stats.totalConfirmed}`);

  // Get dependency tree
  const tree = handler.getDependencyTree();
  console.log('\n--- Dependency Tree ---');
  tree.forEach((deps, id) => {
    if (deps.length > 0) {
      console.log(`${id} depends on: ${deps.join(', ')}`);
    }
  });

  // Start processing
  console.log('\n--- Starting Queue Processing ---');
  handler.start();

  // Wait for all transactions to complete
  setTimeout(async () => {
    try {
      await handler.waitForAllComplete(10000);
      console.log('\n✅ All transactions completed!');
      
      const finalStats = handler.getStatistics();
      console.log(`Success rate: ${(finalStats.successRate * 100).toFixed(2)}%`);
    } catch (error) {
      console.error('Timeout waiting for completion:', error.message);
    }
    
    // Stop the handler
    handler.stop();
    process.exit(0);
  }, 1000);
}

// Run the example
example().catch(console.error);