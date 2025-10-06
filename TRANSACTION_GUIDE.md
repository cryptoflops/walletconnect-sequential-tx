# 📘 Complete Guide: Making On-Chain Transactions

This guide shows you how to make real blockchain transactions using the Sequential Transaction Handler.

## 🚀 Quick Start

### Installation

```bash
npm install @cryptoflops/walletconnect-sequential-tx ethers
```

## 💡 Usage Examples

### 1️⃣ Basic Setup with Private Key

```javascript
const { ethers } = require('ethers');
const { SequentialTransactionHandler } = require('@cryptoflops/walletconnect-sequential-tx');

// Setup provider (use your RPC URL)
const provider = new ethers.JsonRpcProvider('https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY');

// Setup wallet (NEVER hardcode private keys in production!)
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

// Create adapter
const adapter = {
  sendTransaction: async (tx) => {
    const response = await wallet.sendTransaction(tx);
    return response.hash;
  },
  getTransactionReceipt: async (hash) => {
    return await provider.getTransactionReceipt(hash);
  },
  getTransactionCount: async (address) => {
    return await provider.getTransactionCount(address, 'pending');
  },
  estimateGas: async (tx) => {
    return await provider.estimateGas(tx);
  },
  getGasPrice: async () => {
    return (await provider.getFeeData()).gasPrice;
  },
  getBalance: async (address) => {
    return await provider.getBalance(address);
  },
  waitForTransaction: async (hash, confirmations = 1) => {
    return await provider.waitForTransaction(hash, confirmations);
  }
};

// Initialize handler
const handler = new SequentialTransactionHandler(adapter, {
  maxConcurrent: 1,
  defaultMaxRetries: 3,
  retryStrategy: 'EXPONENTIAL_BACKOFF',
  confirmationBlocks: 1,
  autoStart: true,
  nonceManager: true
});
```

### 2️⃣ Making Transactions

#### Simple ETH Transfer

```javascript
// Send 0.1 ETH to an address
const txId = handler.addTransaction({
  to: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb9',
  value: ethers.parseEther('0.1'),
  data: '0x'
});

// Wait for confirmation
const result = await handler.waitForTransaction(txId);
console.log('Transaction confirmed:', result.hash);
```

#### ERC-20 Token Transfer

```javascript
// ERC-20 transfer interface
const erc20Interface = new ethers.Interface([
  'function transfer(address to, uint256 amount) returns (bool)'
]);

// USDC on Ethereum
const USDC_ADDRESS = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';

const txId = handler.addTransaction({
  to: USDC_ADDRESS,
  data: erc20Interface.encodeFunctionData('transfer', [
    '0xRecipientAddress', 
    ethers.parseUnits('100', 6) // 100 USDC (6 decimals)
  ])
});
```

#### Sequential DeFi Operations

```javascript
// Example: Approve and Swap on Uniswap
const erc20Interface = new ethers.Interface([
  'function approve(address spender, uint256 amount)'
]);

const WETH = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';
const UNISWAP_ROUTER = '0xE592427A0AEce92De3Edee1F18E0157C05861564';

// Sequential transactions with dependencies
const ids = handler.addSequence([
  {
    // 1. Approve WETH spending
    to: WETH,
    data: erc20Interface.encodeFunctionData('approve', [
      UNISWAP_ROUTER,
      ethers.parseEther('1.0')
    ])
  },
  {
    // 2. Swap WETH for USDC (will execute after approval)
    to: UNISWAP_ROUTER,
    data: '0x...', // Uniswap swap calldata
    value: ethers.parseEther('1.0')
  }
]);

await handler.waitForAllComplete();
```

### 3️⃣ WalletConnect Integration (React)

```tsx
import { useWalletClient, usePublicClient } from 'wagmi';
import { SequentialTransactionHandler } from '@cryptoflops/walletconnect-sequential-tx';

function MyDApp() {
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();

  const handleTransactions = async () => {
    // Create adapter for WalletConnect
    const adapter = {
      sendTransaction: async (tx) => {
        return await walletClient.sendTransaction(tx);
      },
      getTransactionReceipt: async (hash) => {
        return await publicClient.getTransactionReceipt({ hash });
      },
      // ... other methods
    };

    const handler = new SequentialTransactionHandler(adapter);
    
    // Add your transactions
    const txId = handler.addTransaction({
      to: '0x...',
      value: parseEther('0.1')
    });

    await handler.waitForTransaction(txId);
  };
}
```

### 4️⃣ Advanced Patterns

#### Batch Transfers with Different Amounts

```javascript
const recipients = [
  { address: '0xAlice...', amount: '0.1' },
  { address: '0xBob...', amount: '0.2' },
  { address: '0xCarol...', amount: '0.15' }
];

const transactions = recipients.map(r => ({
  config: {
    to: r.address,
    value: ethers.parseEther(r.amount)
  },
  options: {
    maxRetries: 3,
    metadata: { recipient: r.address, amount: r.amount }
  }
}));

const ids = handler.addBatch(transactions);
await handler.waitForAllComplete();
```

#### NFT Minting Sequence

```javascript
const nftInterface = new ethers.Interface([
  'function mint(address to, uint256 tokenId)',
  'function setTokenURI(uint256 tokenId, string uri)'
]);

const NFT_CONTRACT = '0x...';

// Mint and then set metadata
const mintId = handler.addTransaction({
  to: NFT_CONTRACT,
  data: nftInterface.encodeFunctionData('mint', [
    wallet.address,
    1
  ])
});

const setUriId = handler.addTransaction({
  to: NFT_CONTRACT,
  data: nftInterface.encodeFunctionData('setTokenURI', [
    1,
    'ipfs://QmHash...'
  ])
}, { dependencies: [mintId] }); // Must mint before setting URI

await handler.waitForAllComplete();
```

#### Multi-Step Staking Process

```javascript
// Common DeFi pattern: Approve → Deposit → Stake → Claim
const defiInterface = new ethers.Interface([
  'function approve(address spender, uint256 amount)',
  'function deposit(uint256 amount)',
  'function stake(uint256 amount)',
  'function claimRewards()'
]);

const TOKEN = '0x...';
const STAKING_CONTRACT = '0x...';
const amount = ethers.parseEther('100');

const ids = handler.addSequence([
  {
    // Step 1: Approve token
    to: TOKEN,
    data: defiInterface.encodeFunctionData('approve', [
      STAKING_CONTRACT,
      amount
    ])
  },
  {
    // Step 2: Deposit tokens
    to: STAKING_CONTRACT,
    data: defiInterface.encodeFunctionData('deposit', [amount])
  },
  {
    // Step 3: Stake deposited tokens
    to: STAKING_CONTRACT,
    data: defiInterface.encodeFunctionData('stake', [amount])
  },
  {
    // Step 4: Claim initial rewards
    to: STAKING_CONTRACT,
    data: defiInterface.encodeFunctionData('claimRewards')
  }
]);

// Monitor progress
handler.on('transaction:confirmed', (tx) => {
  console.log('Step completed:', tx.metadata);
});

await handler.waitForAllComplete();
```

## 🔐 Security Best Practices

### Environment Variables

```bash
# .env file (NEVER commit this!)
PRIVATE_KEY=your_private_key_here
RPC_URL=https://eth-mainnet.g.alchemy.com/v2/your_key
```

```javascript
require('dotenv').config();

const wallet = new ethers.Wallet(
  process.env.PRIVATE_KEY,
  new ethers.JsonRpcProvider(process.env.RPC_URL)
);
```

### Gas Management

```javascript
// Always estimate gas with buffer
const gasEstimate = await provider.estimateGas(transaction);
const gasLimit = gasEstimate * 120n / 100n; // 20% buffer

handler.addTransaction({
  to: '0x...',
  value: ethers.parseEther('0.1'),
  gasLimit: gasLimit
});
```

### Error Handling

```javascript
handler.on('transaction:failed', (tx, error) => {
  console.error('Transaction failed:', error);
  // Implement your error recovery logic
});

handler.on('transaction:retry', (tx, attempt) => {
  console.log(`Retrying transaction: attempt ${attempt}`);
});
```

## 🌐 Network Configuration

### Mainnet Networks

```javascript
const NETWORKS = {
  ethereum: {
    rpc: 'https://eth-mainnet.g.alchemy.com/v2/KEY',
    chainId: 1
  },
  polygon: {
    rpc: 'https://polygon-rpc.com',
    chainId: 137
  },
  arbitrum: {
    rpc: 'https://arb1.arbitrum.io/rpc',
    chainId: 42161
  },
  optimism: {
    rpc: 'https://mainnet.optimism.io',
    chainId: 10
  },
  base: {
    rpc: 'https://mainnet.base.org',
    chainId: 8453
  }
};
```

### Testnet Networks

```javascript
const TESTNETS = {
  sepolia: {
    rpc: 'https://sepolia.infura.io/v3/KEY',
    chainId: 11155111,
    faucet: 'https://sepoliafaucet.com'
  },
  goerli: {
    rpc: 'https://goerli.infura.io/v3/KEY',
    chainId: 5,
    faucet: 'https://goerlifaucet.com'
  },
  mumbai: {
    rpc: 'https://rpc-mumbai.maticvigil.com',
    chainId: 80001,
    faucet: 'https://faucet.polygon.technology/'
  }
};
```

## 📊 Monitoring & Analytics

```javascript
// Track transaction metrics
let metrics = {
  total: 0,
  confirmed: 0,
  failed: 0,
  totalGasUsed: 0n,
  startTime: Date.now()
};

handler.on('transaction:queued', () => {
  metrics.total++;
});

handler.on('transaction:confirmed', (tx, receipt) => {
  metrics.confirmed++;
  metrics.totalGasUsed += receipt.gasUsed;
});

handler.on('transaction:failed', () => {
  metrics.failed++;
});

// Get statistics
const stats = handler.getStatistics();
console.log('Success rate:', (stats.successRate * 100).toFixed(2) + '%');
console.log('Average confirmation time:', stats.averageConfirmationTime + 'ms');
```

## 🛠️ Troubleshooting

### Common Issues

| Issue | Solution |
|-------|----------|
| "Nonce too low" | Enable nonce management: `nonceManager: true` |
| "Insufficient funds" | Check wallet balance before sending |
| "Gas estimation failed" | Provide manual gas limit |
| "Transaction underpriced" | Increase gas price or use EIP-1559 |
| "Timeout waiting" | Increase timeout or check network status |

### Debug Mode

```javascript
const handler = new SequentialTransactionHandler(adapter, {
  debug: true // Enable debug logging
});
```

## 📚 Resources

- [Ethers.js Documentation](https://docs.ethers.org/v6/)
- [WalletConnect Docs](https://docs.walletconnect.com/)
- [Reown AppKit Docs](https://docs.reown.com/)
- [Viem Documentation](https://viem.sh/)

## 💬 Support

- GitHub Issues: [Report bugs](https://github.com/cryptoflops/walletconnect-sequential-tx/issues)
- NPM Package: [@cryptoflops/walletconnect-sequential-tx](https://www.npmjs.com/package/@cryptoflops/walletconnect-sequential-tx)

---

**Remember**: Always test on testnets first before deploying to mainnet!