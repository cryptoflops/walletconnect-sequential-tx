import { EventEmitter } from 'eventemitter3';
import { TransactionEvents, QueuedTransaction } from '../types';
import { TransactionReceipt } from 'ethers';
import { Hash } from 'viem';

export class TransactionEventEmitter extends EventEmitter<TransactionEvents> {
  private debug: boolean;

  constructor(debug: boolean = false) {
    super();
    this.debug = debug;
  }

  emitTransactionQueued(transaction: QueuedTransaction): void {
    this.logDebug('Transaction queued', { id: transaction.id });
    this.emit('transaction:queued', transaction);
  }

  emitTransactionStarted(transaction: QueuedTransaction): void {
    this.logDebug('Transaction started', { id: transaction.id });
    this.emit('transaction:started', transaction);
  }

  emitTransactionSent(transaction: QueuedTransaction, hash: Hash): void {
    this.logDebug('Transaction sent', { id: transaction.id, hash });
    this.emit('transaction:sent', transaction, hash);
  }

  emitTransactionConfirmed(transaction: QueuedTransaction, receipt: TransactionReceipt): void {
    this.logDebug('Transaction confirmed', { 
      id: transaction.id, 
      hash: receipt.hash,
      blockNumber: receipt.blockNumber 
    });
    this.emit('transaction:confirmed', transaction, receipt);
  }

  emitTransactionFailed(transaction: QueuedTransaction, error: Error): void {
    this.logDebug('Transaction failed', { 
      id: transaction.id, 
      error: error.message 
    });
    this.emit('transaction:failed', transaction, error);
  }

  emitTransactionRetry(transaction: QueuedTransaction, attemptNumber: number): void {
    this.logDebug('Transaction retry', { 
      id: transaction.id, 
      attempt: attemptNumber 
    });
    this.emit('transaction:retry', transaction, attemptNumber);
  }

  emitTransactionCancelled(transaction: QueuedTransaction): void {
    this.logDebug('Transaction cancelled', { id: transaction.id });
    this.emit('transaction:cancelled', transaction);
  }

  emitQueueEmpty(): void {
    this.logDebug('Queue empty');
    this.emit('queue:empty');
  }

  emitQueuePaused(): void {
    this.logDebug('Queue paused');
    this.emit('queue:paused');
  }

  emitQueueResumed(): void {
    this.logDebug('Queue resumed');
    this.emit('queue:resumed');
  }

  private logDebug(message: string, data?: any): void {
    if (this.debug) {
      console.log(`[TransactionQueue] ${message}`, data || '');
    }
  }

  // Helper method to wait for specific events
  async waitForEvent<K extends keyof TransactionEvents>(
    eventName: K,
    filter?: (data: Parameters<TransactionEvents[K]>[0]) => boolean,
    timeout?: number
  ): Promise<Parameters<TransactionEvents[K]>[0]> {
    return new Promise((resolve, reject) => {
      const timeoutId = timeout
        ? setTimeout(() => {
            this.off(eventName as any, handler);
            reject(new Error(`Timeout waiting for event: ${String(eventName)}`));
          }, timeout)
        : null;

      const handler = (data: Parameters<TransactionEvents[K]>[0]) => {
        if (!filter || filter(data)) {
          if (timeoutId) clearTimeout(timeoutId);
          this.off(eventName as any, handler);
          resolve(data);
        }
      };

      this.on(eventName as any, handler);
    });
  }
}