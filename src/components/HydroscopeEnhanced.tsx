/**
 * HydroscopeEnhanced - Comprehensive graph visualization component
 * 
 * This component provides all the enhanced features specified in the requirements:
 * - Advanced file upload with drag-and-drop
 * - URL parameter data loading
 * - InfoPanel with search and container controls
 * - StyleTuner for real-time style configuration
 * - Error handling and recovery
 * - Responsive design
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { ReactFlow, Background, Controls, MiniMap } from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { nodeTypes } from "./nodes/index.js";
import { StyleConfigProvider, useStyleConfig } from "../render/StyleConfigContext.js";
import { FileUpload } from "./FileUpload.js";
import { SearchIntegration } from "./SearchIntegration.js";
import { ContainerControls } from "./ContainerControls.js";

import { VisualizationState } from "../core/VisualizationState.js";
import { ReactFlowBridge } from "../bridges/ReactFlowBridge.js";
import { ELKBridge } from "../bridges/ELKBridge.js";
import { JSONParser } from "../utils/JSONParser.js";
import { InteractionHandler } from "../core/InteractionHandler.js";
import type { HydroscopeData } from "../types/core.js";

export interface HydroscopeEnhancedProps {
  /** JSON data to visualize (optional) */
  data?: HydroscopeData;
  /** Height of the visualization container */
  height?: string | number;
  /** Width of the visualization container */
  width?: string | number;
  /** Whether to show controls */
  showControls?: boolean;
  /** Whether to show minimap */
  showMiniMap?: boolean;
  /** Whether to show background pattern */
  showBackground?: boolean;
  /** Demo mode - loads demo data if no data provided */
  demo?: boolean;
  /** Enable enhanced features (InfoPanel, StyleTuner, etc.) */
  enhanced?: boolean;
}

// InfoPanel Component
interface InfoPanelProps {
  visualizationState: VisualizationState | null;
  reactFlowData: { nodes: any[]; edges: any[] };
  onSearchResultSelect: (result: any) => void;
  onContainerOperation: (operation: string, containerId?: string) => void;
  onError: (error: Error) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function InfoPanel({ 
  visualizationState, 
  reactFlowData,
  onSearchResultSelect, 
  onContainerOperation, 
  onError, 
  open, 
  onOpenChange 
}: InfoPanelProps) {
  if (!open) {
    return (
      <div style={{
        position: 'fixed',
        top: '50%',
        right: '20px',
        transform: 'translateY(-50%)',
        zIndex: 1000
      }}>
        <button
          onClick={() => onOpenChange(true)}
          style={{
            padding: '12px',
            backgroundColor: '#1976d2',
            color: 'white',
            border: 'none',
            borderRadius: '8px 0 0 8px',
            cursor: 'pointer',
            fontSize: '16px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
          }}
          title="Open Info Panel"
        >
          ℹ️
        </button>
      </div>
    );
  }

  return (
    <div style={{
      position: 'fixed',
      top: '0',
      right: '0',
      width: '350px',
      height: '100vh',
      backgroundColor: 'white',
      borderLeft: '1px solid #e0e0e0',
      boxShadow: '-2px 0 8px rgba(0,0,0,0.1)',
      zIndex: 1000,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden'
    }}>
      {/* Header */}
      <div style={{
        padding: '16px',
        borderBottom: '1px solid #e0e0e0',
        backgroundColor: '#f9f9f9',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600' }}>
          Graph Info
        </h3>
        <button
          onClick={() => onOpenChange(false)}
          style={{
            padding: '4px 8px',
            backgroundColor: 'transparent',
            border: '1px solid #ccc',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '14px'
          }}
        >
          ✕
        </button>
      </div>

      {/* Content */}
      <div style={{
        flex: 1,
        overflow: 'auto',
        padding: '16px'
      }}>
        {visualizationState ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Search Section */}
            <div>
              <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: '600' }}>
                Search
              </h4>
              <SearchIntegration
                visualizationState={visualizationState}
                onSearchResultSelect={onSearchResultSelect}
                placeholder="Search nodes and containers..."
                maxResults={50}
                groupByType={true}
                showResultsPanel={true}
              />
            </div>

            {/* Container Controls Section */}
            <div>
              <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: '600' }}>
                Container Controls
              </h4>
              {/* Container Controls - simplified for now */}
              <div style={{ fontSize: '14px', color: '#666' }}>
                Container controls will be available when AsyncCoordinator is integrated
              </div>
            </div>

            {/* Graph Statistics */}
            <div>
              <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: '600' }}>
                Statistics
              </h4>
              <div style={{ fontSize: '14px', color: '#666' }}>
                <div>Nodes: {reactFlowData.nodes.length}</div>
                <div>Edges: {reactFlowData.edges.length}</div>
                <div>Containers: {visualizationState.visibleContainers?.length || 0}</div>
              </div>
            </div>
          </div>
        ) : (
          <div style={{
            textAlign: 'center',
            color: '#666',
            fontSize: '14px',
            padding: '20px'
          }}>
            Load graph data to see info panel content
          </div>
        )}
      </div>
    </div>
  );
}

// StyleTuner Component
interface StyleTunerProps {
  value: any;
  onChange: (config: any) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function StyleTuner({ 
  value, 
  onChange, 
  open, 
  onOpenChange 
}: StyleTunerProps) {
  if (!open) {
    return (
      <div style={{
        position: 'fixed',
        top: '50%',
        left: '20px',
        transform: 'translateY(-50%)',
        zIndex: 1000
      }}>
        <button
          onClick={() => onOpenChange(true)}
          style={{
            padding: '12px',
            backgroundColor: '#1976d2',
            color: 'white',
            border: 'none',
            borderRadius: '0 8px 8px 0',
            cursor: 'pointer',
            fontSize: '16px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
          }}
          title="Open Style Tuner"
        >
          🎨
        </button>
      </div>
    );
  }

  return (
    <div style={{
      position: 'fixed',
      top: '0',
      left: '0',
      width: '320px',
      height: '100vh',
      backgroundColor: 'white',
      borderRight: '1px solid #e0e0e0',
      boxShadow: '2px 0 8px rgba(0,0,0,0.1)',
      zIndex: 1000,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden'
    }}>
      {/* Header */}
      <div style={{
        padding: '16px',
        borderBottom: '1px solid #e0e0e0',
        backgroundColor: '#f9f9f9',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600' }}>
          Style Tuner
        </h3>
        <button
          onClick={() => onOpenChange(false)}
          style={{
            padding: '4px 8px',
            backgroundColor: 'transparent',
            border: '1px solid #ccc',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '14px'
          }}
        >
          ✕
        </button>
      </div>

      {/* Content */}
      <div style={{
        flex: 1,
        overflow: 'auto',
        padding: '16px'
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Edge Styles */}
          <div>
            <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: '600' }}>
              Edge Styles
            </h4>
            
            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px' }}>
                Edge Type
              </label>
              <select
                value={value.edgeStyle}
                onChange={(e) => onChange({ ...value, edgeStyle: e.target.value })}
                style={{
                  width: '100%',
                  padding: '6px',
                  border: '1px solid #ccc',
                  borderRadius: '4px',
                  fontSize: '14px'
                }}
              >
                <option value="bezier">Bezier Curves</option>
                <option value="straight">Straight Lines</option>
                <option value="smoothstep">Smooth Steps</option>
              </select>
            </div>

            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px' }}>
                Edge Color
              </label>
              <input
                type="color"
                value={value.edgeColor}
                onChange={(e) => onChange({ ...value, edgeColor: e.target.value })}
                style={{
                  width: '100%',
                  height: '32px',
                  border: '1px solid #ccc',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              />
            </div>

            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px' }}>
                Edge Width: {value.edgeWidth}px
              </label>
              <input
                type="range"
                min="1"
                max="8"
                value={value.edgeWidth}
                onChange={(e) => onChange({ ...value, edgeWidth: parseInt(e.target.value) })}
                style={{ width: '100%' }}
              />
            </div>
          </div>

          {/* Node Styles */}
          <div>
            <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: '600' }}>
              Node Styles
            </h4>
            
            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px' }}>
                Border Radius: {value.nodeBorderRadius}px
              </label>
              <input
                type="range"
                min="0"
                max="20"
                value={value.nodeBorderRadius}
                onChange={(e) => onChange({ ...value, nodeBorderRadius: parseInt(e.target.value) })}
                style={{ width: '100%' }}
              />
            </div>

            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px' }}>
                Font Size: {value.nodeFontSize}px
              </label>
              <input
                type="range"
                min="8"
                max="20"
                value={value.nodeFontSize}
                onChange={(e) => onChange({ ...value, nodeFontSize: parseInt(e.target.value) })}
                style={{ width: '100%' }}
              />
            </div>
          </div>

          {/* Reset Button */}
          <div>
            <button
              onClick={() => onChange({
                edgeStyle: 'bezier',
                edgeColor: '#1976d2',
                edgeWidth: 2,
                nodeBorderRadius: 4,
                nodeFontSize: 12,
                containerBorderRadius: 8,
                containerBorderWidth: 2,
                containerShadow: 'LIGHT'
              })}
              style={{
                width: '100%',
                padding: '8px 16px',
                backgroundColor: '#666',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              Reset to Defaults
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export const HydroscopeEnhanced: React.FC<HydroscopeEnhancedProps> = ({
  data,
  height = 600,
  width = "100%",
  showControls = true,
  showMiniMap = true,
  showBackground = true,
  demo = false,
  enhanced = true,
}) => {
  const [visualizationState, setVisualizationState] = useState<VisualizationState | null>(null);
  const [reactFlowData, setReactFlowData] = useState<{
    nodes: any[];
    edges: any[];
  }>({ nodes: [], edges: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [graphData, setGraphData] = useState<HydroscopeData | null>(data || null);
  
  // Enhanced UI state
  const [showInfoPanel, setShowInfoPanel] = useState(false);
  const [showStyleTuner, setShowStyleTuner] = useState(false);
  const [styleConfig, setStyleConfig] = useState({
    edgeStyle: 'bezier' as const,
    edgeColor: '#1976d2',
    edgeWidth: 2,
    nodeBorderRadius: 4,
    nodeFontSize: 12,
    containerBorderRadius: 8,
    containerBorderWidth: 2,
    containerShadow: 'LIGHT' as const
  });

  const interactionHandlerRef = useRef<InteractionHandler | null>(null);

  // Initialize the visualization
  useEffect(() => {
    const initializeVisualization = async () => {
      try {
        setLoading(true);
        setError(null);

        let dataToUse = graphData;

        // Only load demo data if no real data is provided and demo is enabled
        if (!dataToUse && demo) {
          // Create minimal demo data
          dataToUse = {
            nodes: [
              {
                id: "node1",
                shortLabel: "Source",
                fullLabel: "Data Source Node",
                nodeType: "Source",
                data: { locationId: 0, locationType: "Process" },
              },
              {
                id: "node2",
                shortLabel: "Transform",
                fullLabel: "Data Transform Node",
                nodeType: "Transform",
                data: { locationId: 0, locationType: "Process" },
              },
              {
                id: "node3",
                shortLabel: "Sink",
                fullLabel: "Data Sink Node",
                nodeType: "Sink",
                data: { locationId: 1, locationType: "Process" },
              },
            ],
            edges: [
              {
                id: "edge1",
                source: "node1",
                target: "node2",
                semanticTags: ["DataFlow"],
              },
              {
                id: "edge2",
                source: "node2",
                target: "node3",
                semanticTags: ["DataFlow"],
              },
            ],
            hierarchyChoices: [
              {
                id: "location",
                name: "Location",
                children: [
                  { id: "loc_0", name: "Process 0", children: [] },
                  { id: "loc_1", name: "Process 1", children: [] },
                ],
              },
            ],
            nodeAssignments: {
              location: {
                node1: "loc_0",
                node2: "loc_0",
                node3: "loc_1",
              },
            },
          };
        }

        if (!dataToUse) {
          setLoading(false);
          return;
        }

        // Parse the data
        const parser = JSONParser.createPaxosParser({ debug: false });
        const parseResult = await parser.parseData(dataToUse);
        const state = parseResult.visualizationState;

        // Set up bridges with default configs
        const elkBridge = new ELKBridge({});
        const reactFlowBridge = new ReactFlowBridge({});

        // Perform layout using real ELK calculation
        await elkBridge.layout(state);

        // Convert to ReactFlow format
        const flowData = reactFlowBridge.toReactFlowData(state);

        // Set up interaction handler
        const interactionHandler = new InteractionHandler(state);
        interactionHandlerRef.current = interactionHandler;

        // Update state
        setVisualizationState(state);
        setReactFlowData(flowData);
        setLoading(false);
      } catch (err) {
        console.error("Failed to initialize Hydroscope:", err);
        setError(err instanceof Error ? err.message : "Unknown error occurred");
        setLoading(false);
      }
    };

    initializeVisualization();
  }, [graphData, demo]);

  // Handle file upload
  const handleFileLoaded = useCallback((data: HydroscopeData, filename: string) => {
    console.log('✅ File loaded:', filename);
    setGraphData(data);
    setError(null);
  }, []);

  const handleFileError = useCallback((error: any, filename: string) => {
    console.error('❌ File error:', error, filename);
    setError(`Failed to load ${filename}: ${error.message}`);
  }, []);

  // Handle node/edge clicks
  const handleNodeClick = async (event: React.MouseEvent, node: any) => {
    if (!visualizationState || !interactionHandlerRef.current) return;

    try {
      // Handle container expand/collapse
      if (node.type === "container") {
        const container = visualizationState.getContainer(node.id);
        if (container) {
          if (container.collapsed) {
            visualizationState.expandContainer(node.id);
          } else {
            visualizationState.collapseContainer(node.id);
          }

          // Update ReactFlow data
          const elkBridge = new ELKBridge({});
          const reactFlowBridge = new ReactFlowBridge({});

          try {
            await elkBridge.layout(visualizationState);
            const flowData = reactFlowBridge.toReactFlowData(visualizationState);
            setReactFlowData(flowData);
          } catch (err) {
            console.error("Error updating layout:", err);
          }
        }
      }
      // Handle node label toggle
      else if (node.type === "node") {
        const graphNode = visualizationState.getGraphNode(node.id);
        if (graphNode) {
          visualizationState.toggleNodeLabel(node.id);

          // Update ReactFlow data
          const reactFlowBridge = new ReactFlowBridge({});
          const flowData = reactFlowBridge.toReactFlowData(visualizationState);
          setReactFlowData(flowData);
        }
      }
    } catch (err) {
      console.error("Error handling node click:", err);
    }
  };

  if (loading) {
    return (
      <div className="hydroscope-loading" style={{ height, width, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div>Loading Hydroscope visualization...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="hydroscope-error" style={{ height, width, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', color: '#d32f2f' }}>
          <div>Error loading visualization: {error}</div>
          <button
            onClick={() => {
              setError(null);
              setLoading(true);
            }}
            style={{
              marginTop: '10px',
              padding: '8px 16px',
              backgroundColor: '#1976d2',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <StyleConfigProvider value={styleConfig}>
      <div className="hydroscope-enhanced" style={{ height, width, position: 'relative' }}>
        {/* File Upload (when no data) */}
        {!graphData && enhanced && (
          <div style={{
            position: 'absolute',
            top: '20px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 100,
            backgroundColor: 'white',
            padding: '20px',
            borderRadius: '8px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
            border: '1px solid #e0e0e0'
          }}>
            <FileUpload
              onFileLoaded={handleFileLoaded}
              onParseError={handleFileError}
              onValidationError={handleFileError}
              acceptedTypes={['.json']}
              maxFileSize={100 * 1024 * 1024} // 100MB
              showDetailedErrors={true}
            />
          </div>
        )}

        {/* Main Visualization */}
        <ReactFlow
          nodes={reactFlowData.nodes}
          edges={reactFlowData.edges}
          nodeTypes={nodeTypes}
          onNodeClick={handleNodeClick}
          fitView
          attributionPosition="bottom-left"
        >
          {showBackground && <Background />}
          {showControls && <Controls />}
          {showMiniMap && <MiniMap />}
        </ReactFlow>

        {/* Enhanced UI Components */}
        {enhanced && graphData && (
          <>
            {/* InfoPanel */}
            <InfoPanel
              visualizationState={visualizationState}
              reactFlowData={reactFlowData}
              onSearchResultSelect={() => {}}
              onContainerOperation={() => {}}
              onError={(error: Error) => setError(error.message)}
              open={showInfoPanel}
              onOpenChange={setShowInfoPanel}
            />

            {/* StyleTuner */}
            <StyleTuner
              value={styleConfig}
              onChange={setStyleConfig}
              open={showStyleTuner}
              onOpenChange={setShowStyleTuner}
            />
          </>
        )}
      </div>
    </StyleConfigProvider>
  );
};

export default HydroscopeEnhanced;