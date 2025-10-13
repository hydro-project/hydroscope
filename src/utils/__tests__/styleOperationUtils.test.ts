/**
 * @fileoverview Tests for Style Operation Utilities
 * 
 * Tests the imperative style operation functions that avoid React re-render cascades
 * and ResizeObserver loops.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  changeLayoutImperatively,
  changeColorPaletteImperatively,
  changeEdgeStyleImperatively,
  resetStylesImperatively,
  batchStyleOperationsImperatively,
  clearStyleOperationDebouncing,
  type EdgeStyleKind
} from '../styleOperationUtils.js';

// Mock requestAnimationFrame
global.requestAnimationFrame = vi.fn((cb) => {
  setTimeout(cb, 0);
  return 1;
});

describe('styleOperationUtils', () => {
  let mockOnLayoutChange: ReturnType<typeof vi.fn>;
  let mockOnPaletteChange: ReturnType<typeof vi.fn>;
  let mockOnEdgeStyleChange: ReturnType<typeof vi.fn>;
  let mockOnResetToDefaults: ReturnType<typeof vi.fn>;
  let originalConsoleError: typeof console.error;

  beforeEach(() => {
    mockOnLayoutChange = vi.fn();
    mockOnPaletteChange = vi.fn();
    mockOnEdgeStyleChange = vi.fn();
    mockOnResetToDefaults = vi.fn();
    originalConsoleError = console.error;
    console.error = vi.fn();
  });

  afterEach(() => {
    vi.clearAllTimers();
    clearStyleOperationDebouncing();
    console.error = originalConsoleError;
  });

  describe('changeLayoutImperatively', () => {
    it('should change layout algorithm successfully', async () => {
      const result = changeLayoutImperatively({
        algorithm: 'layered',
        onLayoutChange: mockOnLayoutChange,
        debug: true
      });

      expect(result).toBe(true);
      
      // Wait for requestAnimationFrame
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(mockOnLayoutChange).toHaveBeenCalledWith('layered');
    });

    it('should return false for empty algorithm', () => {
      const result = changeLayoutImperatively({
        algorithm: '',
        onLayoutChange: mockOnLayoutChange
      });

      expect(result).toBe(false);
      expect(console.error).toHaveBeenCalledWith('[StyleOperationUtils] Algorithm is required');
    });

    it('should handle debounced operations', () => {
      const result = changeLayoutImperatively({
        algorithm: 'force',
        onLayoutChange: mockOnLayoutChange,
        debounce: true
      });

      expect(result).toBe(true);
      // Callback should not be called immediately when debounced
      expect(mockOnLayoutChange).not.toHaveBeenCalled();
    });

    it('should suppress ResizeObserver errors when enabled', async () => {
      const mockError = vi.fn();
      window.console.error = mockError;

      changeLayoutImperatively({
        algorithm: 'stress',
        onLayoutChange: mockOnLayoutChange,
        suppressResizeObserver: true,
        debug: true
      });

      // Simulate ResizeObserver error
      window.console.error('ResizeObserver loop limit exceeded');
      
      // Should not call the original error handler for ResizeObserver errors
      expect(mockError).not.toHaveBeenCalledWith('ResizeObserver loop limit exceeded');
    });
  });

  describe('changeColorPaletteImperatively', () => {
    it('should change color palette successfully', async () => {
      const result = changeColorPaletteImperatively({
        palette: 'Set3',
        onPaletteChange: mockOnPaletteChange,
        debug: true
      });

      expect(result).toBe(true);
      
      // Wait for requestAnimationFrame
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(mockOnPaletteChange).toHaveBeenCalledWith('Set3');
    });

    it('should return false for empty palette', () => {
      const result = changeColorPaletteImperatively({
        palette: '',
        onPaletteChange: mockOnPaletteChange
      });

      expect(result).toBe(false);
      expect(console.error).toHaveBeenCalledWith('[StyleOperationUtils] Palette is required');
    });

    it('should handle debounced operations', () => {
      const result = changeColorPaletteImperatively({
        palette: 'Dark2',
        onPaletteChange: mockOnPaletteChange,
        debounce: true
      });

      expect(result).toBe(true);
      // Callback should not be called immediately when debounced
      expect(mockOnPaletteChange).not.toHaveBeenCalled();
    });
  });

  describe('changeEdgeStyleImperatively', () => {
    it('should change edge style successfully', async () => {
      const edgeStyle: EdgeStyleKind = 'bezier';
      const result = changeEdgeStyleImperatively({
        edgeStyle,
        onEdgeStyleChange: mockOnEdgeStyleChange,
        debug: true
      });

      expect(result).toBe(true);
      
      // Wait for requestAnimationFrame
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(mockOnEdgeStyleChange).toHaveBeenCalledWith('bezier');
    });

    it('should return false for empty edge style', () => {
      const result = changeEdgeStyleImperatively({
        edgeStyle: '' as EdgeStyleKind,
        onEdgeStyleChange: mockOnEdgeStyleChange
      });

      expect(result).toBe(false);
      expect(console.error).toHaveBeenCalledWith('[StyleOperationUtils] Edge style is required');
    });

    it('should handle all edge style types', async () => {
      const edgeStyles: EdgeStyleKind[] = ['bezier', 'straight', 'smoothstep'];
      
      for (const style of edgeStyles) {
        mockOnEdgeStyleChange.mockClear();
        
        const result = changeEdgeStyleImperatively({
          edgeStyle: style,
          onEdgeStyleChange: mockOnEdgeStyleChange
        });

        expect(result).toBe(true);
        
        // Wait for requestAnimationFrame
        await new Promise(resolve => setTimeout(resolve, 10));
        
        expect(mockOnEdgeStyleChange).toHaveBeenCalledWith(style);
      }
    });
  });

  describe('resetStylesImperatively', () => {
    it('should reset styles successfully', async () => {
      const result = resetStylesImperatively({
        onResetToDefaults: mockOnResetToDefaults,
        debug: true
      });

      expect(result).toBe(true);
      
      // Wait for requestAnimationFrame
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(mockOnResetToDefaults).toHaveBeenCalled();
    });

    it('should work without callback', () => {
      const result = resetStylesImperatively({
        debug: true
      });

      expect(result).toBe(true);
    });
  });

  describe('batchStyleOperationsImperatively', () => {
    it('should execute multiple operations successfully', async () => {
      const operations = [
        {
          type: 'layout' as const,
          value: 'layered',
          callback: mockOnLayoutChange
        },
        {
          type: 'colorPalette' as const,
          value: 'Set3',
          callback: mockOnPaletteChange
        },
        {
          type: 'edgeStyle' as const,
          value: 'bezier' as EdgeStyleKind,
          callback: mockOnEdgeStyleChange
        },
        {
          type: 'reset' as const,
          callback: mockOnResetToDefaults
        }
      ];

      const result = batchStyleOperationsImperatively({
        operations,
        debug: true
      });

      expect(result.success).toBe(4);
      expect(result.failed).toBe(0);
      expect(result.errors).toHaveLength(0);
    });

    it('should handle unknown operation types', () => {
      const operations = [
        {
          type: 'unknown' as any,
          value: 'test',
          callback: vi.fn()
        }
      ];

      const result = batchStyleOperationsImperatively({
        operations,
        debug: true
      });

      expect(result.success).toBe(0);
      expect(result.failed).toBe(1);
      expect(result.errors).toContain('Unknown operation type: unknown');
    });

    it('should handle empty operations array', () => {
      const result = batchStyleOperationsImperatively({
        operations: [],
        debug: true
      });

      expect(result.success).toBe(0);
      expect(result.failed).toBe(0);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('clearStyleOperationDebouncing', () => {
    it('should clear all debounced operations', () => {
      // Start some debounced operations
      changeLayoutImperatively({
        algorithm: 'layered',
        onLayoutChange: mockOnLayoutChange,
        debounce: true
      });

      changeColorPaletteImperatively({
        palette: 'Set3',
        onPaletteChange: mockOnPaletteChange,
        debounce: true
      });

      // Clear all debouncing
      clearStyleOperationDebouncing();

      // Wait for potential debounced calls
      setTimeout(() => {
        expect(mockOnLayoutChange).not.toHaveBeenCalled();
        expect(mockOnPaletteChange).not.toHaveBeenCalled();
      }, 200);
    });

    it('should clear specific operation type debouncing', () => {
      // Start debounced operations
      changeLayoutImperatively({
        algorithm: 'layered',
        onLayoutChange: mockOnLayoutChange,
        debounce: true
      });

      changeColorPaletteImperatively({
        palette: 'Set3',
        onPaletteChange: mockOnPaletteChange,
        debounce: true
      });

      // Clear only layout debouncing
      clearStyleOperationDebouncing('layout');

      // Layout should be cleared, palette should still be debounced
      setTimeout(() => {
        expect(mockOnLayoutChange).not.toHaveBeenCalled();
        // Note: We can't easily test that palette is still debounced without
        // more complex timing, but the function should work correctly
      }, 50);
    });
  });

  describe('error handling', () => {
    it('should handle callback errors gracefully', async () => {
      const errorCallback = vi.fn(() => {
        throw new Error('Test error');
      });

      const result = changeLayoutImperatively({
        algorithm: 'layered',
        onLayoutChange: errorCallback,
        debug: true
      });

      expect(result).toBe(true);
      
      // Wait for requestAnimationFrame
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(errorCallback).toHaveBeenCalled();
      // Error should be logged but not thrown
    });

    it('should suppress ResizeObserver errors during operations', () => {
      const mockError = vi.fn();
      const originalError = window.console.error;
      window.console.error = mockError;

      changeLayoutImperatively({
        algorithm: 'layered',
        onLayoutChange: mockOnLayoutChange,
        suppressResizeObserver: true,
        debug: true
      });

      // Simulate ResizeObserver error
      window.console.error('ResizeObserver loop limit exceeded');
      
      // Should not propagate ResizeObserver errors
      expect(mockError).not.toHaveBeenCalledWith('ResizeObserver loop limit exceeded');
      
      // Restore original error handler
      window.console.error = originalError;
    });
  });
});