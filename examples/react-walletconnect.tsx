/**
 * React + WalletConnect Example
 * Use this in a Next.js or React application
 */

import React, { useState, useEffect } from 'react';
import { createAppKit } from '@reown/appkit/react';
import { WagmiAdapter } from '@reown/appkit-adapter-wagmi';
import { mainnet, polygon, arbitrum, base, sepolia } from 'viem/chains';
import { useAccount, useWalletClient, usePublicClient } from 'wagmi';
import { SequentialTransactionHandler } from '@cryptoflops/walletconnect-sequential-tx';
import { parseEther, formatEther } from 'viem';

// ============================================
// SETUP WALLETCONNECT / REOWN APPKIT
// ============================================

// 1. Get your project ID from https://cloud.reown.com
const projectId = 'YOUR_PROJECT_ID';

// 2. Create wagmiAdapter
const wagmiAdapter = new WagmiAdapter({
  networks: [mainnet, polygon, arbitrum, base, sepolia],
  projectId
});

// 3. Create modal
const appKit = createAppKit({
  adapters: [wagmiAdapter],
  networks: [mainnet, polygon, arbitrum, base, sepolia],
  projectId,
  metadata: {
    name: 'Sequential Transaction Demo',
    description: 'Demo app for sequential transactions',
    url: 'https://yourapp.com',
    icons: ['https://yourapp.com/icon.png']
  }
});

// ============================================
// PROVIDER ADAPTER FOR WALLETCONNECT
// ============================================

function createWalletConnectAdapter(walletClient: any, publicClient: any) {
  return {
    sendTransaction: async (tx: any) => {
      const hash = await walletClient.sendTransaction({
        to: tx.to,
        value: tx.value,
        data: tx.data,
        gas: tx.gasLimit,
        gasPrice: tx.gasPrice,
        maxFeePerGas: tx.maxFeePerGas,
        maxPriorityFeePerGas: tx.maxPriorityFeePerGas,
        nonce: tx.nonce
      });
      return hash;
    },

    getTransactionReceipt: async (hash: string) => {
      const receipt = await publicClient.getTransactionReceipt({ hash });
      return receipt;
    },

    getTransactionCount: async (address: string) => {
      return await publicClient.getTransactionCount({ 
        address,
        blockTag: 'pending' 
      });
    },

    estimateGas: async (tx: any) => {
      const estimate = await publicClient.estimateGas({
        account: walletClient.account,
        to: tx.to,
        value: tx.value,
        data: tx.data
      });
      return estimate * 120n / 100n; // Add 20% buffer
    },

    getGasPrice: async () => {
      const gasPrice = await publicClient.getGasPrice();
      return gasPrice;
    },

    getBalance: async (address: string) => {
      return await publicClient.getBalance({ address });
    },

    waitForTransaction: async (hash: string, confirmations = 1) => {
      const receipt = await publicClient.waitForTransactionReceipt({
        hash,
        confirmations
      });
      return receipt;
    }
  };
}

// ============================================
// REACT COMPONENT
// ============================================

export default function SequentialTransactionDemo() {
  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();
  
  const [handler, setHandler] = useState<any>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [logs, setLogs] = useState<string[]>([]);

  // Initialize handler when wallet connects
  useEffect(() => {
    if (walletClient && publicClient) {
      const adapter = createWalletConnectAdapter(walletClient, publicClient);
      const txHandler = new SequentialTransactionHandler(adapter, {
        maxConcurrent: 1,
        defaultMaxRetries: 3,
        retryStrategy: 'EXPONENTIAL_BACKOFF',
        confirmationBlocks: 1,
        autoStart: true,
        nonceManager: true
      });

      // Setup event listeners
      txHandler.on('transaction:queued', (tx: any) => {
        addLog(`📋 Queued: ${tx.id}`);
        updateTxStatus(tx.id, 'queued');
      });

      txHandler.on('transaction:sent', (tx: any, hash: string) => {
        addLog(`📤 Sent: ${tx.id} - ${hash}`);
        updateTxStatus(tx.id, 'sent', hash);
      });

      txHandler.on('transaction:confirmed', (tx: any, receipt: any) => {
        addLog(`✅ Confirmed: ${tx.id} in block ${receipt.blockNumber}`);
        updateTxStatus(tx.id, 'confirmed', tx.hash);
      });

      txHandler.on('transaction:failed', (tx: any, error: Error) => {
        addLog(`❌ Failed: ${tx.id} - ${error.message}`);
        updateTxStatus(tx.id, 'failed');
      });

      setHandler(txHandler);
    }
  }, [walletClient, publicClient]);

  const addLog = (message: string) => {
    setLogs(prev => [...prev, `${new Date().toLocaleTimeString()} - ${message}`]);
  };

  const updateTxStatus = (id: string, status: string, hash?: string) => {
    setTransactions(prev => prev.map(tx => 
      tx.id === id ? { ...tx, status, hash } : tx
    ));
  };

  // ============================================
  // TRANSACTION EXAMPLES
  // ============================================

  // 1. Simple ETH Transfer
  const sendSimpleTransfer = async () => {
    if (!handler) return;
    
    setIsProcessing(true);
    try {
      const recipient = prompt('Enter recipient address:');
      if (!recipient) return;

      const txId = handler.addTransaction({
        to: recipient,
        value: parseEther('0.001'),
        data: '0x'
      });

      setTransactions(prev => [...prev, { 
        id: txId, 
        type: 'ETH Transfer',
        status: 'pending',
        amount: '0.001 ETH'
      }]);

      const result = await handler.waitForTransaction(txId, 30000);
      addLog(`Transfer complete! Hash: ${result.hash}`);
    } catch (error: any) {
      addLog(`Error: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // 2. Sequential Transactions
  const sendSequentialTransactions = async () => {
    if (!handler) return;

    setIsProcessing(true);
    try {
      const recipient = prompt('Enter recipient address:');
      if (!recipient) return;

      const ids = handler.addSequence([
        {
          to: recipient,
          value: parseEther('0.0001'),
          data: '0x'
        },
        {
          to: recipient,
          value: parseEther('0.0002'),
          data: '0x'
        },
        {
          to: recipient,
          value: parseEther('0.0003'),
          data: '0x'
        }
      ]);

      ids.forEach((id, index) => {
        setTransactions(prev => [...prev, {
          id,
          type: `Sequential TX ${index + 1}`,
          status: 'pending',
          amount: `${(index + 1) * 0.0001} ETH`
        }]);
      });

      await handler.waitForAllComplete(60000);
      addLog('All sequential transactions completed!');
    } catch (error: any) {
      addLog(`Error: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // 3. Batch Transactions
  const sendBatchTransactions = async () => {
    if (!handler) return;

    setIsProcessing(true);
    try {
      const recipients = [
        { address: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb9', amount: '0.0001' },
        { address: '0x5aAeb6053f3E94C9b9A09f33669435E7Ef1BeAed', amount: '0.0002' }
      ];

      const transactions = recipients.map(r => ({
        config: {
          to: r.address,
          value: parseEther(r.amount),
          data: '0x'
        },
        options: {
          maxRetries: 3,
          metadata: { recipient: r.address.slice(0, 6) + '...', amount: r.amount }
        }
      }));

      const ids = handler.addBatch(transactions);
      
      ids.forEach((id, index) => {
        setTransactions(prev => [...prev, {
          id,
          type: `Batch TX ${index + 1}`,
          status: 'pending',
          amount: recipients[index].amount + ' ETH'
        }]);
      });

      await handler.waitForAllComplete(90000);
      addLog('Batch transactions completed!');
    } catch (error: any) {
      addLog(`Error: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // 4. DeFi Example - Uniswap Swap
  const performUniswapSwap = async () => {
    if (!handler) return;

    setIsProcessing(true);
    try {
      // Uniswap V3 Router address (Ethereum mainnet)
      const UNISWAP_ROUTER = '0xE592427A0AEce92De3Edee1F18E0157C05861564';
      
      // This is a simplified example - you'd need to properly encode the swap data
      const swapInterface = new ethers.Interface([
        'function exactInputSingle(tuple(address,address,uint24,address,uint256,uint256,uint256,uint160)) payable returns (uint256)'
      ]);

      // Add approval transaction first
      const approveId = handler.addTransaction({
        to: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', // USDC
        data: '0x095ea7b3...', // Approve data
      });

      // Then add swap transaction that depends on approval
      const swapId = handler.addTransaction({
        to: UNISWAP_ROUTER,
        value: parseEther('0.1'),
        data: swapInterface.encodeFunctionData('exactInputSingle', [
          // Swap parameters...
        ])
      }, { dependencies: [approveId] });

      setTransactions(prev => [...prev, 
        { id: approveId, type: 'Token Approval', status: 'pending' },
        { id: swapId, type: 'Uniswap Swap', status: 'pending', amount: '0.1 ETH' }
      ]);

      await handler.waitForAllComplete(120000);
      addLog('Swap completed successfully!');
    } catch (error: any) {
      addLog(`Error: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // ============================================
  // UI COMPONENT
  // ============================================

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold mb-6">Sequential Transaction Handler Demo</h1>
      
      {/* Wallet Connection */}
      <div className="mb-6">
        {!isConnected ? (
          <w3m-button />
        ) : (
          <div className="bg-green-100 p-4 rounded">
            <p className="text-green-800">Connected: {address}</p>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      {isConnected && (
        <div className="grid grid-cols-2 gap-4 mb-6">
          <button
            onClick={sendSimpleTransfer}
            disabled={isProcessing}
            className="bg-blue-500 text-white p-3 rounded hover:bg-blue-600 disabled:opacity-50"
          >
            Simple Transfer
          </button>
          
          <button
            onClick={sendSequentialTransactions}
            disabled={isProcessing}
            className="bg-purple-500 text-white p-3 rounded hover:bg-purple-600 disabled:opacity-50"
          >
            Sequential Transactions
          </button>
          
          <button
            onClick={sendBatchTransactions}
            disabled={isProcessing}
            className="bg-green-500 text-white p-3 rounded hover:bg-green-600 disabled:opacity-50"
          >
            Batch Transactions
          </button>
          
          <button
            onClick={performUniswapSwap}
            disabled={isProcessing}
            className="bg-orange-500 text-white p-3 rounded hover:bg-orange-600 disabled:opacity-50"
          >
            DeFi Swap Example
          </button>
        </div>
      )}

      {/* Transaction Status */}
      {transactions.length > 0 && (
        <div className="mb-6">
          <h2 className="text-xl font-bold mb-3">Transaction Status</h2>
          <div className="space-y-2">
            {transactions.map(tx => (
              <div key={tx.id} className="border p-3 rounded">
                <div className="flex justify-between">
                  <span className="font-medium">{tx.type}</span>
                  <span className={`px-2 py-1 rounded text-xs ${
                    tx.status === 'confirmed' ? 'bg-green-200 text-green-800' :
                    tx.status === 'failed' ? 'bg-red-200 text-red-800' :
                    tx.status === 'sent' ? 'bg-blue-200 text-blue-800' :
                    'bg-gray-200 text-gray-800'
                  }`}>
                    {tx.status}
                  </span>
                </div>
                {tx.amount && <div className="text-sm text-gray-600">Amount: {tx.amount}</div>}
                {tx.hash && (
                  <div className="text-xs text-gray-500 truncate">
                    Hash: {tx.hash}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Logs */}
      {logs.length > 0 && (
        <div>
          <h2 className="text-xl font-bold mb-3">Activity Log</h2>
          <div className="bg-gray-100 p-4 rounded h-64 overflow-y-auto">
            {logs.map((log, index) => (
              <div key={index} className="text-sm font-mono mb-1">
                {log}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}