/**
 * Simple Hydroscope demo component for Docusaurus
 * Shows a basic example with controls
 */

import React, { useState } from 'react';
import { HydroscopeDocusaurus } from './HydroscopeDocusaurus.js';
import type { HydroscopeData } from '../types/core.js';
import './hydroscope-docusaurus.css';

interface HydroscopeDemoProps {
    /** Height of the demo */
    height?: string | number;
    /** Whether to show the paxos.json demo */
    showPaxosDemo?: boolean;
}

export const HydroscopeDemo: React.FC<HydroscopeDemoProps> = ({
    height = 400,
    showPaxosDemo = false
}) => {
    const [currentDemo, setCurrentDemo] = useState<'simple' | 'paxos'>('simple');

    const simpleData: HydroscopeData = {
        nodes: [
            {
                id: 'source1',
                shortLabel: 'source',
                fullLabel: 'source_iter([1, 2, 3])',
                nodeType: 'Source',
                data: { locationId: 0, locationType: 'Process' }
            },
            {
                id: 'map1',
                shortLabel: 'map',
                fullLabel: 'map(|x| x * 2)',
                nodeType: 'Transform',
                data: { locationId: 0, locationType: 'Process' }
            },
            {
                id: 'filter1',
                shortLabel: 'filter',
                fullLabel: 'filter(|x| x > 2)',
                nodeType: 'Transform',
                data: { locationId: 1, locationType: 'Process' }
            },
            {
                id: 'sink1',
                shortLabel: 'sink',
                fullLabel: 'for_each(|x| println!("{}", x))',
                nodeType: 'Sink',
                data: { locationId: 1, locationType: 'Process' }
            }
        ],
        edges: [
            {
                id: 'e1',
                source: 'source1',
                target: 'map1',
                semanticTags: ['Unbounded', 'TotalOrder']
            },
            {
                id: 'e2',
                source: 'map1',
                target: 'filter1',
                semanticTags: ['Unbounded', 'TotalOrder']
            },
            {
                id: 'e3',
                source: 'filter1',
                target: 'sink1',
                semanticTags: ['Unbounded', 'TotalOrder']
            }
        ],
        hierarchyChoices: [
            {
                id: 'location',
                name: 'Location',
                children: [
                    { id: 'loc_0', name: 'Process 0', children: [] },
                    { id: 'loc_1', name: 'Process 1', children: [] }
                ]
            }
        ],
        nodeAssignments: {
            location: {
                'source1': 'loc_0',
                'map1': 'loc_0',
                'filter1': 'loc_1',
                'sink1': 'loc_1'
            }
        }
    };

    return (
        <div style={{ marginBottom: '2rem' }}>
            <div className="hydroscope-demo-controls">
                <h4>Interactive Hydroscope Demo</h4>
                <p>Click on containers to expand/collapse them, or click on nodes to toggle between short and long labels.</p>

                {showPaxosDemo && (
                    <div style={{ marginBottom: '1rem' }}>
                        <button
                            onClick={() => setCurrentDemo('simple')}
                            className={`hydroscope-demo-button ${currentDemo === 'simple' ? 'active' : ''}`}
                        >
                            Simple Demo
                        </button>
                        <button
                            onClick={() => setCurrentDemo('paxos')}
                            className={`hydroscope-demo-button ${currentDemo === 'paxos' ? 'active' : ''}`}
                        >
                            Paxos Demo (Large Graph)
                        </button>
                    </div>
                )}
            </div>

            <HydroscopeDocusaurus
                data={currentDemo === 'simple' ? simpleData : undefined}
                demo={currentDemo === 'paxos'}
                height={height}
                showControls={true}
                showMiniMap={true}
                showBackground={true}
            />

            <div className="hydroscope-demo-instructions">
                <p>Try these interactions:</p>
                <ul>
                    <li>Click on the colored container boxes to expand/collapse them</li>
                    <li>Click on individual nodes to toggle between short and full labels</li>
                    <li>Use the controls in the bottom-right to zoom and fit the view</li>
                    <li>Use the minimap in the top-right to navigate large graphs</li>
                </ul>
            </div>
        </div>
    );
};

export default HydroscopeDemo;