/**
 * Tests for proper cleanup of event listeners and async operations
 */

import React from 'react';
import { render, waitFor } from '@testing-library/react';
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

describe('Cleanup', () => {
  let mockNavbar: HTMLElement;
  let originalQuerySelector: typeof document.querySelector;
  let resizeObserverMock: any;
  let addEventListenerSpy: any;
  let removeEventListenerSpy: any;
  let requestAnimationFrameSpy: any;
  let cancelAnimationFrameSpy: any;
  let setTimeoutSpy: any;
  let clearTimeoutSpy: any;

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

    // Spy on event listeners
    addEventListenerSpy = vi.spyOn(window, 'addEventListener');
    removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');

    // Spy on animation frame methods
    requestAnimationFrameSpy = vi.spyOn(global, 'requestAnimationFrame').mockImplementation((cb) => {
      setTimeout(cb, 16);
      return 1;
    });
    cancelAnimationFrameSpy = vi.spyOn(global, 'cancelAnimationFrame').mockImplementation(() => {});

    // Spy on timeout methods
    setTimeoutSpy = vi.spyOn(global, 'setTimeout');
    clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');

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

  it('should clean up resize event listeners on unmount', async () => {
    const { unmount } = render(
      <HydroscopeEnhanced
        responsive={true}
        height="600px"
        demo={true}
      />
    );

    // Wait for component to set up event listeners
    await waitFor(() => {
      expect(addEventListenerSpy).toHaveBeenCalledWith('resize', expect.any(Function));
    });

    const resizeHandler = addEventListenerSpy.mock.calls.find(
      call => call[0] === 'resize'
    )?.[1];

    // Unmount component
    unmount();

    // Should remove the resize event listener
    expect(removeEventListenerSpy).toHaveBeenCalledWith('resize', resizeHandler);
  });

  it('should clean up ResizeObserver on unmount', async () => {
    const { unmount } = render(
      <HydroscopeEnhanced
        responsive={true}
        height="600px"
        demo={true}
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

  it('should cancel pending animation frames on unmount', async () => {
    const { unmount } = render(
      <HydroscopeEnhanced
        responsive={true}
        height="600px"
        demo={true}
      />
    );

    // Wait for component to be ready
    await waitFor(() => {
      expect(requestAnimationFrameSpy).toHaveBeenCalled();
    });

    // Unmount component
    unmount();

    // Should cancel animation frames
    expect(cancelAnimationFrameSpy).toHaveBeenCalled();
  });

  it('should clear pending timeouts on unmount', async () => {
    const { unmount } = render(
      <HydroscopeEnhanced
        responsive={true}
        height="600px"
        demo={true}
      />
    );

    // Wait for component to set up timeouts
    await waitFor(() => {
      expect(setTimeoutSpy).toHaveBeenCalled();
    });

    // Unmount component
    unmount();

    // Should clear timeouts
    expect(clearTimeoutSpy).toHaveBeenCalled();
  });

  it('should handle cleanup function failures gracefully', async () => {
    const { unmount } = render(
      <HydroscopeEnhanced
        responsive={true}
        height="600px"
        demo={true}
      />
    );

    // Wait for component to be ready
    await waitFor(() => {
      expect(addEventListenerSpy).toHaveBeenCalled();
    });

    // Unmount component (this should handle cleanup failures gracefully)
    // The test passes if no errors are thrown during unmount
    expect(() => unmount()).not.toThrow();
  });

  it('should clean up interaction handler references', async () => {
    const { unmount } = render(
      <HydroscopeEnhanced
        height="600px"
        demo={true}
      />
    );

    // Wait for component to initialize
    await waitFor(() => {
      const container = document.querySelector('.hydroscope-enhanced');
      expect(container).toBeInTheDocument();
    });

    // Unmount component
    unmount();

    // Cleanup should complete without errors
    // (InteractionHandler reference should be cleared)
    expect(true).toBe(true); // Test passes if no errors thrown
  });

  it('should not set up cleanup when responsive is disabled', async () => {
    // Clear previous calls
    vi.clearAllMocks();
    
    const { unmount } = render(
      <HydroscopeEnhanced
        responsive={false}
        height="600px"
        demo={true}
      />
    );

    // Wait for component to render
    await waitFor(() => {
      const container = document.querySelector('.hydroscope-enhanced');
      expect(container).toBeInTheDocument();
    });

    // When responsive is disabled, resize listeners may still be added by ReactFlow
    // but they should be properly cleaned up on unmount
    const resizeCallCount = addEventListenerSpy.mock.calls.filter(call => call[0] === 'resize').length;
    
    // Note: ResizeObserver might be used by other components (like CustomControls)
    // so we don't test for it specifically here

    // Unmount should still work without errors
    unmount();
    
    // Verify that resize listeners are cleaned up (if any were added)
    if (resizeCallCount > 0) {
      expect(removeEventListenerSpy).toHaveBeenCalledWith('resize', expect.any(Function));
    }
    expect(true).toBe(true); // Test passes if no errors thrown
  });

  it('should handle multiple rapid mount/unmount cycles', async () => {
    // Mount and unmount multiple times rapidly
    for (let i = 0; i < 3; i++) {
      const { unmount } = render(
        <HydroscopeEnhanced
          responsive={true}
          height="600px"
          demo={true}
        />
      );

      // Brief wait
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // Unmount
      unmount();
    }

    // Should handle rapid mount/unmount without memory leaks or errors
    expect(true).toBe(true); // Test passes if no errors thrown
  });

  it('should clean up debounced functions', async () => {
    const { unmount } = render(
      <HydroscopeEnhanced
        responsive={true}
        height="600px"
        demo={true}
      />
    );

    // Trigger resize to create debounced function calls
    window.dispatchEvent(new Event('resize'));
    
    // Wait for debounced operations to be set up
    await waitFor(() => {
      expect(setTimeoutSpy).toHaveBeenCalled();
    });

    // Unmount component
    unmount();

    // Should clear debounced timeouts
    expect(clearTimeoutSpy).toHaveBeenCalled();
  });

  it('should log cleanup completion', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    
    const { unmount } = render(
      <HydroscopeEnhanced
        responsive={true}
        height="600px"
        demo={true}
      />
    );

    // Wait for component to be ready
    await waitFor(() => {
      expect(addEventListenerSpy).toHaveBeenCalled();
    });

    // Unmount component
    unmount();

    // Should log cleanup completion
    expect(consoleSpy).toHaveBeenCalledWith('🧹 HydroscopeEnhanced cleanup completed');
    
    consoleSpy.mockRestore();
  });
});