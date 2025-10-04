import { RetryManager } from '../src/retry/RetryManager';
import { RetryStrategy, TransactionStatus } from '../src/types';

describe('RetryManager', () => {
  let retryManager: RetryManager;

  beforeEach(() => {
    retryManager = new RetryManager({
      strategy: RetryStrategy.EXPONENTIAL_BACKOFF,
      maxRetries: 3,
      baseDelay: 100,
      maxDelay: 5000,
      backoffMultiplier: 2,
    });
  });

  describe('Retry Strategies', () => {
    it('should calculate exponential backoff delays', () => {
      const delay1 = retryManager.getRetryDelay(1);
      const delay2 = retryManager.getRetryDelay(2);
      const delay3 = retryManager.getRetryDelay(3);

      // Should roughly double each time (with jitter)
      expect(delay1).toBeGreaterThanOrEqual(90); // 100ms base with jitter
      expect(delay1).toBeLessThanOrEqual(110);
      
      expect(delay2).toBeGreaterThanOrEqual(180); // ~200ms with jitter
      expect(delay2).toBeLessThanOrEqual(220);
      
      expect(delay3).toBeGreaterThanOrEqual(360); // ~400ms with jitter
      expect(delay3).toBeLessThanOrEqual(440);
    });

    it('should respect max delay', () => {
      const delay = retryManager.getRetryDelay(10); // Very high attempt
      expect(delay).toBeLessThanOrEqual(5000);
    });

    it('should calculate linear delays', () => {
      const linearManager = new RetryManager({
        strategy: RetryStrategy.LINEAR,
        baseDelay: 100,
        maxDelay: 1000,
      });

      expect(linearManager.getRetryDelay(1)).toBe(100);
      expect(linearManager.getRetryDelay(2)).toBe(200);
      expect(linearManager.getRetryDelay(3)).toBe(300);
      expect(linearManager.getRetryDelay(10)).toBe(1000); // Max delay
    });

    it('should use fixed delay', () => {
      const fixedManager = new RetryManager({
        strategy: RetryStrategy.FIXED_DELAY,
        baseDelay: 500,
      });

      expect(fixedManager.getRetryDelay(1)).toBe(500);
      expect(fixedManager.getRetryDelay(5)).toBe(500);
      expect(fixedManager.getRetryDelay(10)).toBe(500);
    });

    it('should return 0 for no retry strategy', () => {
      const noRetryManager = new RetryManager({
        strategy: RetryStrategy.NONE,
      });

      expect(noRetryManager.getRetryDelay(1)).toBe(0);
      expect(noRetryManager.getRetryDelay(5)).toBe(0);
    });
  });

  describe('Error Handling', () => {
    const mockTransaction = {
      id: 'test-tx',
      config: { id: 'test-tx', to: '0x0' as any },
      status: TransactionStatus.FAILED,
      priority: 0,
      dependencies: [],
      retryCount: 0,
      maxRetries: 3,
      createdAt: new Date(),
    };

    it('should retry network errors', () => {
      const networkError = new Error('Network timeout');
      expect(retryManager.shouldRetry(mockTransaction, networkError)).toBe(true);
    });

    it('should retry rate limit errors', () => {
      const rateLimitError = new Error('Too many requests (429)');
      expect(retryManager.shouldRetry(mockTransaction, rateLimitError)).toBe(true);
    });

    it('should retry nonce errors', () => {
      const nonceError = new Error('Nonce too low');
      expect(retryManager.shouldRetry(mockTransaction, nonceError)).toBe(true);
    });

    it('should retry gas price errors', () => {
      const gasError = new Error('Replacement transaction underpriced');
      expect(retryManager.shouldRetry(mockTransaction, gasError)).toBe(true);
    });

    it('should not retry user rejection', () => {
      const userError = new Error('User rejected transaction');
      expect(retryManager.shouldRetry(mockTransaction, userError)).toBe(false);
    });

    it('should not retry insufficient funds', () => {
      const fundsError = new Error('Insufficient funds for transaction');
      expect(retryManager.shouldRetry(mockTransaction, fundsError)).toBe(false);
    });

    it('should not retry contract reverts', () => {
      const revertError = new Error('Execution reverted: Invalid state');
      expect(retryManager.shouldRetry(mockTransaction, revertError)).toBe(false);
    });

    it('should not retry when max retries exceeded', () => {
      const txWithMaxRetries = {
        ...mockTransaction,
        retryCount: 3,
        maxRetries: 3,
      };
      const networkError = new Error('Network error');
      expect(retryManager.shouldRetry(txWithMaxRetries, networkError)).toBe(false);
    });
  });

  describe('Utility Methods', () => {
    it('should calculate max retry time', () => {
      const maxTime = retryManager.getMaxRetryTime();
      expect(maxTime).toBeGreaterThan(0);
      expect(maxTime).toBeLessThanOrEqual(15000); // 3 retries with max delay
    });

    it('should reset retry count', () => {
      const tx = {
        id: 'test',
        config: { id: 'test', to: '0x0' as any },
        status: TransactionStatus.FAILED,
        priority: 0,
        dependencies: [],
        retryCount: 5,
        maxRetries: 3,
        createdAt: new Date(),
      };

      const reset = retryManager.resetRetryCount(tx);
      expect(reset.retryCount).toBe(0);
      expect(tx.retryCount).toBe(5); // Original unchanged
    });

    it('should increment retry count', () => {
      const tx = {
        id: 'test',
        config: { id: 'test', to: '0x0' as any },
        status: TransactionStatus.FAILED,
        priority: 0,
        dependencies: [],
        retryCount: 1,
        maxRetries: 3,
        createdAt: new Date(),
      };

      const incremented = retryManager.incrementRetryCount(tx);
      expect(incremented.retryCount).toBe(2);
      expect(tx.retryCount).toBe(1); // Original unchanged
    });

    it('should update options', () => {
      const originalOptions = retryManager.getOptions();
      expect(originalOptions.maxRetries).toBe(3);

      retryManager.updateOptions({ maxRetries: 5 });
      
      const updatedOptions = retryManager.getOptions();
      expect(updatedOptions.maxRetries).toBe(5);
      expect(updatedOptions.strategy).toBe(RetryStrategy.EXPONENTIAL_BACKOFF); // Unchanged
    });
  });

  describe('Wait Function', () => {
    it('should wait for specified time', async () => {
      const start = Date.now();
      await retryManager.wait(100);
      const elapsed = Date.now() - start;
      
      expect(elapsed).toBeGreaterThanOrEqual(95); // Allow small variance
      expect(elapsed).toBeLessThan(150);
    });
  });
});