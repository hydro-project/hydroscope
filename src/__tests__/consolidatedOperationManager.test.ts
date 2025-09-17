/**
 * @fileoverview Tests for ConsolidatedOperationManager
 *
 * Tests the unified operation management system that replaces both
 * GlobalLayoutLock and GlobalReactFlowOperationManager.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { consolidatedOperationManager } from '../utils/consolidatedOperationManager';

describe('ConsolidatedOperationManager', () => {
  beforeEach(() => {
    consolidatedOperationManager.clearAll();
    vi.clearAllTimers();
  });

  afterEach(() => {
    consolidatedOperationManager.clearAll();
    vi.clearAllTimers();
  });

  describe('Layout Operations', () => {
    it('should queue and execute layout operations', async () => {
      const mockCallback = vi.fn().mockResolvedValue(undefined);

      const success = await consolidatedOperationManager.queueLayoutOperation(
        'test-layout',
        mockCallback,
        { priority: 'normal', reason: 'test' }
      );

      expect(success).toBe(true);
      expect(mockCallback).toHaveBeenCalledOnce();
    });

    it('should trigger autofit after layout operations when requested', async () => {
      const mockLayoutCallback = vi.fn().mockResolvedValue(undefined);
      const mockFitView = vi.fn();

      // First queue a layout operation that should trigger autofit
      const layoutPromise = consolidatedOperationManager.queueLayoutOperation(
        'test-layout-with-autofit',
        mockLayoutCallback,
        { triggerAutoFit: true }
      );

      // Then request autofit
      consolidatedOperationManager.requestAutoFit(mockFitView, undefined, 'test-autofit');

      await layoutPromise;

      // Wait for autofit to be scheduled and executed
      await new Promise(resolve => setTimeout(resolve, 350)); // Wait longer than autofit delay

      expect(mockLayoutCallback).toHaveBeenCalledOnce();
      expect(mockFitView).toHaveBeenCalledOnce();
    });
  });

  describe('ReactFlow Operations', () => {
    it('should queue ReactFlow updates', () => {
      const mockSetter = vi.fn();
      const testData = { nodes: [], edges: [] };

      const operationId = consolidatedOperationManager.queueReactFlowUpdate(
        mockSetter,
        testData,
        'test-layout',
        'normal'
      );

      expect(operationId).toBeTruthy();
      expect(typeof operationId).toBe('string');
    });

    it('should batch ReactFlow operations', async () => {
      const mockSetter = vi.fn();
      const testData1 = { nodes: [{ id: '1' }], edges: [] };
      const testData2 = { nodes: [{ id: '2' }], edges: [] };

      // Queue multiple operations rapidly
      consolidatedOperationManager.queueReactFlowUpdate(mockSetter, testData1, 'test-1', 'normal');
      consolidatedOperationManager.queueReactFlowUpdate(mockSetter, testData2, 'test-2', 'normal');

      // Wait for batching to complete
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(mockSetter).toHaveBeenCalledTimes(2);
    });
  });

  describe('Search Expansion Operations', () => {
    it('should queue search expansion with automatic autofit', async () => {
      const mockExpansionCallback = vi.fn().mockResolvedValue(undefined);
      const mockFitView = vi.fn();

      // Queue search expansion (should automatically trigger autofit)
      const expansionPromise = consolidatedOperationManager.queueSearchExpansion(
        'test-search-expansion',
        mockExpansionCallback
      );

      // Request autofit
      consolidatedOperationManager.requestAutoFit(mockFitView, undefined, 'search-autofit');

      await expansionPromise;

      // Wait for autofit (needs to be longer than autoFitDelayMs which is 500ms)
      await new Promise(resolve => setTimeout(resolve, 600));

      expect(mockExpansionCallback).toHaveBeenCalledOnce();
      expect(mockFitView).toHaveBeenCalledOnce();
    });
  });

  describe('Container Toggle Operations', () => {
    it('should queue container toggle with automatic autofit', async () => {
      const mockToggleCallback = vi.fn().mockResolvedValue(undefined);
      const mockFitView = vi.fn();

      // Queue container toggle (should automatically trigger autofit)
      const togglePromise = consolidatedOperationManager.queueContainerToggle(
        'test-container-toggle',
        mockToggleCallback
      );

      // Request autofit
      consolidatedOperationManager.requestAutoFit(mockFitView, undefined, 'toggle-autofit');

      await togglePromise;

      // Wait for autofit
      await new Promise(resolve => setTimeout(resolve, 350));

      expect(mockToggleCallback).toHaveBeenCalledOnce();
      expect(mockFitView).toHaveBeenCalledOnce();
    });
  });

  describe('AutoFit Coordination', () => {
    it('should debounce autofit requests', async () => {
      const mockFitView = vi.fn();

      // Make multiple rapid autofit requests
      consolidatedOperationManager.requestAutoFit(mockFitView, undefined, 'request-1');
      consolidatedOperationManager.requestAutoFit(mockFitView, undefined, 'request-2');
      consolidatedOperationManager.requestAutoFit(mockFitView, undefined, 'request-3');

      // Wait for debouncing to complete
      await new Promise(resolve => setTimeout(resolve, 350));

      // Should only execute once (the last request)
      expect(mockFitView).toHaveBeenCalledOnce();
    });
  });

  describe('Priority Handling', () => {
    it('should execute high priority operations first', async () => {
      const executionOrder: string[] = [];

      const lowPriorityOp = vi.fn().mockImplementation(() => {
        executionOrder.push('low');
        return Promise.resolve();
      });

      const highPriorityOp = vi.fn().mockImplementation(() => {
        executionOrder.push('high');
        return Promise.resolve();
      });

      const normalPriorityOp = vi.fn().mockImplementation(() => {
        executionOrder.push('normal');
        return Promise.resolve();
      });

      // Queue in reverse priority order
      await consolidatedOperationManager.queueLayoutOperation('low-op', lowPriorityOp, {
        priority: 'low',
      });
      await consolidatedOperationManager.queueLayoutOperation('normal-op', normalPriorityOp, {
        priority: 'normal',
      });
      await consolidatedOperationManager.queueLayoutOperation('high-op', highPriorityOp, {
        priority: 'high',
      });

      // Wait for all operations to complete
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(executionOrder).toEqual(['low', 'normal', 'high']);
    });
  });

  describe('Circuit Breaker', () => {
    it('should prevent excessive operations', async () => {
      const mockCallback = vi.fn().mockResolvedValue(undefined);

      // Try to queue many operations rapidly (more than circuit breaker limit)
      const promises = [];
      for (let i = 0; i < 35; i++) {
        promises.push(
          consolidatedOperationManager.queueLayoutOperation(`test-${i}`, mockCallback, {
            priority: 'normal',
          })
        );
      }

      const results = await Promise.all(promises);

      // Some operations should be blocked by circuit breaker
      const blockedCount = results.filter(result => result === false).length;
      expect(blockedCount).toBeGreaterThan(0);
    });
  });

  describe('Status Reporting', () => {
    it('should report current status', () => {
      const status = consolidatedOperationManager.getStatus();

      expect(status).toHaveProperty('isProcessing');
      expect(status).toHaveProperty('currentOperation');
      expect(status).toHaveProperty('queueLength');
      expect(status).toHaveProperty('pendingReactFlowOps');
      expect(status).toHaveProperty('pendingAutoFit');
      expect(status).toHaveProperty('stats');
    });
  });
});
