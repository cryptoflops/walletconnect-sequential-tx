import {
  QueuedTransaction,
  TransactionConfig,
  TransactionStatus,
  TransactionQueueOptions,
  RetryStrategy,
  QueueStatistics,
  TransactionValidation
} from '../types';
// Generate unique ID
const generateId = (): string => {
  return `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

export class TransactionQueue {
  private queue: Map<string, QueuedTransaction>;
  private executionOrder: string[];
  private options: TransactionQueueOptions;
  private dependencyGraph: Map<string, Set<string>>;

  constructor(options: Partial<TransactionQueueOptions> = {}) {
    this.queue = new Map();
    this.executionOrder = [];
    this.dependencyGraph = new Map();
    
    this.options = {
      maxConcurrent: options.maxConcurrent || 1,
      defaultMaxRetries: options.defaultMaxRetries || 3,
      retryStrategy: options.retryStrategy || RetryStrategy.EXPONENTIAL_BACKOFF,
      retryDelay: options.retryDelay || 1000,
      maxRetryDelay: options.maxRetryDelay || 30000,
      confirmationBlocks: options.confirmationBlocks || 1,
      autoStart: options.autoStart !== undefined ? options.autoStart : true,
      nonceManager: options.nonceManager !== undefined ? options.nonceManager : true
    };
  }

  add(
    config: TransactionConfig,
    options: {
      priority?: number;
      dependencies?: string[];
      maxRetries?: number;
      metadata?: Record<string, any>;
    } = {}
  ): string {
    const id = config.id || generateId();
    
    const transaction: QueuedTransaction = {
      id,
      config: { ...config, id },
      status: TransactionStatus.PENDING,
      priority: options.priority || 0,
      dependencies: options.dependencies || [],
      retryCount: 0,
      maxRetries: options.maxRetries || this.options.defaultMaxRetries,
      createdAt: new Date(),
      metadata: options.metadata
    };

    this.queue.set(id, transaction);
    
    // Update dependency graph
    if (options.dependencies && options.dependencies.length > 0) {
      this.dependencyGraph.set(id, new Set(options.dependencies));
    }

    // Add to execution order based on priority
    this.insertIntoExecutionOrder(id, transaction.priority);

    return id;
  }

  private insertIntoExecutionOrder(id: string, priority: number): void {
    // Find the correct position based on priority
    let insertIndex = this.executionOrder.length;
    
    for (let i = 0; i < this.executionOrder.length; i++) {
      const existingTx = this.queue.get(this.executionOrder[i]);
      if (existingTx && existingTx.priority < priority) {
        insertIndex = i;
        break;
      }
    }

    this.executionOrder.splice(insertIndex, 0, id);
  }

  remove(id: string): boolean {
    const transaction = this.queue.get(id);
    if (!transaction) return false;

    // Only allow removal if not executing or confirmed
    if (transaction.status === TransactionStatus.EXECUTING ||
        transaction.status === TransactionStatus.CONFIRMING) {
      throw new Error(`Cannot remove transaction ${id} in status ${transaction.status}`);
    }

    this.queue.delete(id);
    this.executionOrder = this.executionOrder.filter(txId => txId !== id);
    this.dependencyGraph.delete(id);

    // Remove from other dependencies
    this.dependencyGraph.forEach(deps => {
      deps.delete(id);
    });

    return true;
  }

  cancel(id: string): boolean {
    const transaction = this.queue.get(id);
    if (!transaction) return false;

    if (transaction.status === TransactionStatus.CONFIRMED) {
      return false;
    }

    transaction.status = TransactionStatus.CANCELLED;
    return true;
  }

  get(id: string): QueuedTransaction | undefined {
    return this.queue.get(id);
  }

  getNext(): QueuedTransaction | undefined {
    for (const id of this.executionOrder) {
      const transaction = this.queue.get(id);
      
      if (!transaction) continue;
      
      // Skip if not pending or queued
      if (transaction.status !== TransactionStatus.PENDING &&
          transaction.status !== TransactionStatus.QUEUED) {
        continue;
      }

      // Check dependencies
      if (this.hasPendingDependencies(id)) {
        continue;
      }

      return transaction;
    }

    return undefined;
  }

  private hasPendingDependencies(id: string): boolean {
    const dependencies = this.dependencyGraph.get(id);
    if (!dependencies || dependencies.size === 0) {
      return false;
    }

    for (const depId of dependencies) {
      const depTx = this.queue.get(depId);
      if (!depTx) continue;
      
      if (depTx.status !== TransactionStatus.CONFIRMED &&
          depTx.status !== TransactionStatus.CANCELLED) {
        return true;
      }
    }

    return false;
  }

  updateStatus(id: string, status: TransactionStatus): boolean {
    const transaction = this.queue.get(id);
    if (!transaction) return false;

    transaction.status = status;
    
    // Update timestamps
    if (status === TransactionStatus.EXECUTING) {
      transaction.executedAt = new Date();
    } else if (status === TransactionStatus.CONFIRMED) {
      transaction.confirmedAt = new Date();
    }

    return true;
  }

  getAll(): QueuedTransaction[] {
    return Array.from(this.queue.values());
  }

  getPending(): QueuedTransaction[] {
    return this.getAll().filter(tx => 
      tx.status === TransactionStatus.PENDING ||
      tx.status === TransactionStatus.QUEUED
    );
  }

  getExecuting(): QueuedTransaction[] {
    return this.getAll().filter(tx => 
      tx.status === TransactionStatus.EXECUTING ||
      tx.status === TransactionStatus.CONFIRMING
    );
  }

  getCompleted(): QueuedTransaction[] {
    return this.getAll().filter(tx => 
      tx.status === TransactionStatus.CONFIRMED ||
      tx.status === TransactionStatus.FAILED ||
      tx.status === TransactionStatus.CANCELLED
    );
  }

  clear(): void {
    // Only clear non-executing transactions
    const executing = this.getExecuting();
    
    this.queue.clear();
    this.executionOrder = [];
    this.dependencyGraph.clear();

    // Re-add executing transactions
    executing.forEach(tx => {
      this.queue.set(tx.id, tx);
      this.executionOrder.push(tx.id);
    });
  }

  size(): number {
    return this.queue.size;
  }

  isEmpty(): boolean {
    return this.getPending().length === 0 && this.getExecuting().length === 0;
  }

  getStatistics(): QueueStatistics {
    const all = this.getAll();
    const confirmed = all.filter(tx => tx.status === TransactionStatus.CONFIRMED);
    const failed = all.filter(tx => tx.status === TransactionStatus.FAILED);
    
    let totalConfirmationTime = 0;
    let totalGasUsed = 0n;
    
    confirmed.forEach(tx => {
      if (tx.createdAt && tx.confirmedAt) {
        totalConfirmationTime += tx.confirmedAt.getTime() - tx.createdAt.getTime();
      }
      if (tx.receipt?.gasUsed) {
        totalGasUsed += tx.receipt.gasUsed;
      }
    });

    return {
      totalQueued: this.getPending().length,
      totalExecuting: this.getExecuting().length,
      totalConfirmed: confirmed.length,
      totalFailed: failed.length,
      averageConfirmationTime: confirmed.length > 0 
        ? totalConfirmationTime / confirmed.length 
        : 0,
      averageGasUsed: confirmed.length > 0 
        ? totalGasUsed / BigInt(confirmed.length)
        : 0n,
      successRate: all.length > 0 
        ? confirmed.length / all.length 
        : 0
    };
  }

  // Validation method for pre-flight checks
  validateTransaction(config: TransactionConfig): TransactionValidation {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Basic validation
    if (!config.to) {
      errors.push('Transaction must have a "to" address');
    }

    if (!config.data && !config.value) {
      warnings.push('Transaction has no data or value');
    }

    // Check for duplicate IDs
    if (config.id && this.queue.has(config.id)) {
      errors.push(`Transaction with ID ${config.id} already exists`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      estimatedGas: config.gasLimit,
      estimatedCost: config.gasLimit && config.gasPrice 
        ? config.gasLimit * config.gasPrice 
        : undefined
    };
  }

  // Get dependency tree for visualization
  getDependencyTree(): Map<string, string[]> {
    const tree = new Map<string, string[]>();
    
    this.dependencyGraph.forEach((deps, id) => {
      tree.set(id, Array.from(deps));
    });

    return tree;
  }

  // Helper to reorder transactions
  reorder(id: string, newPriority: number): boolean {
    const transaction = this.queue.get(id);
    if (!transaction) return false;

    // Remove from current position
    this.executionOrder = this.executionOrder.filter(txId => txId !== id);
    
    // Update priority
    transaction.priority = newPriority;
    
    // Re-insert with new priority
    this.insertIntoExecutionOrder(id, newPriority);
    
    return true;
  }
}