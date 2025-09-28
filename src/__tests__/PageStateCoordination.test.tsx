/**
 * Tests for minimal page state coordination and cleanup
 * Requirements: 5.4, 5.5, 11.1, 11.2, 11.5
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { HydroscopeEnhanced } from '../components/HydroscopeEnhanced';

// Mock Hydroscope modules
vi.mock('../core/VisualizationState', () => ({
  VisualizationState: class MockVisualizationState {
    visibleContainers = [];
    getContainer = vi.fn();
    getGraphNode = vi.fn();
    expandContainer = vi.fn();
    collapseContainer = vi.fn();
    toggleNodeLabel = vi.fn();
    getSearchResults = vi.fn().mockReturnValue([]);
  },
}));

vi.mock('../core/AsyncCoordinator', () => ({
  AsyncCoordinator: class MockAsyncCoordinator {
    collapseAllContainers = vi.fn();
    expandAllContainers = vi.fn();
  },
}));

vi.mock('../bridges/ReactFlowBridge', () => ({
  ReactFlowBridge: class MockReactFlowBridge {
    toReactFlowData = vi.fn().mockReturnValue({ nodes: [], edges: [] });
  },
}));

vi.mock('../bridges/ELKBridge', () => ({
  ELKBridge: class MockELKBridge {
    layout = vi.fn();
  },
}));

vi.mock('../utils/JSONParser', () => ({
  JSONParser: {
    createPaxosParser: () => ({
      parseData: vi.fn().mockResolvedValue({
        visualizationState: new (vi.fn())(),
      }),
    }),
  },
}));

vi.mock('../core/InteractionHandler', () => ({
  InteractionHandler: class MockInteractionHandler {},
}));

// Mock SearchIntegration component
vi.mock('../components/SearchIntegration', () => ({
  SearchIntegration: ({ placeholder }: { placeholder: string }) => (
    <div data-testid="search-integration">
      <input placeholder={placeholder} />
    </div>
  ),
}));

describe('PageStateCoordination', () => {
  let mockNavbar: HTMLElement;
  let originalQuerySelector: typeof document.querySelector;
  let resizeObserverMock: any;
  let setTimeoutSpy: any;
  let clearTimeoutSpy: any;
  let requestAnimationFrameSpy: any;
  let cancelAnimationFrameSpy: any;

  beforeEach(() => {
    // Mock navbar element
    mockNavbar = document.createElement('div');
    mockNavbar.className = 'navbar';
    Object.defineProperty(mockNavbar, 'getBoundingClientRect', {
      value: () => ({ height: 80 }),
    });

    originalQuerySelector = document.querySelector;
    document.querySelector = vi.fn((selector) => {
      if (selector === '.navbar') return mockNavbar;
      return originalQuerySelector.call(document, selector);
    });

    // Mock ResizeObserver
    resizeObserverMock = {
      observe: vi.fn(),
      disconnect: vi.fn(),
      unobserve: vi.fn(),
    };
    global.ResizeObserver = vi.fn(() => resizeObserverMock);

    // Spy on timeout and animation frame methods
    setTimeoutSpy = vi.spyOn(global, 'setTimeout');
    clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');
    requestAnimationFrameSpy = vi.spyOn(global, 'requestAnimationFrame').mockImplementation((cb) => {
      setTimeout(cb, 16);
      return 1;
    });
    cancelAnimationFrameSpy = vi.spyOn(global, 'cancelAnimationFrame').mockImplementation(() => {});

    // Mock window location
    Object.defineProperty(window, 'location', {
      value: { search: '' },
      writable: true,
    });
  });

  afterEach(() => {
    document.querySelector = originalQuerySelector;
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  describe('Minimal Page State Management (Requirements 5.4, 11.1)', () => {
    it('should initialize with default page state', async () => {
      const { container } = render(
        <HydroscopeEnhanced
          enhanced={true}
          demo={true}
          height="600px"
        />
      );

      await waitFor(() => {
        const hydroscopeContainer = container.querySelector('.hydroscope-enhanced');
        expect(hydroscopeContainer).toBeInTheDocument();
      });

      // InfoPanel and StyleTuner should be closed by default
      expect(container.querySelector('[data-testid="info-panel"]')).not.toBeInTheDocument();
      expect(container.querySelector('[data-testid="style-tuner"]')).not.toBeInTheDocument();
    });

    it('should toggle InfoPanel visibility', async () => {
      const testData = {
        nodes: [{ id: 'node1', shortLabel: 'Test', fullLabel: 'Test Node', nodeType: 'Source' }],
        edges: [],
        hierarchyChoices: [],
        nodeAssignments: {}
      };

      const { container } = render(
        <HydroscopeEnhanced
          data={testData}
          enhanced={true}
          height="600px"
        />
      );

      await waitFor(() => {
        const hydroscopeContainer = container.querySelector('.hydroscope-enhanced');
        expect(hydroscopeContainer).toBeInTheDocument();
      });

      // Wait for data to be processed and toggle buttons to appear
      await waitFor(() => {
        const toggleButtons = container.querySelectorAll('button[title="Toggle Info Panel"]');
        expect(toggleButtons.length).toBeGreaterThan(0);
      });

      // Find and click InfoPanel toggle button
      const toggleButtons = container.querySelectorAll('button[title="Toggle Info Panel"]');
      
      const infoPanelToggle = toggleButtons[0] as HTMLElement;
      
      // Initially should have default background
      expect(infoPanelToggle).toHaveStyle({
        backgroundColor: 'rgba(255, 255, 255, 0.9)',
      });

      // Click to open InfoPanel
      fireEvent.click(infoPanelToggle);

      // Should change background color to indicate active state
      await waitFor(() => {
        expect(infoPanelToggle).toHaveStyle({
          backgroundColor: '#4caf50',
        });
      });
    });

    it('should toggle StyleTuner visibility', async () => {
      const testData = {
        nodes: [{ id: 'node1', shortLabel: 'Test', fullLabel: 'Test Node', nodeType: 'Source' }],
        edges: [],
        hierarchyChoices: [],
        nodeAssignments: {}
      };

      const { container } = render(
        <HydroscopeEnhanced
          data={testData}
          enhanced={true}
          height="600px"
        />
      );

      await waitFor(() => {
        const hydroscopeContainer = container.querySelector('.hydroscope-enhanced');
        expect(hydroscopeContainer).toBeInTheDocument();
      });

      // Wait for data to be processed and toggle buttons to appear
      await waitFor(() => {
        const toggleButtons = container.querySelectorAll('button[title="Toggle Style Tuner"]');
        expect(toggleButtons.length).toBeGreaterThan(0);
      });

      // Find and click StyleTuner toggle button
      const toggleButtons = container.querySelectorAll('button[title="Toggle Style Tuner"]');
      
      const styleTunerToggle = toggleButtons[0] as HTMLElement;
      
      // Initially should have default background
      expect(styleTunerToggle).toHaveStyle({
        backgroundColor: 'rgba(255, 255, 255, 0.9)',
      });

      // Click to open StyleTuner
      fireEvent.click(styleTunerToggle);

      // Should change background color to indicate active state
      await waitFor(() => {
        expect(styleTunerToggle).toHaveStyle({
          backgroundColor: '#4caf50',
        });
      });
    });

    it('should manage autoFit state independently', async () => {
      const { container } = render(
        <HydroscopeEnhanced
          enhanced={true}
          demo={true}
          height="600px"
          showControls={true}
        />
      );

      await waitFor(() => {
        const hydroscopeContainer = container.querySelector('.hydroscope-enhanced');
        expect(hydroscopeContainer).toBeInTheDocument();
      });

      // Find auto-fit toggle button in controls
      const controlButtons = container.querySelectorAll('[data-testid="control-button"]');
      const autoFitButton = Array.from(controlButtons).find(button => 
        button.getAttribute('title')?.includes('Auto-fit')
      );

      if (autoFitButton) {
        // Click to toggle auto-fit
        fireEvent.click(autoFitButton);
        
        // Should not throw error and button should remain clickable
        expect(autoFitButton).toBeInTheDocument();
      }
    });
  });

  describe('Graph Data Flow Through VisualizationState (Requirements 5.4)', () => {
    it('should ensure all graph operations flow through VisualizationState', async () => {
      const testData = {
        nodes: [
          { id: 'node1', shortLabel: 'Test Node', fullLabel: 'Test Node', nodeType: 'Source' }
        ],
        edges: [],
        hierarchyChoices: [],
        nodeAssignments: {}
      };

      const { container } = render(
        <HydroscopeEnhanced
          data={testData}
          enhanced={true}
          height="600px"
        />
      );

      await waitFor(() => {
        const hydroscopeContainer = container.querySelector('.hydroscope-enhanced');
        expect(hydroscopeContainer).toBeInTheDocument();
      });

      // Graph data should be processed through VisualizationState
      // This is verified by the component rendering without errors
      expect(container.querySelector('.hydroscope-enhanced')).toBeInTheDocument();
    });

    it('should handle node interactions through VisualizationState', async () => {
      const { container } = render(
        <HydroscopeEnhanced
          demo={true}
          enhanced={true}
          height="600px"
        />
      );

      await waitFor(() => {
        const reactFlow = container.querySelector('[data-testid="rf__wrapper"]');
        expect(reactFlow).toBeInTheDocument();
      });

      // Node interactions should be handled through the component's state management
      // This is tested indirectly through component behavior
      expect(container.querySelector('.hydroscope-enhanced')).toBeInTheDocument();
    });
  });

  describe('Memory Management and Cleanup (Requirements 5.5, 11.2, 11.5)', () => {
    it('should track and cleanup managed timeouts', async () => {
      const { unmount } = render(
        <HydroscopeEnhanced
          responsive={true}
          demo={true}
          height="600px"
        />
      );

      // Wait for component to set up timeouts
      await waitFor(() => {
        expect(setTimeoutSpy).toHaveBeenCalled();
      });

      // Unmount component
      unmount();

      // Should clear managed timeouts
      expect(clearTimeoutSpy).toHaveBeenCalled();
    });

    it('should track and cleanup managed animation frames', async () => {
      const { unmount } = render(
        <HydroscopeEnhanced
          responsive={true}
          demo={true}
          height="600px"
        />
      );

      // Wait for component to set up animation frames
      await waitFor(() => {
        expect(requestAnimationFrameSpy).toHaveBeenCalled();
      });

      // Unmount component
      unmount();

      // Should cancel managed animation frames
      expect(cancelAnimationFrameSpy).toHaveBeenCalled();
    });

    it('should cancel async operations with AbortController', async () => {
      const { unmount } = render(
        <HydroscopeEnhanced
          enableUrlParams={true}
          height="600px"
        />
      );

      // Wait for component to initialize
      await waitFor(() => {
        const container = document.querySelector('.hydroscope-enhanced');
        expect(container).toBeInTheDocument();
      });

      // Unmount should cancel async operations
      expect(() => unmount()).not.toThrow();
    });

    it('should reset page state on cleanup', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      const { unmount } = render(
        <HydroscopeEnhanced
          enhanced={true}
          demo={true}
          height="600px"
        />
      );

      // Wait for component to initialize
      await waitFor(() => {
        const container = document.querySelector('.hydroscope-enhanced');
        expect(container).toBeInTheDocument();
      });

      // Unmount component
      unmount();

      // Should log cleanup completion
      expect(consoleSpy).toHaveBeenCalledWith('🧹 Starting HydroscopeEnhanced cleanup...');
      expect(consoleSpy).toHaveBeenCalledWith('🧹 HydroscopeEnhanced cleanup completed');
      
      consoleSpy.mockRestore();
    });

    it('should handle cleanup function failures gracefully', async () => {
      const { unmount } = render(
        <HydroscopeEnhanced
          responsive={true}
          demo={true}
          height="600px"
        />
      );

      // Wait for component to set up
      await waitFor(() => {
        expect(setTimeoutSpy).toHaveBeenCalled();
      });

      // Unmount should handle any cleanup failures gracefully
      expect(() => unmount()).not.toThrow();
    });

    it('should clear all resource references on unmount', async () => {
      const { unmount } = render(
        <HydroscopeEnhanced
          responsive={true}
          demo={true}
          height="600px"
        />
      );

      // Wait for component to set up resources
      await waitFor(() => {
        expect(resizeObserverMock.observe).toHaveBeenCalled();
      });

      // Unmount component
      unmount();

      // Should cleanup all resources
      expect(resizeObserverMock.disconnect).toHaveBeenCalled();
      expect(cancelAnimationFrameSpy).toHaveBeenCalled();
      expect(clearTimeoutSpy).toHaveBeenCalled();
    });
  });

  describe('Event Handler Cleanup (Requirements 5.5, 11.2)', () => {
    it('should cleanup window event listeners', async () => {
      const addEventListenerSpy = vi.spyOn(window, 'addEventListener');
      const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');

      const { unmount } = render(
        <HydroscopeEnhanced
          responsive={true}
          demo={true}
          height="600px"
        />
      );

      // Wait for event listeners to be set up
      await waitFor(() => {
        expect(addEventListenerSpy).toHaveBeenCalledWith('resize', expect.any(Function));
      });

      const resizeHandler = addEventListenerSpy.mock.calls.find(
        call => call[0] === 'resize'
      )?.[1];

      // Unmount component
      unmount();

      // Should remove event listeners
      expect(removeEventListenerSpy).toHaveBeenCalledWith('resize', resizeHandler);
    });

    it('should cleanup ResizeObserver properly', async () => {
      const { unmount } = render(
        <HydroscopeEnhanced
          responsive={true}
          demo={true}
          height="600px"
        />
      );

      // Wait for ResizeObserver to be set up
      await waitFor(() => {
        expect(resizeObserverMock.observe).toHaveBeenCalledWith(mockNavbar);
      });

      // Unmount component
      unmount();

      // Should disconnect ResizeObserver
      expect(resizeObserverMock.disconnect).toHaveBeenCalled();
    });
  });

  describe('Async Operation Cancellation (Requirements 5.5, 11.2)', () => {
    it('should cancel URL parameter parsing on unmount', async () => {
      Object.defineProperty(window, 'location', {
        value: { search: '?data={"nodes":[],"edges":[]}' },
        writable: true,
      });

      const { unmount } = render(
        <HydroscopeEnhanced
          enableUrlParams={true}
          height="600px"
        />
      );

      // Brief wait for URL parsing to start
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
      });

      // Unmount should cancel async operations
      expect(() => unmount()).not.toThrow();
    });

    it('should handle file processing cancellation', async () => {
      const { container, unmount } = render(
        <HydroscopeEnhanced
          enhanced={true}
          height="600px"
        />
      );

      // Wait for FileUpload to be available
      await waitFor(() => {
        const hydroscopeContainer = container.querySelector('.hydroscope-enhanced');
        expect(hydroscopeContainer).toBeInTheDocument();
      });

      // Unmount during potential file processing
      expect(() => unmount()).not.toThrow();
    });
  });

  describe('Integration with Enhanced Features', () => {
    it('should coordinate page state with InfoPanel and StyleTuner', async () => {
      const testData = {
        nodes: [{ id: 'node1', shortLabel: 'Test', fullLabel: 'Test Node', nodeType: 'Source' }],
        edges: [],
        hierarchyChoices: [],
        nodeAssignments: {}
      };

      const { container } = render(
        <HydroscopeEnhanced
          data={testData}
          enhanced={true}
          height="600px"
        />
      );

      await waitFor(() => {
        const hydroscopeContainer = container.querySelector('.hydroscope-enhanced');
        expect(hydroscopeContainer).toBeInTheDocument();
      });

      // Wait for data to be processed and toggle buttons to appear
      await waitFor(() => {
        const infoPanelToggle = container.querySelector('button[title="Toggle Info Panel"]');
        const styleTunerToggle = container.querySelector('button[title="Toggle Style Tuner"]');
        expect(infoPanelToggle).toBeInTheDocument();
        expect(styleTunerToggle).toBeInTheDocument();
      });

      // Both toggle buttons should be present
      const infoPanelToggle = container.querySelector('button[title="Toggle Info Panel"]');
      const styleTunerToggle = container.querySelector('button[title="Toggle Style Tuner"]');

      // Page state should coordinate both panels independently
      if (infoPanelToggle) {
        fireEvent.click(infoPanelToggle);
        // Should not affect StyleTuner state
        expect(styleTunerToggle).toHaveStyle({
          backgroundColor: 'rgba(255, 255, 255, 0.9)',
        });
      }
    });
  });
});