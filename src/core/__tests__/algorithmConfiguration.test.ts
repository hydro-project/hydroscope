import { describe, it, expect } from 'vitest';
import { VisualizationEngine } from '../VisualizationEngine';
import { VisualizationState } from '../VisualizationState';
import { ELKBridge } from '../../bridges/ELKBridge';

describe('Algorithm Configuration Consistency', () => {
  it('should default to layered algorithm in VisualizationEngine', () => {
    const visState = new VisualizationState();
    const engine = new VisualizationEngine(visState);

    // Check that the engine's internal config uses layered by default
    const config = (engine as any).config;
    expect(config.layoutConfig.algorithm).toBe('layered');
  });

  it('should default to layered algorithm in ELKBridge', () => {
    const bridge = new ELKBridge();

    // Check that the bridge's internal config uses layered by default
    const config = (bridge as any).layoutConfig;
    expect(config.algorithm).toBe('layered');
  });

  it('should respect explicit algorithm override', () => {
    const visState = new VisualizationState();
    const engine = new VisualizationEngine(visState, {
      layoutConfig: {
        algorithm: 'layered',
      },
    });

    // Check that explicit override works
    const config = (engine as any).config;
    expect(config.layoutConfig.algorithm).toBe('layered');
  });

  it('should allow ELKBridge algorithm override', () => {
    const bridge = new ELKBridge({ algorithm: 'force' });

    // Check that explicit override works for ELKBridge
    const config = (bridge as any).layoutConfig;
    expect(config.algorithm).toBe('force');
  });
});
