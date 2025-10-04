# WalletConnect Sequential Transaction Handler

A powerful TypeScript library for managing sequential blockchain transactions with WalletConnect/Reown integration. Perfect for dApps that need to execute complex, dependent transactions with automatic retry logic and comprehensive error handling.

## 🌟 Features

- **Sequential Execution**: Execute transactions in order with dependency management
- **Automatic Retry Logic**: Exponential backoff, linear, or fixed delay retry strategies
- **Transaction Queue**: Priority-based queue with dependency resolution
- **WalletConnect/Reown Integration**: Native support for Reown AppKit
- **Event-Driven Architecture**: React to transaction lifecycle events
- **Nonce Management**: Automatic nonce tracking and conflict resolution
- **Gas Optimization**: Smart gas estimation with configurable buffers
- **Batch Operations**: Execute multiple transactions atomically
- **TypeScript First**: Full type safety and IntelliSense support

## 📦 Installation

```bash
npm install @walletconnect/sequential-tx-handler
```

or

```bash
yarn add @walletconnect/sequential-tx-handler
```

## 🚀 Quick Start

### Basic Usage

```typescript
import { SequentialTransactionHandler } from '@walletconnect/sequential-tx-handler';
import { createWalletClient, custom } from 'viem';

// Initialize with your wallet provider
const handler = new SequentialTransactionHandler(walletProvider, {
  maxConcurrent: 1,           // Number of concurrent transactions
  defaultMaxRetries: 3,        // Maximum retry attempts
  retryStrategy: 'EXPONENTIAL_BACKOFF',
  confirmationBlocks: 1,       // Blocks to wait for confirmation
  autoStart: true              // Start processing automatically
});

// Add a simple transaction
const txId = handler.addTransaction({
  to: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb9',
  value: BigInt('1000000000000000000'), // 1 ETH
  data: '0x'
});

// Wait for confirmation
const result = await handler.waitForTransaction(txId);
console.log('Transaction confirmed:', result.hash);
```

### Sequential Transactions with Dependencies

```typescript
// Add a sequence of dependent transactions
const ids = handler.addSequence([
  {
    to: contractAddress,
    data: encodeStartSequence(),
  },
  {
    to: contractAddress,
    data: encodeStep2(100),
  },
  {
    to: contractAddress,
    data: encodeStep3(),
    value: BigInt('1000000000000000'), // 0.001 ETH
  },
  {
    to: contractAddress,
    data: encodeCompleteSequence(),
  }
]);

// All transactions will execute in order
await handler.waitForAllComplete();
```

### Event Handling

```typescript
// Listen to transaction events
handler.on('transaction:sent', (tx, hash) => {
  console.log(`Transaction ${tx.id} sent with hash ${hash}`);
});

handler.on('transaction:confirmed', (tx, receipt) => {
  console.log(`Transaction ${tx.id} confirmed in block ${receipt.blockNumber}`);
});

handler.on('transaction:failed', (tx, error) => {
  console.error(`Transaction ${tx.id} failed:`, error.message);
});

handler.on('transaction:retry', (tx, attemptNumber) => {
  console.log(`Retrying transaction ${tx.id}, attempt ${attemptNumber}`);
});
```

### With Reown AppKit

```typescript
import { createAppKit } from '@reown/appkit/react';
import { WagmiAdapter } from '@reown/appkit-adapter-wagmi';
import { WalletConnectProvider } from '@walletconnect/sequential-tx-handler';

// Create Reown AppKit instance
const appKit = createAppKit({
  adapters: [wagmiAdapter],
  networks: [mainnet, base],
  projectId: 'YOUR_PROJECT_ID'
});

// Get the provider from wagmi
const { data: walletClient } = useWalletClient();

// Create WalletConnect provider wrapper
const provider = new WalletConnectProvider(
  walletClient,
  account.address,
  chainId
);

// Initialize handler with WalletConnect provider
const handler = new SequentialTransactionHandler(provider);
```

## 📖 API Reference

### SequentialTransactionHandler

The main class for managing sequential transactions.

#### Constructor Options

```typescript
interface TransactionQueueOptions {
  maxConcurrent?: number;        // Max concurrent transactions (default: 1)
  defaultMaxRetries?: number;     // Default retry attempts (default: 3)
  retryStrategy?: RetryStrategy;  // 'EXPONENTIAL_BACKOFF' | 'LINEAR' | 'FIXED_DELAY' | 'NONE'
  retryDelay?: number;           // Base retry delay in ms (default: 1000)
  maxRetryDelay?: number;        // Maximum retry delay in ms (default: 30000)
  confirmationBlocks?: number;   // Blocks to wait for confirmation (default: 1)
  autoStart?: boolean;           // Start processing automatically (default: true)
  nonceManager?: boolean;        // Enable nonce management (default: true)
}
```

#### Methods

##### Transaction Management

- `addTransaction(config, options)` - Add a single transaction to the queue
- `addBatch(transactions)` - Add multiple independent transactions
- `addSequence(transactions, options)` - Add dependent transactions that execute in order
- `cancelTransaction(id)` - Cancel a pending transaction
- `retryTransaction(id)` - Retry a failed transaction
- `removeTransaction(id)` - Remove a transaction from the queue

##### Queue Control

- `start()` - Start processing the queue
- `stop()` - Pause queue processing
- `clear()` - Clear all pending transactions

##### Monitoring

- `getTransaction(id)` - Get a specific transaction
- `getQueuedTransactions()` - Get all pending transactions
- `getExecutingTransactions()` - Get currently executing transactions
- `getCompletedTransactions()` - Get completed transactions
- `getStatistics()` - Get queue statistics
- `getDependencyTree()` - Get transaction dependency tree

##### Events

- `on(event, handler)` - Subscribe to events
- `off(event, handler)` - Unsubscribe from events
- `once(event, handler)` - Subscribe to a single event
- `waitForTransaction(id, timeout)` - Wait for a specific transaction
- `waitForAllComplete(timeout)` - Wait for all transactions to complete

### Transaction Events

```typescript
interface TransactionEvents {
  'transaction:queued': (transaction: QueuedTransaction) => void;
  'transaction:started': (transaction: QueuedTransaction) => void;
  'transaction:sent': (transaction: QueuedTransaction, hash: Hash) => void;
  'transaction:confirmed': (transaction: QueuedTransaction, receipt: TransactionReceipt) => void;
  'transaction:failed': (transaction: QueuedTransaction, error: Error) => void;
  'transaction:retry': (transaction: QueuedTransaction, attemptNumber: number) => void;
  'transaction:cancelled': (transaction: QueuedTransaction) => void;
  'queue:empty': () => void;
  'queue:paused': () => void;
  'queue:resumed': () => void;
}
```

## 🔧 Advanced Usage

### Custom Retry Logic

```typescript
const handler = new SequentialTransactionHandler(provider, {
  retryStrategy: 'EXPONENTIAL_BACKOFF',
  retryDelay: 1000,      // Start with 1 second
  maxRetryDelay: 30000,  // Max 30 seconds
  defaultMaxRetries: 5    // Try up to 5 times
});
```

### Priority-Based Execution

```typescript
// High priority transaction (executed first)
handler.addTransaction(config1, { priority: 10 });

// Normal priority
handler.addTransaction(config2, { priority: 5 });

// Low priority (executed last)
handler.addTransaction(config3, { priority: 1 });
```

### Complex Dependencies

```typescript
// Create a dependency graph
const txA = handler.addTransaction(configA);
const txB = handler.addTransaction(configB);
const txC = handler.addTransaction(configC, { 
  dependencies: [txA, txB]  // C depends on both A and B
});
const txD = handler.addTransaction(configD, { 
  dependencies: [txC]        // D depends on C
});
```

### Batch Atomic Transactions

```typescript
// All succeed or all fail
const batchIds = handler.addBatch([
  { config: txConfig1, options: { metadata: { type: 'approve' } } },
  { config: txConfig2, options: { metadata: { type: 'swap' } } },
  { config: txConfig3, options: { metadata: { type: 'transfer' } } }
]);
```

## 🧪 Testing

The library includes comprehensive test coverage:

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Watch mode
npm run test:watch
```

## 🛠️ Smart Contract Examples

The repository includes example smart contracts demonstrating sequential operations:

1. **TestSequentialOperations.sol** - Contract with interdependent functions
2. **BatchTransactionHelper.sol** - Multicall pattern implementation

Deploy and test locally:

```bash
npx hardhat compile
npx hardhat test
```

## 🤝 Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Submit a pull request

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.

## 🔗 Links

- [WalletConnect Documentation](https://docs.walletconnect.com)
- [Reown AppKit Documentation](https://docs.reown.com)
- [GitHub Repository](https://github.com/yourusername/walletconnect-sequential-tx)
- [NPM Package](https://www.npmjs.com/package/@walletconnect/sequential-tx-handler)

## 💡 Use Cases

Perfect for:
- DeFi protocols with complex transaction flows
- NFT marketplaces with multi-step operations
- Gaming dApps with sequential state updates
- DAOs with proposal and voting sequences
- Cross-chain bridges with ordered operations
- Any dApp requiring reliable transaction ordering

## 🐛 Troubleshooting

### Common Issues

**Nonce too low errors**: Enable automatic nonce management:
```typescript
new SequentialTransactionHandler(provider, { nonceManager: true });
```

**Gas estimation failures**: Add buffer to gas estimates:
```typescript
// Handled automatically, but can be customized in provider
```

**Transaction stuck**: Check and retry:
```typescript
const tx = handler.getTransaction(id);
if (tx?.status === 'FAILED') {
  await handler.retryTransaction(id);
}
```

## 📊 Performance

- Handles 1000+ queued transactions efficiently
- Minimal memory footprint with Map-based storage
- O(1) transaction lookups
- O(log n) priority queue operations
- Automatic cleanup of completed transactions

## 🙏 Acknowledgments

Built for the WalletConnect/Reown ecosystem to solve real developer pain points around transaction management.

Special thanks to the WalletConnect team for creating an amazing wallet connection protocol.