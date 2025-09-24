/**
 * ContainerControls Component Tests
 * Tests container expand/collapse UI components with proper state management
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { 
  ContainerControls, 
  IndividualContainerControl,
  useContainerControls 
} from '../components/ContainerControls.js';
import type { VisualizationState } from '../core/VisualizationState.js';
import type { AsyncCoordinator } from '../core/AsyncCoordinator.js';
import type { Container } from '../types/core.js';

// Mock the core modules
const mockVisualizationState = {
  visibleContainers: [
    {
      id: 'container1',
      label: 'Container 1',
      children: new Set(['node1', 'node2']),
      collapsed: true,
      hidden: false
    },
    {
      id: 'container2',
      label: 'Container 2',
      children: new Set(['node3', 'node4', 'node5']),
      collapsed: false,
      hidden: false
    },
    {
      id: 'container3',
      label: 'Container 3',
      children: new Set(['node6']),
      collapsed: true,
      hidden: false
    }
  ],
  getContainer: vi.fn()
} as unknown as VisualizationState;

const mockAsyncCoordinator = {
  expandAllContainers: vi.fn().mockResolvedValue(undefined),
  collapseAllContainers: vi.fn().mockResolvedValue(undefined),
  expandContainer: vi.fn().mockResolvedValue(undefined),
  collapseContainer: vi.fn().mockResolvedValue(undefined),
  getQueueStatus: vi.fn().mockReturnValue({
    pending: 0,
    processing: 0,
    completed: 0,
    failed: 0,
    totalProcessed: 0,
    averageProcessingTime: 0,
    errors: []
  }),
  getContainerOperationStatus: vi.fn().mockReturnValue({
    expandOperations: { queued: 0, processing: false, completed: 0, failed: 0 },
    collapseOperations: { queued: 0, processing: false, completed: 0, failed: 0 },
    bulkOperations: { queued: 0, processing: false, completed: 0, failed: 0 },
    lastError: undefined
  })
} as unknown as AsyncCoordinator;

describe('ContainerControls Component', () => {
  let mockOnOperationComplete: ReturnType<typeof vi.fn>;
  let mockOnError: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockOnOperationComplete = vi.fn();
    mockOnError = vi.fn();
    vi.clearAllMocks();
    
    // Reset mock implementations
    vi.mocked(mockVisualizationState.getContainer).mockImplementation((id: string) => {
      return mockVisualizationState.visibleContainers.find(c => c.id === id);
    });
  });

  describe('Basic Rendering', () => {
    it('should render expand and collapse buttons', () => {
      render(
        <ContainerControls
          visualizationState={mockVisualizationState}
          asyncCoordinator={mockAsyncCoordinator}
        />
      );

      expect(screen.getByText(/Expand All/)).toBeInTheDocument();
      expect(screen.getByText(/Collapse All/)).toBeInTheDocument();
    });

    it('should show correct container counts', () => {
      render(
        <ContainerControls
          visualizationState={mockVisualizationState}
          asyncCoordinator={mockAsyncCoordinator}
          showFeedback={true}
        />
      );

      expect(screen.getByText('Total: 3')).toBeInTheDocument();
      expect(screen.getByText('Expanded: 1')).toBeInTheDocument();
      expect(screen.getByText('Collapsed: 2')).toBeInTheDocument();
    });

    it('should disable buttons when no containers to operate on', () => {
      const emptyState = {
        ...mockVisualizationState,
        visibleContainers: []
      } as VisualizationState;

      render(
        <ContainerControls
          visualizationState={emptyState}
          asyncCoordinator={mockAsyncCoordinator}
        />
      );

      expect(screen.getByText(/Expand All/)).toBeDisabled();
      expect(screen.getByText(/Collapse All/)).toBeDisabled();
    });

    it('should disable buttons when disabled prop is true', () => {
      render(
        <ContainerControls
          visualizationState={mockVisualizationState}
          asyncCoordinator={mockAsyncCoordinator}
          disabled={true}
        />
      );

      expect(screen.getByText(/Expand All/)).toBeDisabled();
      expect(screen.getByText(/Collapse All/)).toBeDisabled();
    });
  });

  describe('Expand All Functionality', () => {
    it('should call expandAllContainers when expand all is clicked', async () => {
      render(
        <ContainerControls
          visualizationState={mockVisualizationState}
          asyncCoordinator={mockAsyncCoordinator}
          onOperationComplete={mockOnOperationComplete}
        />
      );

      const expandButton = screen.getByText(/Expand All/);
      
      await act(async () => {
        fireEvent.click(expandButton);
      });

      expect(mockAsyncCoordinator.expandAllContainers).toHaveBeenCalledWith(
        mockVisualizationState,
        { triggerLayout: true }
      );
      expect(mockOnOperationComplete).toHaveBeenCalledWith('expand');
    });

    it('should show loading state during expand all operation', async () => {
      // Mock a delayed operation
      vi.mocked(mockAsyncCoordinator.expandAllContainers).mockImplementation(
        () => new Promise(resolve => setTimeout(resolve, 100))
      );

      render(
        <ContainerControls
          visualizationState={mockVisualizationState}
          asyncCoordinator={mockAsyncCoordinator}
          showFeedback={true}
        />
      );

      const expandButton = screen.getByText(/Expand All/);
      
      act(() => {
        fireEvent.click(expandButton);
      });

      // Should show loading state
      expect(screen.getByText('Expanding...')).toBeInTheDocument();
      expect(expandButton).toBeDisabled();

      // Wait for operation to complete
      await waitFor(() => {
        expect(screen.queryByText('Expanding...')).not.toBeInTheDocument();
      });
    });

    it('should handle expand all errors gracefully', async () => {
      const error = new Error('Expand failed');
      vi.mocked(mockAsyncCoordinator.expandAllContainers).mockRejectedValue(error);

      render(
        <ContainerControls
          visualizationState={mockVisualizationState}
          asyncCoordinator={mockAsyncCoordinator}
          onError={mockOnError}
          showFeedback={true}
        />
      );

      const expandButton = screen.getByText(/Expand All/);
      
      await act(async () => {
        fireEvent.click(expandButton);
      });

      expect(mockOnError).toHaveBeenCalledWith(error, 'expand all');
      expect(screen.getByText('Error: Expand failed')).toBeInTheDocument();
    });

    it('should not expand when no collapsed containers exist', async () => {
      const allExpandedState = {
        ...mockVisualizationState,
        visibleContainers: mockVisualizationState.visibleContainers.map(c => ({
          ...c,
          collapsed: false
        }))
      } as VisualizationState;

      render(
        <ContainerControls
          visualizationState={allExpandedState}
          asyncCoordinator={mockAsyncCoordinator}
        />
      );

      const expandButton = screen.getByText(/Expand All \(0\)/);
      expect(expandButton).toBeDisabled();
    });
  });

  describe('Collapse All Functionality', () => {
    it('should call collapseAllContainers when collapse all is clicked', async () => {
      render(
        <ContainerControls
          visualizationState={mockVisualizationState}
          asyncCoordinator={mockAsyncCoordinator}
          onOperationComplete={mockOnOperationComplete}
        />
      );

      const collapseButton = screen.getByText(/Collapse All/);
      
      await act(async () => {
        fireEvent.click(collapseButton);
      });

      expect(mockAsyncCoordinator.collapseAllContainers).toHaveBeenCalledWith(
        mockVisualizationState,
        { triggerLayout: true }
      );
      expect(mockOnOperationComplete).toHaveBeenCalledWith('collapse');
    });

    it('should show loading state during collapse all operation', async () => {
      // Mock a delayed operation
      vi.mocked(mockAsyncCoordinator.collapseAllContainers).mockImplementation(
        () => new Promise(resolve => setTimeout(resolve, 100))
      );

      render(
        <ContainerControls
          visualizationState={mockVisualizationState}
          asyncCoordinator={mockAsyncCoordinator}
          showFeedback={true}
        />
      );

      const collapseButton = screen.getByText(/Collapse All/);
      
      act(() => {
        fireEvent.click(collapseButton);
      });

      // Should show loading state
      expect(screen.getByText('Collapsing...')).toBeInTheDocument();
      expect(collapseButton).toBeDisabled();

      // Wait for operation to complete
      await waitFor(() => {
        expect(screen.queryByText('Collapsing...')).not.toBeInTheDocument();
      });
    });

    it('should handle collapse all errors gracefully', async () => {
      const error = new Error('Collapse failed');
      vi.mocked(mockAsyncCoordinator.collapseAllContainers).mockRejectedValue(error);

      render(
        <ContainerControls
          visualizationState={mockVisualizationState}
          asyncCoordinator={mockAsyncCoordinator}
          onError={mockOnError}
          showFeedback={true}
        />
      );

      const collapseButton = screen.getByText(/Collapse All/);
      
      await act(async () => {
        fireEvent.click(collapseButton);
      });

      expect(mockOnError).toHaveBeenCalledWith(error, 'collapse all');
      expect(screen.getByText('Error: Collapse failed')).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('should display error messages when showFeedback is true', async () => {
      const error = new Error('Test error');
      vi.mocked(mockAsyncCoordinator.expandAllContainers).mockRejectedValue(error);

      render(
        <ContainerControls
          visualizationState={mockVisualizationState}
          asyncCoordinator={mockAsyncCoordinator}
          showFeedback={true}
        />
      );

      const expandButton = screen.getByText(/Expand All/);
      
      await act(async () => {
        fireEvent.click(expandButton);
      });

      expect(screen.getByText('Error: Test error')).toBeInTheDocument();
    });

    it('should allow clearing error messages', async () => {
      const error = new Error('Test error');
      vi.mocked(mockAsyncCoordinator.expandAllContainers).mockRejectedValue(error);

      render(
        <ContainerControls
          visualizationState={mockVisualizationState}
          asyncCoordinator={mockAsyncCoordinator}
          showFeedback={true}
        />
      );

      const expandButton = screen.getByText(/Expand All/);
      
      await act(async () => {
        fireEvent.click(expandButton);
      });

      expect(screen.getByText('Error: Test error')).toBeInTheDocument();

      const clearButton = screen.getByText('×');
      
      act(() => {
        fireEvent.click(clearButton);
      });

      expect(screen.queryByText('Error: Test error')).not.toBeInTheDocument();
    });
  });

  describe('Feedback Display', () => {
    it('should show operation counter when operations are performed', async () => {
      render(
        <ContainerControls
          visualizationState={mockVisualizationState}
          asyncCoordinator={mockAsyncCoordinator}
          showFeedback={true}
        />
      );

      const expandButton = screen.getByText(/Expand All/);
      
      await act(async () => {
        fireEvent.click(expandButton);
      });

      expect(screen.getByText('Operations: 1')).toBeInTheDocument();
    });

    it('should not show feedback when showFeedback is false', async () => {
      render(
        <ContainerControls
          visualizationState={mockVisualizationState}
          asyncCoordinator={mockAsyncCoordinator}
          showFeedback={false}
        />
      );

      // Should not show status section
      expect(screen.queryByText('Total:')).not.toBeInTheDocument();
    });
  });
});

describe('IndividualContainerControl Component', () => {
  const mockContainer: Container = {
    id: 'test-container',
    label: 'Test Container',
    children: new Set(['node1', 'node2']),
    collapsed: true,
    hidden: false
  };

  let mockOnOperationComplete: ReturnType<typeof vi.fn>;
  let mockOnError: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockOnOperationComplete = vi.fn();
    mockOnError = vi.fn();
    vi.clearAllMocks();
  });

  describe('Basic Rendering', () => {
    it('should render container information', () => {
      render(
        <IndividualContainerControl
          container={mockContainer}
          visualizationState={mockVisualizationState}
          asyncCoordinator={mockAsyncCoordinator}
        />
      );

      expect(screen.getByText('Test Container')).toBeInTheDocument();
      expect(screen.getByText('(2)')).toBeInTheDocument(); // Child count
      expect(screen.getByText('▶')).toBeInTheDocument(); // Collapsed icon
    });

    it('should show expanded icon for expanded containers', () => {
      const expandedContainer = { ...mockContainer, collapsed: false };

      render(
        <IndividualContainerControl
          container={expandedContainer}
          visualizationState={mockVisualizationState}
          asyncCoordinator={mockAsyncCoordinator}
        />
      );

      expect(screen.getByText('▼')).toBeInTheDocument(); // Expanded icon
    });

    it('should be disabled when disabled prop is true', () => {
      render(
        <IndividualContainerControl
          container={mockContainer}
          visualizationState={mockVisualizationState}
          asyncCoordinator={mockAsyncCoordinator}
          disabled={true}
        />
      );

      const button = screen.getByRole('button');
      expect(button).toBeDisabled();
    });
  });

  describe('Toggle Functionality', () => {
    it('should expand collapsed container when clicked', async () => {
      render(
        <IndividualContainerControl
          container={mockContainer}
          visualizationState={mockVisualizationState}
          asyncCoordinator={mockAsyncCoordinator}
          onOperationComplete={mockOnOperationComplete}
        />
      );

      const button = screen.getByRole('button');
      
      await act(async () => {
        fireEvent.click(button);
      });

      expect(mockAsyncCoordinator.expandContainer).toHaveBeenCalledWith(
        'test-container',
        mockVisualizationState,
        { triggerLayout: true }
      );
      expect(mockOnOperationComplete).toHaveBeenCalledWith('expand', 'test-container');
    });

    it('should collapse expanded container when clicked', async () => {
      const expandedContainer = { ...mockContainer, collapsed: false };

      render(
        <IndividualContainerControl
          container={expandedContainer}
          visualizationState={mockVisualizationState}
          asyncCoordinator={mockAsyncCoordinator}
          onOperationComplete={mockOnOperationComplete}
        />
      );

      const button = screen.getByRole('button');
      
      await act(async () => {
        fireEvent.click(button);
      });

      expect(mockAsyncCoordinator.collapseContainer).toHaveBeenCalledWith(
        'test-container',
        mockVisualizationState,
        { triggerLayout: true }
      );
      expect(mockOnOperationComplete).toHaveBeenCalledWith('collapse', 'test-container');
    });

    it('should show loading state during operation', async () => {
      // Mock a delayed operation
      vi.mocked(mockAsyncCoordinator.expandContainer).mockImplementation(
        () => new Promise(resolve => setTimeout(resolve, 100))
      );

      render(
        <IndividualContainerControl
          container={mockContainer}
          visualizationState={mockVisualizationState}
          asyncCoordinator={mockAsyncCoordinator}
          showLoading={true}
        />
      );

      const button = screen.getByRole('button');
      
      act(() => {
        fireEvent.click(button);
      });

      // Should show loading icon
      expect(screen.getByText('⟳')).toBeInTheDocument();
      expect(button).toBeDisabled();

      // Wait for operation to complete
      await waitFor(() => {
        expect(screen.queryByText('⟳')).not.toBeInTheDocument();
      });
    });

    it('should handle toggle errors gracefully', async () => {
      const error = new Error('Toggle failed');
      vi.mocked(mockAsyncCoordinator.expandContainer).mockRejectedValue(error);

      render(
        <IndividualContainerControl
          container={mockContainer}
          visualizationState={mockVisualizationState}
          asyncCoordinator={mockAsyncCoordinator}
          onError={mockOnError}
        />
      );

      const button = screen.getByRole('button');
      
      await act(async () => {
        fireEvent.click(button);
      });

      expect(mockOnError).toHaveBeenCalledWith(error, 'toggle container test-container');
      expect(screen.getByText('Toggle failed')).toBeInTheDocument();
    });

    it('should allow clearing individual errors', async () => {
      const error = new Error('Toggle failed');
      vi.mocked(mockAsyncCoordinator.expandContainer).mockRejectedValue(error);

      render(
        <IndividualContainerControl
          container={mockContainer}
          visualizationState={mockVisualizationState}
          asyncCoordinator={mockAsyncCoordinator}
        />
      );

      const button = screen.getByRole('button');
      
      await act(async () => {
        fireEvent.click(button);
      });

      expect(screen.getByText('Toggle failed')).toBeInTheDocument();

      const clearButton = screen.getByText('×');
      
      act(() => {
        fireEvent.click(clearButton);
      });

      expect(screen.queryByText('Toggle failed')).not.toBeInTheDocument();
    });
  });
});

describe('useContainerControls Hook', () => {
  // Test component to use the hook
  const TestComponent: React.FC = () => {
    const {
      expandAll,
      collapseAll,
      toggleContainer,
      isExpanding,
      isCollapsing,
      operatingContainers,
      lastError,
      clearError
    } = useContainerControls(mockVisualizationState, mockAsyncCoordinator);

    return (
      <div>
        <button onClick={expandAll} disabled={isExpanding}>
          {isExpanding ? 'Expanding...' : 'Expand All'}
        </button>
        <button onClick={collapseAll} disabled={isCollapsing}>
          {isCollapsing ? 'Collapsing...' : 'Collapse All'}
        </button>
        <button onClick={() => toggleContainer('test-container')}>
          Toggle Container
        </button>
        {operatingContainers.has('test-container') && (
          <div>Operating on test-container</div>
        )}
        {lastError && (
          <div>
            <span>Error: {lastError.message}</span>
            <button onClick={clearError}>Clear</button>
          </div>
        )}
      </div>
    );
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should provide expand all functionality', async () => {
    render(<TestComponent />);

    const expandButton = screen.getByText('Expand All');
    
    await act(async () => {
      fireEvent.click(expandButton);
    });

    expect(mockAsyncCoordinator.expandAllContainers).toHaveBeenCalledWith(
      mockVisualizationState
    );
  });

  it('should provide collapse all functionality', async () => {
    render(<TestComponent />);

    const collapseButton = screen.getByText('Collapse All');
    
    await act(async () => {
      fireEvent.click(collapseButton);
    });

    expect(mockAsyncCoordinator.collapseAllContainers).toHaveBeenCalledWith(
      mockVisualizationState
    );
  });

  it('should provide toggle container functionality', async () => {
    vi.mocked(mockVisualizationState.getContainer).mockReturnValue({
      id: 'test-container',
      label: 'Test',
      children: new Set(),
      collapsed: true,
      hidden: false
    });

    render(<TestComponent />);

    const toggleButton = screen.getByText('Toggle Container');
    
    await act(async () => {
      fireEvent.click(toggleButton);
    });

    expect(mockAsyncCoordinator.expandContainer).toHaveBeenCalledWith(
      'test-container',
      mockVisualizationState
    );
  });

  it('should handle errors and provide error clearing', async () => {
    const error = new Error('Hook test error');
    vi.mocked(mockAsyncCoordinator.expandAllContainers).mockRejectedValue(error);

    render(<TestComponent />);

    const expandButton = screen.getByText('Expand All');
    
    await act(async () => {
      fireEvent.click(expandButton);
    });

    expect(screen.getByText('Error: Hook test error')).toBeInTheDocument();

    const clearButton = screen.getByText('Clear');
    
    act(() => {
      fireEvent.click(clearButton);
    });

    expect(screen.queryByText('Error: Hook test error')).not.toBeInTheDocument();
  });
});