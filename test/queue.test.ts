import { TransactionQueue } from '../src/queue/TransactionQueue';
import { TransactionStatus, RetryStrategy } from '../src/types';

describe('TransactionQueue', () => {
  let queue: TransactionQueue;

  beforeEach(() => {
    queue = new TransactionQueue({
      maxConcurrent: 2,
      defaultMaxRetries: 3,
      retryStrategy: RetryStrategy.EXPONENTIAL_BACKOFF,
    });
  });

  describe('Basic Operations', () => {
    it('should create a new queue instance', () => {
      expect(queue).toBeDefined();
      expect(queue.size()).toBe(0);
      expect(queue.isEmpty()).toBe(true);
    });

    it('should add a transaction to the queue', () => {
      const id = queue.add({
        id: 'test-1',
        to: '0x0000000000000000000000000000000000000000' as any,
        data: '0x',
      });

      expect(id).toBe('test-1');
      expect(queue.size()).toBe(1);
      expect(queue.isEmpty()).toBe(false);
    });

    it('should generate ID if not provided', () => {
      const id = queue.add({
        to: '0x0000000000000000000000000000000000000000' as any,
        data: '0x',
      } as any);

      expect(id).toBeDefined();
      expect(id).toMatch(/^tx_/);
    });

    it('should retrieve a transaction by ID', () => {
      const id = queue.add({
        id: 'test-2',
        to: '0x0000000000000000000000000000000000000000' as any,
        data: '0x',
      });

      const tx = queue.get(id);
      expect(tx).toBeDefined();
      expect(tx?.id).toBe('test-2');
      expect(tx?.status).toBe(TransactionStatus.PENDING);
    });

    it('should handle priority ordering', () => {
      // Add low priority
      queue.add(
        { id: 'low', to: '0x0000000000000000000000000000000000000000' as any },
        { priority: 1 }
      );

      // Add high priority
      queue.add(
        { id: 'high', to: '0x0000000000000000000000000000000000000000' as any },
        { priority: 10 }
      );

      // Add medium priority
      queue.add(
        { id: 'medium', to: '0x0000000000000000000000000000000000000000' as any },
        { priority: 5 }
      );

      const next = queue.getNext();
      expect(next?.id).toBe('high');
    });
  });

  describe('Dependencies', () => {
    it('should handle transaction dependencies', () => {
      const id1 = queue.add({
        id: 'tx1',
        to: '0x0000000000000000000000000000000000000000' as any,
      });

      queue.add(
        {
          id: 'tx2',
          to: '0x0000000000000000000000000000000000000000' as any,
        },
        { dependencies: [id1] }
      );

      // tx2 should not be next because tx1 is not confirmed
      const next = queue.getNext();
      expect(next?.id).toBe('tx1');

      // Confirm tx1
      queue.updateStatus(id1, TransactionStatus.CONFIRMED);

      // Now tx2 should be next
      const nextAfter = queue.getNext();
      expect(nextAfter?.id).toBe('tx2');
    });

    it('should get dependency tree', () => {
      const id1 = queue.add({ id: 'tx1', to: '0x0' as any });
      const id2 = queue.add({ id: 'tx2', to: '0x0' as any }, { dependencies: [id1] });
      queue.add({ id: 'tx3', to: '0x0' as any }, { dependencies: [id2] });

      const tree = queue.getDependencyTree();
      expect(tree.get('tx2')).toEqual(['tx1']);
      expect(tree.get('tx3')).toEqual(['tx2']);
    });
  });

  describe('Status Management', () => {
    it('should update transaction status', () => {
      const id = queue.add({
        id: 'status-test',
        to: '0x0000000000000000000000000000000000000000' as any,
      });

      expect(queue.get(id)?.status).toBe(TransactionStatus.PENDING);

      queue.updateStatus(id, TransactionStatus.EXECUTING);
      expect(queue.get(id)?.status).toBe(TransactionStatus.EXECUTING);

      queue.updateStatus(id, TransactionStatus.CONFIRMED);
      expect(queue.get(id)?.status).toBe(TransactionStatus.CONFIRMED);
    });

    it('should filter transactions by status', () => {
      queue.add({ id: 'pending', to: '0x0' as any });
      queue.add({ id: 'executing', to: '0x0' as any });
      queue.add({ id: 'confirmed', to: '0x0' as any });

      queue.updateStatus('executing', TransactionStatus.EXECUTING);
      queue.updateStatus('confirmed', TransactionStatus.CONFIRMED);

      expect(queue.getPending().length).toBe(1);
      expect(queue.getExecuting().length).toBe(1);
      expect(queue.getCompleted().length).toBe(1);
    });
  });

  describe('Queue Management', () => {
    it('should remove a transaction', () => {
      const id = queue.add({ id: 'remove-test', to: '0x0' as any });
      expect(queue.size()).toBe(1);

      const removed = queue.remove(id);
      expect(removed).toBe(true);
      expect(queue.size()).toBe(0);
    });

    it('should not remove executing transaction', () => {
      const id = queue.add({ id: 'exec-test', to: '0x0' as any });
      queue.updateStatus(id, TransactionStatus.EXECUTING);

      expect(() => queue.remove(id)).toThrow();
    });

    it('should cancel a transaction', () => {
      const id = queue.add({ id: 'cancel-test', to: '0x0' as any });
      
      const cancelled = queue.cancel(id);
      expect(cancelled).toBe(true);
      expect(queue.get(id)?.status).toBe(TransactionStatus.CANCELLED);
    });

    it('should clear non-executing transactions', () => {
      queue.add({ id: 'pending1', to: '0x0' as any });
      queue.add({ id: 'executing1', to: '0x0' as any });
      queue.add({ id: 'pending2', to: '0x0' as any });

      queue.updateStatus('executing1', TransactionStatus.EXECUTING);

      queue.clear();
      expect(queue.size()).toBe(1); // Only executing transaction remains
      expect(queue.get('executing1')).toBeDefined();
    });
  });

  describe('Statistics', () => {
    it('should calculate queue statistics', () => {
      queue.add({ id: 'tx1', to: '0x0' as any });
      queue.add({ id: 'tx2', to: '0x0' as any });
      queue.add({ id: 'tx3', to: '0x0' as any });

      queue.updateStatus('tx2', TransactionStatus.EXECUTING);
      queue.updateStatus('tx3', TransactionStatus.CONFIRMED);

      const stats = queue.getStatistics();
      expect(stats.totalQueued).toBe(1);
      expect(stats.totalExecuting).toBe(1);
      expect(stats.totalConfirmed).toBe(1);
      expect(stats.totalFailed).toBe(0);
    });
  });

  describe('Validation', () => {
    it('should validate transaction config', () => {
      const validation = queue.validateTransaction({
        id: 'valid-tx',
        to: '0x0000000000000000000000000000000000000000' as any,
        data: '0x123456',
      });

      expect(validation.isValid).toBe(true);
      expect(validation.errors.length).toBe(0);
    });

    it('should detect missing to address', () => {
      const validation = queue.validateTransaction({
        id: 'invalid-tx',
      } as any);

      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Transaction must have a "to" address');
    });

    it('should detect duplicate IDs', () => {
      queue.add({ id: 'duplicate', to: '0x0' as any });

      const validation = queue.validateTransaction({
        id: 'duplicate',
        to: '0x0' as any,
      });

      expect(validation.isValid).toBe(false);
      expect(validation.errors[0]).toContain('already exists');
    });
  });
});