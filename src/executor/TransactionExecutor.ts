import {
  QueuedTransaction,
  TransactionStatus,
  WalletProvider,
  TransactionQueueOptions
} from '../types';
import { TransactionQueue } from '../queue/TransactionQueue';
import { TransactionEventEmitter } from '../events/EventEmitter';
import { RetryManager } from '../retry/RetryManager';

export class TransactionExecutor {
  private queue: TransactionQueue;
  private provider: WalletProvider;
  private emitter: TransactionEventEmitter;
  private retryManager: RetryManager;
  private options: TransactionQueueOptions;
  private isRunning: boolean = false;
  private currentlyExecuting: Map<string, QueuedTransaction> = new Map();
  private nonceTracker: Map<string, number> = new Map();

  constructor(
    queue: TransactionQueue,
    provider: WalletProvider,
    emitter: TransactionEventEmitter,
    options: TransactionQueueOptions
  ) {
    this.queue = queue;
    this.provider = provider;
    this.emitter = emitter;
    this.options = options;
    
    this.retryManager = new RetryManager({
      strategy: options.retryStrategy,
      maxRetries: options.defaultMaxRetries,
      baseDelay: options.retryDelay,
      maxDelay: options.maxRetryDelay
    });

    if (options.autoStart) {
      this.start();
    }
  }

  start(): void {
    if (this.isRunning) return;
    
    this.isRunning = true;
    this.emitter.emitQueueResumed();
    this.processQueue();
  }

  stop(): void {
    this.isRunning = false;
    this.emitter.emitQueuePaused();
  }

  private async processQueue(): Promise<void> {
    while (this.isRunning) {
      try {
        // Check if we can execute more transactions
        if (this.currentlyExecuting.size >= this.options.maxConcurrent) {
          await this.wait(100);
          continue;
        }

        // Get next transaction from queue
        const transaction = this.queue.getNext();
        
        if (!transaction) {
          if (this.currentlyExecuting.size === 0) {
            this.emitter.emitQueueEmpty();
          }
          await this.wait(100);
          continue;
        }

        // Mark as queued
        this.queue.updateStatus(transaction.id, TransactionStatus.QUEUED);
        this.emitter.emitTransactionQueued(transaction);

        // Execute transaction
        this.executeTransaction(transaction);

      } catch (error) {
        console.error('Error processing queue:', error);
        await this.wait(1000);
      }
    }
  }

  private async executeTransaction(transaction: QueuedTransaction): Promise<void> {
    try {
      // Mark as executing
      this.currentlyExecuting.set(transaction.id, transaction);
      this.queue.updateStatus(transaction.id, TransactionStatus.EXECUTING);
      this.emitter.emitTransactionStarted(transaction);

      // Prepare transaction config
      const preparedConfig = await this.prepareTransaction(transaction);
      
      // Send transaction
      const hash = await this.provider.sendTransaction(preparedConfig);
      
      // Update transaction with hash
      transaction.hash = hash;
      this.emitter.emitTransactionSent(transaction, hash);

      // Wait for confirmation
      this.queue.updateStatus(transaction.id, TransactionStatus.CONFIRMING);
      const receipt = await this.provider.waitForTransaction(
        hash, 
        this.options.confirmationBlocks
      );

      // Mark as confirmed
      transaction.receipt = receipt;
      this.queue.updateStatus(transaction.id, TransactionStatus.CONFIRMED);
      this.emitter.emitTransactionConfirmed(transaction, receipt);

    } catch (error) {
      await this.handleTransactionError(transaction, error as Error);
    } finally {
      this.currentlyExecuting.delete(transaction.id);
    }
  }

  private async prepareTransaction(transaction: QueuedTransaction): Promise<any> {
    const config = { ...transaction.config };

    // Automatic nonce management
    if (this.options.nonceManager && !config.nonce) {
      const account = await this.getAccount();
      const currentNonce = await this.provider.getTransactionCount(account);
      
      // Check if we have a tracked nonce
      const trackedNonce = this.nonceTracker.get(account) || currentNonce;
      config.nonce = Math.max(currentNonce, trackedNonce);
      
      // Update tracked nonce
      this.nonceTracker.set(account, config.nonce + 1);
    }

    // Estimate gas if not provided
    if (!config.gasLimit) {
      config.gasLimit = await this.provider.estimateGas(config);
    }

    // Get gas price if not provided
    if (!config.gasPrice && !config.maxFeePerGas) {
      config.gasPrice = await this.provider.getGasPrice();
    }

    return config;
  }

  private async handleTransactionError(
    transaction: QueuedTransaction, 
    error: Error
  ): Promise<void> {
    console.error(`Transaction ${transaction.id} failed:`, error);

    // Check if we should retry
    if (this.retryManager.shouldRetry(transaction, error)) {
      const updatedTx = this.retryManager.incrementRetryCount(transaction);
      this.queue.updateStatus(updatedTx.id, TransactionStatus.PENDING);
      
      const delay = this.retryManager.getRetryDelay(updatedTx.retryCount);
      this.emitter.emitTransactionRetry(updatedTx, updatedTx.retryCount);
      
      // Wait before retry
      await this.wait(delay);
      
      // Reset nonce if it was a nonce error
      if (error.message.toLowerCase().includes('nonce')) {
        const account = await this.getAccount();
        this.nonceTracker.delete(account);
      }
    } else {
      // Mark as failed
      transaction.error = error;
      this.queue.updateStatus(transaction.id, TransactionStatus.FAILED);
      this.emitter.emitTransactionFailed(transaction, error);
    }
  }

  private async getAccount(): Promise<`0x${string}`> {
    // This would typically come from the provider
    // For now, return a placeholder
    return '0x0000000000000000000000000000000000000000';
  }

  private wait(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Public methods for control
  async cancelTransaction(id: string): Promise<boolean> {
    const transaction = this.queue.get(id);
    if (!transaction) return false;

    // Check if transaction is executing
    if (this.currentlyExecuting.has(id)) {
      // Can't cancel executing transaction
      // Could implement replacement transaction here
      return false;
    }

    const cancelled = this.queue.cancel(id);
    if (cancelled) {
      this.emitter.emitTransactionCancelled(transaction);
    }

    return cancelled;
  }

  async retryTransaction(id: string): Promise<boolean> {
    const transaction = this.queue.get(id);
    if (!transaction) return false;

    if (transaction.status !== TransactionStatus.FAILED) {
      return false;
    }

    // Reset transaction for retry
    const resetTx = this.retryManager.resetRetryCount(transaction);
    this.queue.updateStatus(resetTx.id, TransactionStatus.PENDING);
    
    return true;
  }

  getExecutingTransactions(): QueuedTransaction[] {
    return Array.from(this.currentlyExecuting.values());
  }

  isExecuting(id: string): boolean {
    return this.currentlyExecuting.has(id);
  }

  getQueueStatistics() {
    return this.queue.getStatistics();
  }
}