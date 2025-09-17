/**
 * @fileoverview LayoutOrchestrator Tests
 * 
 * Tests the centralized layout coordination system
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LayoutOrchestrator } from '../core/LayoutOrchestrator';
import { VisualizationState } from '../core/VisualizationState';
import { consolidatedOperationManager } from '../utils/consolidatedOperationManager';

// Mock the consolidatedOperationManager
vi.mock('../utils/consolidatedOperationManager', () => ({
  consolidatedOperationManager: {
    queueContainerToggle: vi.fn(),
    queueSearchExpansion: vi.fn(),
    queueLayoutOperation: vi.fn(),
    requestAutoFit: vi.fn(),
  },
}));

describe('LayoutOrchestrator', () => {
  let mockVisualizationState: any;
  let mockLayoutController: any;
  let mockAutoFitController: any;
  let orchestrator: LayoutOrchestrator;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock VisualizationState
    mockVisualizationState = {
      collapseAllContainers: vi.fn(),
      expandAllContainers: vi.fn(),
      collapseContainer: vi.fn(),
      expandContainer: vi.fn(),
      getContainer: vi.fn(),
      ensureVisibilityConsistency: vi.fn(),
    };

    // Mock LayoutController
    mockLayoutController = {
      refreshLayout: vi.fn().mockResolvedValue(undefined),
    };

    // Mock AutoFitController
    mockAutoFitController = {
      fitView: vi.fn(),
    };

    orchestrator = new LayoutOrchestrator(
      mockVisualizationState,
      mockLayoutController,
      mockAutoFitController
    );
  });

  describe('collapseAll', () => {
    it('should queue container toggle operation with pure state method', async () => {
      const mockQueueContainerToggle = vi.mocked(consolidatedOperationManager.queueContainerToggle);
      mockQueueContainerToggle.mockResolvedValue(true);

      await orchestrator.collapseAll();

      expect(mockQueueContainerToggle).toHaveBeenCalledWith(
        expect.stringMatching(/^orchestrator-collapse-all-\d+$/),
        expect.any(Function),
        'high'
      );

      // Execute the queued callback to verify it calls the right methods
      const queuedCallback = mockQueueContainerToggle.mock.calls[0][1];
      await queuedCallback();

      expect(mockVisualizationState.collapseAllContainers).toHaveBeenCalled();
      expect(mockLayoutController.refreshLayout).toHaveBeenCalledWith(true);
    });
  });

  describe('expandAll', () => {
    it('should queue container toggle operation with pure state method', async () => {
      const mockQueueContainerToggle = vi.mocked(consolidatedOperationManager.queueContainerToggle);
      mockQueueContainerToggle.mockResolvedValue(true);

      await orchestrator.expandAll();

      expect(mockQueueContainerToggle).toHaveBeenCalledWith(
        expect.stringMatching(/^orchestrator-expand-all-\d+$/),
        expect.any(Function),
        'high'
      );

      // Execute the queued callback to verify it calls the right methods
      const queuedCallback = mockQueueContainerToggle.mock.calls[0][1];
      await queuedCallback();

      expect(mockVisualizationState.expandAllContainers).toHaveBeenCalled();
      expect(mockLayoutController.refreshLayout).toHaveBeenCalledWith(true);
    });
  });

  describe('toggleContainer', () => {
    it('should collapse expanded container using pure method', async () => {
      const mockContainer = { id: 'test-container', collapsed: false };
      mockVisualizationState.getContainer.mockReturnValue(mockContainer);

      const mockQueueContainerToggle = vi.mocked(consolidatedOperationManager.queueContainerToggle);
      mockQueueContainerToggle.mockResolvedValue(true);

      await orchestrator.toggleContainer('test-container');

      expect(mockQueueContainerToggle).toHaveBeenCalledWith(
        expect.stringMatching(/^orchestrator-toggle-test-container-\d+$/),
        expect.any(Function),
        'normal'
      );

      // Execute the queued callback
      const queuedCallback = mockQueueContainerToggle.mock.calls[0][1];
      await queuedCallback();

      expect(mockVisualizationState.collapseContainer).toHaveBeenCalledWith('test-container');
      expect(mockLayoutController.refreshLayout).toHaveBeenCalledWith(false);
    });

    it('should expand collapsed container using pure method', async () => {
      const mockContainer = { id: 'test-container', collapsed: true };
      mockVisualizationState.getContainer.mockReturnValue(mockContainer);

      const mockQueueContainerToggle = vi.mocked(consolidatedOperationManager.queueContainerToggle);
      mockQueueContainerToggle.mockResolvedValue(true);

      await orchestrator.toggleContainer('test-container');

      // Execute the queued callback
      const queuedCallback = mockQueueContainerToggle.mock.calls[0][1];
      await queuedCallback();

      expect(mockVisualizationState.expandContainer).toHaveBeenCalledWith('test-container');
      expect(mockLayoutController.refreshLayout).toHaveBeenCalledWith(true);
    });

    it('should handle non-existent container gracefully', async () => {
      mockVisualizationState.getContainer.mockReturnValue(null);

      await orchestrator.toggleContainer('non-existent');

      // Should not queue any operations
      expect(consolidatedOperationManager.queueContainerToggle).not.toHaveBeenCalled();
    });
  });

  describe('toggleContainersBatch', () => {
    it('should handle batch toggle operations efficiently', async () => {
      const containerIds = ['container1', 'container2', 'container3'];
      
      // Mock containers with different states
      mockVisualizationState.getContainer
        .mockReturnValueOnce({ id: 'container1', collapsed: false })
        .mockReturnValueOnce({ id: 'container2', collapsed: true })
        .mockReturnValueOnce({ id: 'container3', collapsed: false });

      const mockQueueContainerToggle = vi.mocked(consolidatedOperationManager.queueContainerToggle);
      mockQueueContainerToggle.mockResolvedValue(true);

      await orchestrator.toggleContainersBatch(containerIds);

      expect(mockQueueContainerToggle).toHaveBeenCalledWith(
        expect.stringMatching(/^orchestrator-batch-toggle-\d+$/),
        expect.any(Function),
        'normal'
      );

      // Execute the queued callback
      const queuedCallback = mockQueueContainerToggle.mock.calls[0][1];
      await queuedCallback();

      // Should call original methods for each container based on their state
      expect(mockVisualizationState.collapseContainer).toHaveBeenCalledWith('container1');
      expect(mockVisualizationState.expandContainer).toHaveBeenCalledWith('container2');
      expect(mockVisualizationState.collapseContainer).toHaveBeenCalledWith('container3');
      
      // Should trigger layout refresh with force=true for multiple containers
      expect(mockLayoutController.refreshLayout).toHaveBeenCalledWith(true);
    });

    it('should handle empty container list gracefully', async () => {
      await orchestrator.toggleContainersBatch([]);

      // Should not queue any operations
      expect(consolidatedOperationManager.queueContainerToggle).not.toHaveBeenCalled();
    });
  });

  describe('expandForSearch', () => {
    it('should queue search expansion operation', async () => {
      const containerIds = ['container1', 'container2'];
      const searchQuery = 'test search';

      const mockQueueSearchExpansion = vi.mocked(consolidatedOperationManager.queueSearchExpansion);
      mockQueueSearchExpansion.mockResolvedValue(true);

      await orchestrator.expandForSearch(containerIds, searchQuery);

      expect(mockQueueSearchExpansion).toHaveBeenCalledWith(
        expect.stringMatching(/^orchestrator-search-expand-\d+$/),
        expect.any(Function),
        'high'
      );

      // Execute the queued callback
      const queuedCallback = mockQueueSearchExpansion.mock.calls[0][1];
      await queuedCallback();

      expect(mockVisualizationState.expandContainer).toHaveBeenCalledWith('container1');
      expect(mockVisualizationState.expandContainer).toHaveBeenCalledWith('container2');
      expect(mockLayoutController.refreshLayout).toHaveBeenCalledWith(true);
    });
  });

  describe('requestAutoFit', () => {
    it('should request autofit through consolidated manager', () => {
      const mockRequestAutoFit = vi.mocked(consolidatedOperationManager.requestAutoFit);

      orchestrator.requestAutoFit('test-reason');

      expect(mockRequestAutoFit).toHaveBeenCalledWith(
        mockAutoFitController.fitView,
        undefined,
        'orchestrator-test-reason'
      );
    });

    it('should handle missing autofit controller gracefully', () => {
      const orchestratorWithoutAutoFit = new LayoutOrchestrator(
        mockVisualizationState,
        mockLayoutController
        // No autoFitController
      );

      // Should not throw
      expect(() => {
        orchestratorWithoutAutoFit.requestAutoFit('test-reason');
      }).not.toThrow();

      expect(consolidatedOperationManager.requestAutoFit).not.toHaveBeenCalled();
    });
  });

  describe('refreshLayout', () => {
    it('should queue layout operation through consolidated manager', async () => {
      const mockQueueLayoutOperation = vi.mocked(consolidatedOperationManager.queueLayoutOperation);
      mockQueueLayoutOperation.mockResolvedValue(true);

      await orchestrator.refreshLayout(true, 'test-reason');

      expect(mockQueueLayoutOperation).toHaveBeenCalledWith(
        expect.stringMatching(/^orchestrator-layout-\d+$/),
        expect.any(Function),
        {
          priority: 'high',
          reason: 'test-reason',
          triggerAutoFit: true,
          force: true,
        }
      );

      // Execute the queued callback
      const queuedCallback = mockQueueLayoutOperation.mock.calls[0][1];
      await queuedCallback();

      expect(mockLayoutController.refreshLayout).toHaveBeenCalledWith(true);
    });
  });
});