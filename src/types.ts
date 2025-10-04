import { TransactionReceipt } from 'ethers';
import { Address, Hash } from 'viem';

export enum TransactionStatus {
  PENDING = 'PENDING',
  QUEUED = 'QUEUED',
  EXECUTING = 'EXECUTING',
  CONFIRMING = 'CONFIRMING',
  CONFIRMED = 'CONFIRMED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
  REPLACED = 'REPLACED'
}

export enum RetryStrategy {
  EXPONENTIAL_BACKOFF = 'EXPONENTIAL_BACKOFF',
  LINEAR = 'LINEAR',
  FIXED_DELAY = 'FIXED_DELAY',
  NONE = 'NONE'
}

export interface TransactionConfig {
  id: string;
  to: Address;
  data?: string;
  value?: bigint;
  gasLimit?: bigint;
  gasPrice?: bigint;
  maxFeePerGas?: bigint;
  maxPriorityFeePerGas?: bigint;
  nonce?: number;
  chainId?: number;
  type?: number;
}

export interface QueuedTransaction {
  id: string;
  config: TransactionConfig;
  status: TransactionStatus;
  priority: number;
  dependencies: string[]; // IDs of transactions that must complete first
  retryCount: number;
  maxRetries: number;
  createdAt: Date;
  executedAt?: Date;
  confirmedAt?: Date;
  hash?: Hash;
  receipt?: TransactionReceipt;
  error?: Error;
  metadata?: Record<string, any>;
}

export interface TransactionQueueOptions {
  maxConcurrent: number;
  defaultMaxRetries: number;
  retryStrategy: RetryStrategy;
  retryDelay: number; // Base delay in ms
  maxRetryDelay: number; // Maximum delay in ms
  confirmationBlocks: number;
  autoStart: boolean;
  nonceManager: boolean; // Enable automatic nonce management
  debug?: boolean; // Enable debug logging
}

export interface RetryOptions {
  strategy: RetryStrategy;
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
}

export interface TransactionEvents {
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

export interface WalletProvider {
  sendTransaction(transaction: TransactionConfig): Promise<Hash>;
  getTransactionReceipt(hash: Hash): Promise<TransactionReceipt | null>;
  getTransactionCount(address: Address): Promise<number>;
  estimateGas(transaction: TransactionConfig): Promise<bigint>;
  getGasPrice(): Promise<bigint>;
  getBalance(address: Address): Promise<bigint>;
  waitForTransaction(hash: Hash, confirmations?: number): Promise<TransactionReceipt>;
}

export interface BatchTransaction {
  id: string;
  transactions: QueuedTransaction[];
  atomic: boolean; // If true, all must succeed or all fail
}

export interface TransactionValidation {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  estimatedGas?: bigint;
  estimatedCost?: bigint;
}

export interface QueueStatistics {
  totalQueued: number;
  totalExecuting: number;
  totalConfirmed: number;
  totalFailed: number;
  averageConfirmationTime: number;
  averageGasUsed: bigint;
  successRate: number;
}