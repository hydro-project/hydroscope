import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, fireEvent, screen, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { InfoPanel } from '../components/InfoPanel';
import { createVisualizationState } from '../core/VisualizationState';

// Minimal mock for required props
function buildState() {
  const state = createVisualizationState()
    .setGraphNode('n1', { label: 'alpha' })
    .setGraphNode('n2', { label: 'beta' })
    .setGraphNode('n3', { label: 'gamma' })
    .setContainer('root', { children: ['n1', 'n2'], collapsed: true })
    .setContainer('child', { children: ['n3'], collapsed: true });
  state.addContainerChild('root', 'child');
  return state;
}

describe('InfoPanel + HierarchyTree search integration', () => {
  let state: any;

  beforeEach(() => {
    state = buildState();
  });

  it('expands matched container and its ancestors when searching container label', async () => {
    const onSearchUpdate = vi.fn();
    const { container } = render(
      <InfoPanel
        visualizationState={state}
        legendData={{ title: 'Legend', items: [] }}
        edgeStyleConfig={undefined}
        hierarchyChoices={[]}
        currentGrouping={null}
        onGroupingChange={() => {}}
        collapsedContainers={new Set(['root', 'child'])}
        onToggleContainer={async (id: string) => {
          const container = state.getContainer(id);
          if (container) {
            if (container.collapsed) {
              state.expandContainer(id);
            } else {
              state.collapseContainer(id);
            }
            // Note: In a real app this would call refreshLayout(), but in tests we just need the state change
          }
        }}
        colorPalette={'Set3'}
        open={true}
        onSearchUpdate={onSearchUpdate}
      />
    );

    // Locate search input (placeholder should be present)
    const input = container.querySelector('input');
    expect(input).toBeTruthy();

    // Type partial match for 'child'
    await act(async () => {
      fireEvent.change(input as HTMLInputElement, { target: { value: 'child' } });
    });

    // Wait for debounced search (150ms) + globalLayoutLock queue processing + buffer
    await act(async () => {
      await new Promise(res => setTimeout(res, 300));
    });

    expect(onSearchUpdate).toHaveBeenCalled();
    // After search expansion logic, the child container should be expanded => collapsed flag false
    const childContainer = state.getContainer('child');
    expect(childContainer?.collapsed).toBe(false);
    const rootContainer = state.getContainer('root');
    expect(rootContainer?.collapsed).toBe(false);
  });

  it('expands ancestors for node search', async () => {
    const onSearchUpdate = vi.fn();
    const { container } = render(
      <InfoPanel
        visualizationState={state}
        legendData={{ title: 'Legend', items: [] }}
        edgeStyleConfig={undefined}
        hierarchyChoices={[]}
        currentGrouping={null}
        onGroupingChange={() => {}}
        collapsedContainers={new Set(['root', 'child'])}
        onToggleContainer={async (id: string) => {
          const container = state.getContainer(id);
          if (container) {
            if (container.collapsed) {
              state.expandContainer(id);
            } else {
              state.collapseContainer(id);
            }
            // Note: In a real app this would call refreshLayout(), but in tests we just need the state change
          }
        }}
        colorPalette={'Set3'}
        open={true}
        onSearchUpdate={onSearchUpdate}
      />
    );

    const input = container.querySelector('input');
    await act(async () => {
      fireEvent.change(input as HTMLInputElement, { target: { value: 'gamma' } });
    });
    // Wait for the async search expansion to complete (globalLayoutLock queue processing)
    await act(async () => { 
      await new Promise(res => setTimeout(res, 400)); // Increased wait time to match first test
      await new Promise(res => requestAnimationFrame(res)); // Wait for any remaining async operations
    });
    
    // Debug: Check if onSearchUpdate was called
    console.log('onSearchUpdate called:', onSearchUpdate.mock.calls.length);
    if (onSearchUpdate.mock.calls.length > 0) {
      console.log('Search matches:', onSearchUpdate.mock.calls[0][1]);
    }
    
    const childContainer = state.getContainer('child');
    const rootContainer = state.getContainer('root');
    expect(childContainer?.collapsed).toBe(false);
    expect(rootContainer?.collapsed).toBe(false);
  });
});
