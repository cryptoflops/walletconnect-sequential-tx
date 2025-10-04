import { RetryOptions, RetryStrategy, QueuedTransaction } from '../types';

export class RetryManager {
  private options: RetryOptions;

  constructor(options: Partial<RetryOptions> = {}) {
    this.options = {
      strategy: options.strategy || RetryStrategy.EXPONENTIAL_BACKOFF,
      maxRetries: options.maxRetries || 3,
      baseDelay: options.baseDelay || 1000, // 1 second
      maxDelay: options.maxDelay || 30000, // 30 seconds
      backoffMultiplier: options.backoffMultiplier || 2
    };
  }

  shouldRetry(transaction: QueuedTransaction, error: Error): boolean {
    // Don't retry if max retries reached
    if (transaction.retryCount >= transaction.maxRetries) {
      return false;
    }

    // Check if error is retryable
    return this.isRetryableError(error);
  }

  getRetryDelay(attemptNumber: number): number {
    switch (this.options.strategy) {
    case RetryStrategy.EXPONENTIAL_BACKOFF:
      return this.getExponentialBackoffDelay(attemptNumber);
    case RetryStrategy.LINEAR:
      return this.getLinearDelay(attemptNumber);
    case RetryStrategy.FIXED_DELAY:
      return this.options.baseDelay;
    case RetryStrategy.NONE:
      return 0;
    default:
      return this.options.baseDelay;
    }
  }

  private getExponentialBackoffDelay(attemptNumber: number): number {
    const delay = this.options.baseDelay * Math.pow(this.options.backoffMultiplier, attemptNumber - 1);
    // Add jitter to prevent thundering herd
    const jitter = Math.random() * 0.1 * delay; // 10% jitter
    const totalDelay = Math.min(delay + jitter, this.options.maxDelay);
    return Math.floor(totalDelay);
  }

  private getLinearDelay(attemptNumber: number): number {
    const delay = this.options.baseDelay * attemptNumber;
    return Math.min(delay, this.options.maxDelay);
  }

  private isRetryableError(error: Error): boolean {
    const errorMessage = error.message?.toLowerCase() || '';
    
    // Network errors
    if (errorMessage.includes('network') || 
        errorMessage.includes('timeout') ||
        errorMessage.includes('connection')) {
      return true;
    }

    // Rate limiting errors
    if (errorMessage.includes('rate limit') ||
        errorMessage.includes('too many requests') ||
        errorMessage.includes('429')) {
      return true;
    }

    // Nonce errors (can be retried with updated nonce)
    if (errorMessage.includes('nonce too low') ||
        errorMessage.includes('already known')) {
      return true;
    }

    // Gas price errors (can be retried with updated gas)
    if (errorMessage.includes('replacement transaction underpriced') ||
        errorMessage.includes('gas price too low')) {
      return true;
    }

    // Temporary blockchain errors
    if (errorMessage.includes('pending') ||
        errorMessage.includes('queued')) {
      return true;
    }

    // Don't retry user rejection or insufficient funds
    if (errorMessage.includes('user rejected') ||
        errorMessage.includes('user denied') ||
        errorMessage.includes('insufficient funds') ||
        errorMessage.includes('insufficient balance')) {
      return false;
    }

    // Don't retry contract reverts (usually logic errors)
    if (errorMessage.includes('revert') ||
        errorMessage.includes('execution reverted')) {
      return false;
    }

    // Default: don't retry unknown errors
    return false;
  }

  async wait(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  updateOptions(options: Partial<RetryOptions>): void {
    this.options = { ...this.options, ...options };
  }

  getOptions(): RetryOptions {
    return { ...this.options };
  }

  // Helper to calculate total possible retry time
  getMaxRetryTime(): number {
    let totalTime = 0;
    for (let i = 1; i <= this.options.maxRetries; i++) {
      totalTime += this.getRetryDelay(i);
    }
    return totalTime;
  }

  // Reset retry count for a transaction
  resetRetryCount(transaction: QueuedTransaction): QueuedTransaction {
    return {
      ...transaction,
      retryCount: 0
    };
  }

  // Increment retry count
  incrementRetryCount(transaction: QueuedTransaction): QueuedTransaction {
    return {
      ...transaction,
      retryCount: transaction.retryCount + 1
    };
  }
}