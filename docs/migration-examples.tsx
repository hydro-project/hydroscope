/**
 * Migration Examples - Practical examples showing how to migrate from HydroscopeEnhanced
 * to the new standalone components.
 */

import React, { useState, useCallback } from 'react';

// ============================================================================
// Example 1: Basic Migration
// ============================================================================

// BEFORE: Using deprecated HydroscopeEnhanced
/*
import { HydroscopeEnhanced } from '@hydro-project/hydroscope';

function BasicExample({ data }) {
  return (
    <HydroscopeEnhanced 
      data={data}
      enhanced={true}
      height="600px"
      showControls={true}
      showMiniMap={true}
    />
  );
}
*/

// AFTER: Using new Hydroscope component
import { Hydroscope } from '@hydro-project/hydroscope';

function BasicExampleNew({ data }) {
  return (
    <Hydroscope 
      data={data}
      showInfoPanel={true}
      showStylePanel={true}
      height="600px"
      showControls={true}
      showMiniMap={true}
    />
  );
}

// ============================================================================
// Example 2: Advanced Migration with Event Handlers
// ============================================================================

// BEFORE: Limited event handling
/*
function AdvancedExample({ data }) {
  const handleNodeClick = (node) => {
    console.log('Node clicked:', node);
  };

  return (
    <HydroscopeEnhanced 
      data={data}
      enhanced={true}
      onNodeClick={handleNodeClick}
    />
  );
}
*/

// AFTER: Rich event handling with new component
function AdvancedExampleNew({ data }) {
  const [selectedNode, setSelectedNode] = useState(null);
  const [collapsedContainers, setCollapsedContainers] = useState(new Set());

  const handleNodeClick = useCallback((event, node, visualizationState) => {
    console.log('Node clicked:', node);
    setSelectedNode(node);
  }, []);

  const handleContainerCollapse = useCallback((containerId, visualizationState) => {
    console.log('Container collapsed:', containerId);
    setCollapsedContainers(prev => new Set([...prev, containerId]));
  }, []);

  const handleContainerExpand = useCallback((containerId, visualizationState) => {
    console.log('Container expanded:', containerId);
    setCollapsedContainers(prev => {
      const next = new Set(prev);
      next.delete(containerId);
      return next;
    });
  }, []);

  const handleFileUpload = useCallback((uploadedData, filename) => {
    console.log('File uploaded:', filename, uploadedData);
    // Handle the uploaded data
  }, []);

  return (
    <Hydroscope 
      data={data}
      showInfoPanel={true}
      showStylePanel={true}
      showFileUpload={true}
      enableCollapse={true}
      onNodeClick={handleNodeClick}
      onContainerCollapse={handleContainerCollapse}
      onContainerExpand={handleContainerExpand}
      onFileUpload={handleFileUpload}
      initialLayoutAlgorithm="layered"
      initialColorPalette="Set2"
    />
  );
}

// ============================================================================
// Example 3: Custom Layout with Standalone Components
// ============================================================================

import { InfoPanel, StyleTuner } from '@hydro-project/hydroscope/panels';
import { HydroscopeCore } from '@hydro-project/hydroscope';

function CustomLayoutExample({ data }) {
  const [visualizationState, setVisualizationState] = useState(null);
  const [asyncCoordinator, setAsyncCoordinator] = useState(null);
  const [infoPanelOpen, setInfoPanelOpen] = useState(true);
  const [stylePanelOpen, setStylePanelOpen] = useState(false);
  const [styleConfig, setStyleConfig] = useState({
    edgeStyle: 'bezier',
    edgeColor: '#1976d2',
    edgeWidth: 2,
    nodeBorderRadius: 4,
    nodeFontSize: 12,
  });

  const handleError = useCallback((error) => {
    console.error('Component error:', error);
    // Handle error appropriately
  }, []);

  const handleSearchUpdate = useCallback((query, matches, current) => {
    console.log('Search updated:', { query, matches: matches.length, current: current?.id });
  }, []);

  return (
    <div style={{ display: 'flex', height: '100vh' }}>
      {/* Custom sidebar */}
      <div style={{ width: '200px', backgroundColor: '#f5f5f5', padding: '16px' }}>
        <h3>Custom Controls</h3>
        <button onClick={() => setInfoPanelOpen(!infoPanelOpen)}>
          Toggle Info Panel
        </button>
        <button onClick={() => setStylePanelOpen(!stylePanelOpen)}>
          Toggle Style Panel
        </button>
      </div>

      {/* Main visualization area */}
      <div style={{ flex: 1, position: 'relative' }}>
        <HydroscopeCore 
          data={data}
          onVisualizationStateChange={setVisualizationState}
          onAsyncCoordinatorChange={setAsyncCoordinator}
          onError={handleError}
        />

        {/* Standalone InfoPanel */}
        <InfoPanel
          visualizationState={visualizationState}
          asyncCoordinator={asyncCoordinator}
          open={infoPanelOpen}
          onOpenChange={setInfoPanelOpen}
          onSearchUpdate={handleSearchUpdate}
          onError={handleError}
        />

        {/* Standalone StyleTuner */}
        <StyleTuner
          value={styleConfig}
          onChange={setStyleConfig}
          visualizationState={visualizationState}
          asyncCoordinator={asyncCoordinator}
          open={stylePanelOpen}
          onOpenChange={setStylePanelOpen}
          onError={handleError}
        />
      </div>
    </div>
  );
}

// ============================================================================
// Example 4: Gradual Migration Strategy
// ============================================================================

// Step 1: Keep using HydroscopeEnhanced but prepare for migration
function GradualMigrationStep1({ data }) {
  // This will show deprecation warnings in development
  const [enhanced, setEnhanced] = useState(true);
  
  return (
    <div>
      {/* Add controls to test new behavior */}
      <div style={{ padding: '16px', backgroundColor: '#fff3cd' }}>
        <p>⚠️ This component is using deprecated HydroscopeEnhanced</p>
        <button onClick={() => setEnhanced(!enhanced)}>
          Toggle Enhanced Features
        </button>
      </div>
      
      {/* Keep existing component for now */}
      {/* <HydroscopeEnhanced data={data} enhanced={enhanced} /> */}
    </div>
  );
}

// Step 2: Switch to new component with minimal changes
function GradualMigrationStep2({ data }) {
  const [showInfoPanel, setShowInfoPanel] = useState(true);
  const [showStylePanel, setShowStylePanel] = useState(true);
  
  return (
    <div>
      {/* Add controls for new features */}
      <div style={{ padding: '16px', backgroundColor: '#d4edda' }}>
        <p>✅ Migrated to new Hydroscope component</p>
        <button onClick={() => setShowInfoPanel(!showInfoPanel)}>
          Toggle Info Panel
        </button>
        <button onClick={() => setShowStylePanel(!showStylePanel)}>
          Toggle Style Panel
        </button>
      </div>
      
      <Hydroscope 
        data={data}
        showInfoPanel={showInfoPanel}
        showStylePanel={showStylePanel}
      />
    </div>
  );
}

// Step 3: Optimize with advanced features
function GradualMigrationStep3({ data }) {
  const [config, setConfig] = useState({
    showInfoPanel: true,
    showStylePanel: true,
    showFileUpload: true,
    enableCollapse: true,
    layoutAlgorithm: 'layered',
    colorPalette: 'Set2'
  });

  const handleConfigChange = useCallback((newConfig) => {
    console.log('Configuration changed:', newConfig);
    // Save to localStorage or send to server
  }, []);

  return (
    <Hydroscope 
      data={data}
      showInfoPanel={config.showInfoPanel}
      showStylePanel={config.showStylePanel}
      showFileUpload={config.showFileUpload}
      enableCollapse={config.enableCollapse}
      initialLayoutAlgorithm={config.layoutAlgorithm}
      initialColorPalette={config.colorPalette}
      onConfigChange={handleConfigChange}
      onNodeClick={(event, node) => console.log('Node clicked:', node)}
      onContainerCollapse={(id) => console.log('Container collapsed:', id)}
      onFileUpload={(data, filename) => console.log('File uploaded:', filename)}
    />
  );
}

// ============================================================================
// Export Examples
// ============================================================================

export {
  BasicExampleNew,
  AdvancedExampleNew,
  CustomLayoutExample,
  GradualMigrationStep1,
  GradualMigrationStep2,
  GradualMigrationStep3
};

// ============================================================================
// Migration Checklist
// ============================================================================

/*
Migration Checklist:

□ Update imports from HydroscopeEnhanced to Hydroscope
□ Replace `enhanced={true}` with `showInfoPanel={true} showStylePanel={true}`
□ Update event handlers to use new callback signatures
□ Test all existing functionality works as expected
□ Consider using new features (file upload, container operations, etc.)
□ Update TypeScript types if using custom interfaces
□ Test error handling and edge cases
□ Update documentation and examples
□ Remove deprecation warnings from console
□ Consider using standalone components for maximum flexibility

Performance Improvements After Migration:
□ React.memo optimization reduces unnecessary re-renders
□ Better state management prevents timing bugs
□ Improved error boundaries prevent crashes
□ More efficient event handling
□ Better memory management and cleanup
*/