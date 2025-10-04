import { WalletProvider, TransactionConfig } from '../types';
import { Address, Hash, createWalletClient, createPublicClient, custom, WalletClient, PublicClient } from 'viem';
import { mainnet } from 'viem/chains';
import { TransactionReceipt } from 'ethers';

export class WalletConnectProvider implements WalletProvider {
  private walletClient: WalletClient;
  private publicClient: PublicClient;
  private account: Address;
  private chainId: number;

  constructor(provider: any, account: Address, chainId: number = mainnet.id) {
    this.account = account;
    this.chainId = chainId;
    
    const transport = custom(provider);
    const chain = { ...mainnet, id: chainId };
    
    // Create viem wallet client from the provider
    this.walletClient = createWalletClient({
      account,
      chain,
      transport
    });
    
    // Create public client for read operations
    this.publicClient = createPublicClient({
      chain,
      transport
    });
  }

  async sendTransaction(transaction: TransactionConfig): Promise<Hash> {
    try {
      const request: any = {
        account: this.account,
        to: transaction.to,
        value: transaction.value,
        data: transaction.data as `0x${string}` | undefined,
        gas: transaction.gasLimit,
        nonce: transaction.nonce,
        chain: { ...mainnet, id: transaction.chainId || this.chainId }
      };
      
      // Use either EIP-1559 or legacy gas pricing
      if (transaction.maxFeePerGas) {
        request.maxFeePerGas = transaction.maxFeePerGas;
        request.maxPriorityFeePerGas = transaction.maxPriorityFeePerGas;
      } else if (transaction.gasPrice) {
        request.gasPrice = transaction.gasPrice;
      }
      
      const hash = await this.walletClient.sendTransaction(request);
      
      return hash;
    } catch (error) {
      throw this.normalizeError(error);
    }
  }

  async getTransactionReceipt(hash: Hash): Promise<TransactionReceipt | null> {
    try {
      const receipt = await this.publicClient.getTransactionReceipt({ hash });
      
      if (!receipt) return null;
      
      // Convert viem receipt to ethers-like format
      return {
        to: receipt.to || '',
        from: receipt.from,
        contractAddress: receipt.contractAddress || null,
        transactionIndex: receipt.transactionIndex,
        gasUsed: receipt.gasUsed,
        logsBloom: receipt.logsBloom,
        blockHash: receipt.blockHash,
        hash: receipt.transactionHash,
        logs: receipt.logs as any,
        blockNumber: Number(receipt.blockNumber),
        confirmations: 0,
        cumulativeGasUsed: receipt.cumulativeGasUsed,
        effectiveGasPrice: receipt.effectiveGasPrice,
        status: receipt.status === 'success' ? 1 : 0,
        type: receipt.type as any
      } as any;
    } catch (error) {
      throw this.normalizeError(error);
    }
  }

  async getTransactionCount(address: Address): Promise<number> {
    try {
      const count = await this.publicClient.getTransactionCount({
        address,
        blockTag: 'pending'
      });
      return count;
    } catch (error) {
      throw this.normalizeError(error);
    }
  }

  async estimateGas(transaction: TransactionConfig): Promise<bigint> {
    try {
      const gas = await this.publicClient.estimateGas({
        account: this.account,
        to: transaction.to,
        value: transaction.value,
        data: transaction.data as `0x${string}` | undefined
      });
      
      // Add 20% buffer for safety
      return gas + (gas * 20n / 100n);
    } catch (error) {
      throw this.normalizeError(error);
    }
  }

  async getGasPrice(): Promise<bigint> {
    try {
      const gasPrice = await this.publicClient.getGasPrice();
      return gasPrice;
    } catch (error) {
      throw this.normalizeError(error);
    }
  }

  async getBalance(address: Address): Promise<bigint> {
    try {
      const balance = await this.publicClient.getBalance({ address });
      return balance;
    } catch (error) {
      throw this.normalizeError(error);
    }
  }

  async waitForTransaction(hash: Hash, confirmations: number = 1): Promise<TransactionReceipt> {
    try {
      const receipt = await this.publicClient.waitForTransactionReceipt({
        hash,
        confirmations
      });
      
      // Convert to ethers-like format
      return {
        to: receipt.to || '',
        from: receipt.from,
        contractAddress: receipt.contractAddress || null,
        transactionIndex: receipt.transactionIndex,
        gasUsed: receipt.gasUsed,
        logsBloom: receipt.logsBloom,
        blockHash: receipt.blockHash,
        hash: receipt.transactionHash,
        logs: receipt.logs as any,
        blockNumber: Number(receipt.blockNumber),
        confirmations,
        cumulativeGasUsed: receipt.cumulativeGasUsed,
        effectiveGasPrice: receipt.effectiveGasPrice,
        status: receipt.status === 'success' ? 1 : 0,
        type: receipt.type as any
      } as any;
    } catch (error) {
      throw this.normalizeError(error);
    }
  }

  private normalizeError(error: any): Error {
    if (error instanceof Error) {
      return error;
    }
    
    if (typeof error === 'string') {
      return new Error(error);
    }
    
    if (error?.message) {
      return new Error(error.message);
    }
    
    return new Error('Unknown error occurred');
  }

  // Additional helper methods
  getAccount(): Address {
    return this.account;
  }

  getChainId(): number {
    return this.chainId;
  }

  async switchChain(chainId: number): Promise<void> {
    // This would typically trigger a chain switch in the wallet
    // Implementation depends on the specific wallet provider
    this.chainId = chainId;
  }
}