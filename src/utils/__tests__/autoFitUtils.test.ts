/**
 * Test suite for autoFit utility functions
 */

import { describe, it, expect } from 'vitest';
import {
  shouldExecuteFitView,
  createFitViewOptions,
  createAutoFitOptions,
  AutoFitScenarios,
} from '../autoFitUtils.js';

describe('AutoFit Utilities', () => {
  describe('shouldExecuteFitView', () => {
    it('should return true when force is true regardless of autoFitEnabled', () => {
      expect(shouldExecuteFitView({ autoFitEnabled: false, force: true })).toBe(true);
      expect(shouldExecuteFitView({ autoFitEnabled: true, force: true })).toBe(true);
    });

    it('should respect autoFitEnabled when force is false', () => {
      expect(shouldExecuteFitView({ autoFitEnabled: true, force: false })).toBe(true);
      expect(shouldExecuteFitView({ autoFitEnabled: false, force: false })).toBe(false);
    });

    it('should respect autoFitEnabled when force is not specified', () => {
      expect(shouldExecuteFitView({ autoFitEnabled: true })).toBe(true);
      expect(shouldExecuteFitView({ autoFitEnabled: false })).toBe(false);
    });
  });

  describe('createFitViewOptions', () => {
    it('should create correct fitView options when autoFit is enabled', () => {
      const result = createFitViewOptions({ autoFitEnabled: true });
      expect(result).toEqual({
        fitView: true,
        fitViewOptions: undefined,
      });
    });

    it('should create correct fitView options when autoFit is disabled', () => {
      const result = createFitViewOptions({ autoFitEnabled: false });
      expect(result).toEqual({
        fitView: false,
        fitViewOptions: undefined,
      });
    });

    it('should include custom fitViewOptions', () => {
      const customOptions = { padding: 0.2, duration: 500 };
      const result = createFitViewOptions({
        autoFitEnabled: true,
        fitViewOptions: customOptions,
      });
      expect(result).toEqual({
        fitView: true,
        fitViewOptions: customOptions,
      });
    });

    it('should force fitView when force is true', () => {
      const result = createFitViewOptions({
        autoFitEnabled: false,
        force: true,
      });
      expect(result).toEqual({
        fitView: true,
        fitViewOptions: undefined,
      });
    });
  });

  describe('createAutoFitOptions', () => {
    it('should create options for forced scenarios', () => {
      const result = createAutoFitOptions(
        AutoFitScenarios.INITIAL_LOAD,
        false, // autoFit disabled
        { padding: 0.1 }
      );
      expect(result).toEqual({
        autoFitEnabled: false,
        force: true,
        fitViewOptions: { padding: 0.1 },
      });
    });

    it('should create options for non-forced scenarios', () => {
      const result = createAutoFitOptions(
        AutoFitScenarios.STYLE_CHANGE,
        true, // autoFit enabled
        { duration: 400 }
      );
      expect(result).toEqual({
        autoFitEnabled: true,
        force: false,
        fitViewOptions: { duration: 400 },
      });
    });
  });

  describe('AutoFitScenarios', () => {
    it('should have correct force settings for each scenario', () => {
      // Scenarios that should always fit
      expect(AutoFitScenarios.INITIAL_LOAD.force).toBe(true);
      expect(AutoFitScenarios.FILE_LOAD.force).toBe(true);
      expect(AutoFitScenarios.LAYOUT_ALGORITHM_CHANGE.force).toBe(true);

      // Scenarios that should respect autoFit setting
      expect(AutoFitScenarios.STYLE_CHANGE.force).toBe(false);
      expect(AutoFitScenarios.CONTAINER_OPERATION.force).toBe(false);
      expect(AutoFitScenarios.SEARCH_OPERATION.force).toBe(false);
    });
  });

  describe('Integration scenarios', () => {
    it('should handle initial load correctly (always fit)', () => {
      const autoFitOptions = createAutoFitOptions(AutoFitScenarios.INITIAL_LOAD, false);
      const fitViewOptions = createFitViewOptions(autoFitOptions);
      
      expect(fitViewOptions.fitView).toBe(true); // Should fit even when autoFit is disabled
    });

    it('should handle style changes correctly (respect setting)', () => {
      // When autoFit is enabled
      const enabledOptions = createAutoFitOptions(AutoFitScenarios.STYLE_CHANGE, true);
      const enabledFitView = createFitViewOptions(enabledOptions);
      expect(enabledFitView.fitView).toBe(true);

      // When autoFit is disabled
      const disabledOptions = createAutoFitOptions(AutoFitScenarios.STYLE_CHANGE, false);
      const disabledFitView = createFitViewOptions(disabledOptions);
      expect(disabledFitView.fitView).toBe(false);
    });

    it('should handle container operations correctly (respect setting)', () => {
      // When autoFit is enabled
      const enabledOptions = createAutoFitOptions(AutoFitScenarios.CONTAINER_OPERATION, true);
      const enabledFitView = createFitViewOptions(enabledOptions);
      expect(enabledFitView.fitView).toBe(true);

      // When autoFit is disabled
      const disabledOptions = createAutoFitOptions(AutoFitScenarios.CONTAINER_OPERATION, false);
      const disabledFitView = createFitViewOptions(disabledOptions);
      expect(disabledFitView.fitView).toBe(false);
    });
  });
});