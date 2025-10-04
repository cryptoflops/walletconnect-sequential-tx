export * from './types';
export { TransactionQueue } from './queue/TransactionQueue';
export { TransactionExecutor } from './executor/TransactionExecutor';
export { TransactionEventEmitter } from './events/EventEmitter';
export { RetryManager } from './retry/RetryManager';
export { WalletConnectProvider } from './providers/WalletConnectProvider';

// Main class that combines all components
import { 
  TransactionQueueOptions,
  TransactionConfig,
  WalletProvider,
  QueuedTransaction,
  RetryStrategy
} from './types';
import { TransactionQueue } from './queue/TransactionQueue';
import { TransactionExecutor } from './executor/TransactionExecutor';
import { TransactionEventEmitter } from './events/EventEmitter';
import { WalletConnectProvider } from './providers/WalletConnectProvider';

export class SequentialTransactionHandler {
  private queue: TransactionQueue;
  private executor: TransactionExecutor;
  private emitter: TransactionEventEmitter;
  private provider: WalletProvider;

  constructor(
    provider: WalletProvider | any,
    options: Partial<TransactionQueueOptions> = {}
  ) {
    // Create event emitter
    this.emitter = new TransactionEventEmitter(options.debug || false);

    // Create queue
    this.queue = new TransactionQueue(options);

    // Set up provider
    if (provider instanceof WalletConnectProvider || 
        (provider && typeof provider.sendTransaction === 'function')) {
      this.provider = provider;
    } else {
      // Assume it's a raw provider that needs wrapping
      this.provider = new WalletConnectProvider(
        provider, 
        provider.account || '0x0000000000000000000000000000000000000000',
        provider.chainId || 1
      );
    }

    // Create executor
    this.executor = new TransactionExecutor(
      this.queue,
      this.provider,
      this.emitter,
      {
        maxConcurrent: options.maxConcurrent || 1,
        defaultMaxRetries: options.defaultMaxRetries || 3,
        retryStrategy: options.retryStrategy || RetryStrategy.EXPONENTIAL_BACKOFF,
        retryDelay: options.retryDelay || 1000,
        maxRetryDelay: options.maxRetryDelay || 30000,
        confirmationBlocks: options.confirmationBlocks || 1,
        autoStart: options.autoStart !== undefined ? options.autoStart : true,
        nonceManager: options.nonceManager !== undefined ? options.nonceManager : true
      }
    );
  }

  // Queue management
  addTransaction(
    config: TransactionConfig,
    options: {
      priority?: number;
      dependencies?: string[];
      maxRetries?: number;
      metadata?: Record<string, any>;
    } = {}
  ): string {
    return this.queue.add(config, options);
  }

  addBatch(
    transactions: Array<{
      config: TransactionConfig;
      options?: {
        priority?: number;
        dependencies?: string[];
        maxRetries?: number;
        metadata?: Record<string, any>;
      };
    }>
  ): string[] {
    const ids: string[] = [];
    
    for (const tx of transactions) {
      const id = this.queue.add(tx.config, tx.options || {});
      ids.push(id);
    }

    return ids;
  }

  // Create dependent transactions
  addSequence(
    transactions: TransactionConfig[],
    options: {
      priority?: number;
      maxRetries?: number;
      metadata?: Record<string, any>;
    } = {}
  ): string[] {
    const ids: string[] = [];
    
    for (let i = 0; i < transactions.length; i++) {
      const dependencies = i > 0 ? [ids[i - 1]] : [];
      const id = this.queue.add(transactions[i], {
        ...options,
        dependencies
      });
      ids.push(id);
    }

    return ids;
  }

  // Transaction control
  async cancelTransaction(id: string): Promise<boolean> {
    return this.executor.cancelTransaction(id);
  }

  async retryTransaction(id: string): Promise<boolean> {
    return this.executor.retryTransaction(id);
  }

  removeTransaction(id: string): boolean {
    return this.queue.remove(id);
  }

  // Queue control
  start(): void {
    this.executor.start();
  }

  stop(): void {
    this.executor.stop();
  }

  clear(): void {
    this.queue.clear();
  }

  // Status and monitoring
  getTransaction(id: string): QueuedTransaction | undefined {
    return this.queue.get(id);
  }

  getQueuedTransactions(): QueuedTransaction[] {
    return this.queue.getPending();
  }

  getExecutingTransactions(): QueuedTransaction[] {
    return this.executor.getExecutingTransactions();
  }

  getCompletedTransactions(): QueuedTransaction[] {
    return this.queue.getCompleted();
  }

  getStatistics() {
    return this.queue.getStatistics();
  }

  getDependencyTree() {
    return this.queue.getDependencyTree();
  }

  // Event handling
  on(event: string, handler: (...args: any[]) => void): void {
    this.emitter.on(event as any, handler);
  }

  off(event: string, handler: (...args: any[]) => void): void {
    this.emitter.off(event as any, handler);
  }

  once(event: string, handler: (...args: any[]) => void): void {
    this.emitter.once(event as any, handler);
  }

  // Wait for specific events
  async waitForTransaction(id: string, timeout?: number): Promise<QueuedTransaction> {
    return this.emitter.waitForEvent(
      'transaction:confirmed',
      (tx) => tx.id === id,
      timeout
    );
  }

  async waitForAllComplete(timeout?: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const checkComplete = () => {
        if (this.queue.isEmpty()) {
          resolve();
        }
      };

      // Check immediately
      checkComplete();

      // Set up listener
      const handler = () => checkComplete();
      this.emitter.on('queue:empty', handler);

      // Set up timeout if provided
      if (timeout) {
        setTimeout(() => {
          this.emitter.off('queue:empty', handler);
          reject(new Error('Timeout waiting for queue to empty'));
        }, timeout);
      }
    });
  }

  // Utility methods
  validateTransaction(config: TransactionConfig) {
    return this.queue.validateTransaction(config);
  }

  reorderTransaction(id: string, newPriority: number): boolean {
    return this.queue.reorder(id, newPriority);
  }
}