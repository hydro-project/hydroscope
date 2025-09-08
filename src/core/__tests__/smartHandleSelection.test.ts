/**
 * Smart Handle Selection Tests
 * 
 * Validates that the intelligent handle selection algorithm chooses
 * appropriate handles based on node positions while remaining conservative
 * to avoid breaking hyperedges.
 */

import { describe, test, expect, beforeEach } from 'vitest';
import { VisualizationState } from '../VisualizationState';
import { ReactFlowBridge } from '../../bridges/ReactFlowBridge';

describe('Smart Handle Selection', () => {
    let visState: VisualizationState;
    let bridge: ReactFlowBridge;

    beforeEach(() => {
        visState = new VisualizationState();
        bridge = new ReactFlowBridge();
    });

    test('should prefer horizontal handles for side-by-side nodes', () => {
        // Setup: Nodes positioned horizontally with sufficient separation
        visState.setGraphNode('leftNode', {
            width: 120,
            height: 40,
            hidden: false
        });

        visState.setGraphNode('rightNode', {
            width: 120,
            height: 40,
            hidden: false
        });

        // Set positions using layout system
        visState.setNodeLayout('leftNode', {
            position: { x: 0, y: 100 },
            dimensions: { width: 120, height: 40 }
        });

        visState.setNodeLayout('rightNode', {
            position: { x: 300, y: 100 },
            dimensions: { width: 120, height: 40 }
        });

        visState.setGraphEdge('horizontalEdge', {
            source: 'leftNode',
            target: 'rightNode',
            hidden: false,
        });

        // Test: Should prefer right-to-left handles for horizontal layout
        const handles = bridge.getEdgeHandles(visState, 'horizontalEdge');

        expect(handles).toEqual({
            sourceHandle: 'out-right',
            targetHandle: 'in-left',
        });
    });

    test('should prefer vertical handles for vertically aligned nodes', () => {
        // Setup: Nodes positioned vertically with sufficient separation
        visState.setGraphNode('topNode', {
            width: 120,
            height: 40,
            hidden: false
        });

        visState.setGraphNode('bottomNode', {
            width: 120,
            height: 40,
            hidden: false
        });

        // Set positions using layout system
        visState.setNodeLayout('topNode', {
            position: { x: 100, y: 0 },
            dimensions: { width: 120, height: 40 }
        });

        visState.setNodeLayout('bottomNode', {
            position: { x: 100, y: 200 },
            dimensions: { width: 120, height: 40 }
        });

        visState.setGraphEdge('verticalEdge', {
            source: 'topNode',
            target: 'bottomNode',
            hidden: false,
        });

        // Test: Should prefer bottom-to-top handles for vertical layout
        const handles = bridge.getEdgeHandles(visState, 'verticalEdge');

        expect(handles).toEqual({
            sourceHandle: 'out-bottom',
            targetHandle: 'in-top',
        });
    });

    test('should fallback to vertical for diagonal nodes (ambiguous direction)', () => {
        // Setup: Nodes positioned diagonally (equal horizontal and vertical displacement)
        visState.setGraphNode('node1', {
            x: 0,
            y: 0,
            width: 120,
            height: 40,
            hidden: false
        });

        visState.setGraphNode('node2', {
            x: 100,
            y: 100,
            width: 120,
            height: 40,
            hidden: false
        });

        visState.setGraphEdge('diagonalEdge', {
            source: 'node1',
            target: 'node2',
            hidden: false,
        });

        // Test: Should fallback to safe vertical handles when direction is ambiguous
        const handles = bridge.getEdgeHandles(visState, 'diagonalEdge');

        expect(handles).toEqual({
            sourceHandle: 'out-bottom',
            targetHandle: 'in-top',
        });
    });

    test('should avoid unsafe handle combinations (conservative approach)', () => {
        // Setup: Nodes where target is above and to the left of source
        // This would normally suggest out-left and in-bottom, but these are unsafe
        visState.setGraphNode('bottomRightNode', {
            x: 200,
            y: 200,
            width: 120,
            height: 40,
            hidden: false
        });

        visState.setGraphNode('topLeftNode', {
            x: 0,
            y: 0,
            width: 120,
            height: 40,
            hidden: false
        });

        visState.setGraphEdge('unsafeEdge', {
            source: 'bottomRightNode',
            target: 'topLeftNode',
            hidden: false,
        });

        // Test: Should fallback to safe handles instead of using out-left or in-bottom
        const handles = bridge.getEdgeHandles(visState, 'unsafeEdge');

        // Should not use out-left or in-bottom (unsafe combinations)
        expect(handles.sourceHandle).not.toBe('out-left');
        expect(handles.targetHandle).not.toBe('in-bottom');

        // Should use safe fallback
        expect(handles).toEqual({
            sourceHandle: 'out-bottom',
            targetHandle: 'in-top',
        });
    });

    test('should handle nodes with custom dimensions correctly', () => {
        // Setup: Wide horizontal node and tall vertical node
        visState.setGraphNode('wideNode', {
            width: 200,
            height: 50,
            hidden: false
        });

        visState.setGraphNode('tallNode', {
            width: 80,
            height: 150,
            hidden: false
        });

        // Set positions using layout system
        visState.setNodeLayout('wideNode', {
            position: { x: 0, y: 100 },
            dimensions: { width: 200, height: 50 }
        });

        visState.setNodeLayout('tallNode', {
            position: { x: 400, y: 50 },
            dimensions: { width: 80, height: 150 }
        });

        visState.setGraphEdge('customDimensionEdge', {
            source: 'wideNode',
            target: 'tallNode',
            hidden: false,
        });

        // Test: Should correctly calculate centers and prefer horizontal connection
        const handles = bridge.getEdgeHandles(visState, 'customDimensionEdge');

        expect(handles).toEqual({
            sourceHandle: 'out-right',
            targetHandle: 'in-left',
        });
    });

    test('should fallback gracefully for missing node positions', () => {
        // Setup: Nodes without explicit positions (should use defaults)
        visState.setGraphNode('nodeA', { hidden: false });
        visState.setGraphNode('nodeB', { hidden: false });

        visState.setGraphEdge('noPositionEdge', {
            source: 'nodeA',
            target: 'nodeB',
            hidden: false,
        });

        // Test: Should handle missing positions gracefully
        const handles = bridge.getEdgeHandles(visState, 'noPositionEdge');

        expect(handles).toEqual({
            sourceHandle: 'out-bottom',
            targetHandle: 'in-top',
        });
    });

    test('should handle hyperedges conservatively', () => {
        // Setup: Regular nodes and create them as part of a container scenario
        // (HyperEdges require at least one endpoint to be a collapsed container)
        visState.setGraphNode('sourceNode', {
            width: 120,
            height: 40,
            hidden: false
        });

        visState.setGraphNode('targetNode', {
            width: 120,
            height: 40,
            hidden: false
        });

        // Set positions using layout system
        visState.setNodeLayout('sourceNode', {
            position: { x: 0, y: 100 },
            dimensions: { width: 120, height: 40 }
        });

        // Create a collapsed container as target (required for hyperedges)
        visState.setContainer('collapsedContainer', {
            collapsed: true,
            hidden: false,
            children: ['targetNode'],
        });

        // Set layout for the container
        visState.setContainerLayout('collapsedContainer', {
            position: { x: 300, y: 100 },
            dimensions: { width: 120, height: 40 }
        });

        // Create a hyperedge (these were problematic in the past)
        visState.setHyperEdge('testHyperEdge', {
            source: 'sourceNode',
            target: 'collapsedContainer',
            type: 'hyper',
            hidden: false,
        });

        // Test: Should handle hyperedges the same way as regular edges
        const handles = bridge.getEdgeHandles(visState, 'testHyperEdge');

        expect(handles).toEqual({
            sourceHandle: 'out-right',
            targetHandle: 'in-left',
        });
    });

    test('should handle edge cases that could cause instability', () => {
        // Test case 1: Nodes at exactly the same position (potential division by zero)
        visState.setGraphNode('samePos1', { hidden: false });
        visState.setGraphNode('samePos2', { hidden: false });
        visState.setNodeLayout('samePos1', {
            position: { x: 100, y: 100 },
            dimensions: { width: 120, height: 40 }
        });
        visState.setNodeLayout('samePos2', {
            position: { x: 100, y: 100 },
            dimensions: { width: 120, height: 40 }
        });
        visState.setGraphEdge('samePosEdge', {
            source: 'samePos1',
            target: 'samePos2',
            hidden: false,
        });

        const handles1 = bridge.getEdgeHandles(visState, 'samePosEdge');
        expect(handles1).toEqual({
            sourceHandle: 'out-bottom',
            targetHandle: 'in-top',
        });

        // Test case 2: Invalid/NaN coordinates
        visState.setGraphNode('invalidNode1', { hidden: false });
        visState.setGraphNode('invalidNode2', { hidden: false });
        visState.setNodeLayout('invalidNode1', {
            position: { x: NaN, y: 100 },
            dimensions: { width: 120, height: 40 }
        });
        visState.setNodeLayout('invalidNode2', {
            position: { x: 200, y: Infinity },
            dimensions: { width: 120, height: 40 }
        });
        visState.setGraphEdge('invalidEdge', {
            source: 'invalidNode1',
            target: 'invalidNode2',
            hidden: false,
        });

        const handles2 = bridge.getEdgeHandles(visState, 'invalidEdge');
        expect(handles2).toEqual({
            sourceHandle: 'out-bottom',
            targetHandle: 'in-top',
        });

        // Test case 3: Zero or negative dimensions
        visState.setGraphNode('zeroDim1', { hidden: false });
        visState.setGraphNode('zeroDim2', { hidden: false });
        visState.setNodeLayout('zeroDim1', {
            position: { x: 0, y: 0 },
            dimensions: { width: 0, height: -10 }
        });
        visState.setNodeLayout('zeroDim2', {
            position: { x: 100, y: 100 },
            dimensions: { width: 120, height: 40 }
        });
        visState.setGraphEdge('zeroDimEdge', {
            source: 'zeroDim1',
            target: 'zeroDim2',
            hidden: false,
        });

        const handles3 = bridge.getEdgeHandles(visState, 'zeroDimEdge');
        expect(handles3).toEqual({
            sourceHandle: 'out-right',
            targetHandle: 'in-left',
        });
    });
});
