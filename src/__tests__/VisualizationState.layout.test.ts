/**
 * Tests for VisualizationState layout state management
 * Following TDD approach: RED -> GREEN -> REFACTOR
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { VisualizationState } from '../core/VisualizationState.js';
import type { LayoutState } from '../types/core.js';

describe('VisualizationState Layout State Management', () => {
  let state: VisualizationState;

  beforeEach(() => {
    state = new VisualizationState();
  });

  describe('Layout Phase Tracking', () => {
    it('should initialize with initial phase', () => {
      const layoutState = state.getLayoutState();
      expect(layoutState.phase).toBe('initial');
      expect(layoutState.layoutCount).toBe(0);
      expect(layoutState.lastUpdate).toBeGreaterThan(0);
      expect(layoutState.error).toBeUndefined();
    });

    it('should update layout phase and timestamp', () => {
      const beforeUpdate = Date.now();
      
      state.setLayoutPhase('laying_out');
      
      const layoutState = state.getLayoutState();
      expect(layoutState.phase).toBe('laying_out');
      expect(layoutState.lastUpdate).toBeGreaterThanOrEqual(beforeUpdate);
    });

    it('should support all valid layout phases', () => {
      const phases: LayoutState['phase'][] = [
        'initial', 'laying_out', 'ready', 'rendering', 'displayed', 'error'
      ];

      for (const phase of phases) {
        state.setLayoutPhase(phase);
        expect(state.getLayoutState().phase).toBe(phase);
      }
    });

    it('should preserve other state when updating phase', () => {
      state.incrementLayoutCount();
      state.setLayoutError('test error');
      const originalCount = state.getLayoutState().layoutCount;
      const originalError = state.getLayoutState().error;

      state.setLayoutPhase('ready');

      const layoutState = state.getLayoutState();
      expect(layoutState.phase).toBe('ready');
      expect(layoutState.layoutCount).toBe(originalCount);
      expect(layoutState.error).toBe(originalError);
    });
  });

  describe('Layout Count Tracking', () => {
    it('should start with layout count of 0', () => {
      expect(state.getLayoutState().layoutCount).toBe(0);
      expect(state.isFirstLayout()).toBe(true);
    });

    it('should increment layout count', () => {
      state.incrementLayoutCount();
      expect(state.getLayoutState().layoutCount).toBe(1);
      expect(state.isFirstLayout()).toBe(false);
    });

    it('should track multiple layout increments', () => {
      for (let i = 1; i <= 5; i++) {
        state.incrementLayoutCount();
        expect(state.getLayoutState().layoutCount).toBe(i);
        expect(state.isFirstLayout()).toBe(false);
      }
    });

    it('should preserve other state when incrementing count', () => {
      state.setLayoutPhase('ready');
      state.setLayoutError('test error');
      const originalPhase = state.getLayoutState().phase;
      const originalError = state.getLayoutState().error;

      state.incrementLayoutCount();

      const layoutState = state.getLayoutState();
      expect(layoutState.layoutCount).toBe(1);
      expect(layoutState.phase).toBe(originalPhase);
      expect(layoutState.error).toBe(originalError);
    });
  });

  describe('Layout Error Handling', () => {
    it('should set layout error', () => {
      const errorMessage = 'Layout failed due to invalid configuration';
      state.setLayoutError(errorMessage);

      const layoutState = state.getLayoutState();
      expect(layoutState.error).toBe(errorMessage);
    });

    it('should clear layout error', () => {
      state.setLayoutError('test error');
      expect(state.getLayoutState().error).toBe('test error');

      state.clearLayoutError();
      expect(state.getLayoutState().error).toBeUndefined();
    });

    it('should preserve layout count when setting error', () => {
      state.setLayoutPhase('ready');
      state.incrementLayoutCount();
      const originalCount = state.getLayoutState().layoutCount;

      state.setLayoutError('test error');

      const layoutState = state.getLayoutState();
      expect(layoutState.error).toBe('test error');
      expect(layoutState.phase).toBe('error'); // Phase should be set to error
      expect(layoutState.layoutCount).toBe(originalCount); // Count should be preserved
    });

    it('should automatically set phase to error when setting error', () => {
      state.setLayoutPhase('laying_out');
      state.setLayoutError('Layout failed');

      const layoutState = state.getLayoutState();
      expect(layoutState.phase).toBe('error');
      expect(layoutState.error).toBe('Layout failed');
    });
  });

  describe('Layout Recovery', () => {
    it('should recover from error state', () => {
      state.setLayoutError('test error');
      expect(state.getLayoutState().phase).toBe('error');

      state.recoverFromLayoutError();

      const layoutState = state.getLayoutState();
      expect(layoutState.phase).toBe('initial');
      expect(layoutState.error).toBeUndefined();
    });

    it('should reset layout state completely', () => {
      state.setLayoutPhase('displayed');
      state.incrementLayoutCount();
      state.incrementLayoutCount();
      state.setLayoutError('test error');

      state.resetLayoutState();

      const layoutState = state.getLayoutState();
      expect(layoutState.phase).toBe('initial');
      expect(layoutState.layoutCount).toBe(0);
      expect(layoutState.error).toBeUndefined();
      expect(state.isFirstLayout()).toBe(true);
    });
  });

  describe('Layout State Immutability', () => {
    it('should return immutable layout state', () => {
      const layoutState1 = state.getLayoutState();
      const layoutState2 = state.getLayoutState();

      expect(layoutState1).not.toBe(layoutState2); // Different objects
      expect(layoutState1).toEqual(layoutState2); // Same content
    });

    it('should not allow external modification of layout state', () => {
      const layoutState = state.getLayoutState();
      const originalPhase = layoutState.phase;

      // Attempt to modify returned state
      (layoutState as any).phase = 'error';

      // Internal state should be unchanged
      expect(state.getLayoutState().phase).toBe(originalPhase);
    });
  });

  describe('Layout State Validation', () => {
    it('should validate layout state transitions', () => {
      // Valid transitions
      state.setLayoutPhase('laying_out');
      expect(() => state.setLayoutPhase('ready')).not.toThrow();
      
      state.setLayoutPhase('rendering');
      expect(() => state.setLayoutPhase('displayed')).not.toThrow();
    });

    it('should handle invalid phase transitions gracefully', () => {
      // This test ensures the system is robust even with unexpected transitions
      state.setLayoutPhase('displayed');
      expect(() => state.setLayoutPhase('laying_out')).not.toThrow();
    });
  });

  describe('Smart Collapse Integration', () => {
    it('should track first layout for smart collapse logic', () => {
      expect(state.isFirstLayout()).toBe(true);
      expect(state.shouldRunSmartCollapse()).toBe(true);

      state.incrementLayoutCount();
      expect(state.isFirstLayout()).toBe(false);
      expect(state.shouldRunSmartCollapse()).toBe(false);
    });

    it('should allow smart collapse override', () => {
      state.incrementLayoutCount(); // Not first layout
      expect(state.shouldRunSmartCollapse()).toBe(false);

      state.enableSmartCollapseForNextLayout();
      expect(state.shouldRunSmartCollapse()).toBe(true);

      // Should reset after checking
      expect(state.shouldRunSmartCollapse()).toBe(false);
    });

    it('should disable smart collapse after user operations', () => {
      expect(state.shouldRunSmartCollapse()).toBe(true);

      state.disableSmartCollapseForUserOperations();
      expect(state.shouldRunSmartCollapse()).toBe(false);

      // Even after incrementing layout count
      state.incrementLayoutCount();
      expect(state.shouldRunSmartCollapse()).toBe(false);
    });
  });
});