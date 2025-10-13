# Component Usage Examples

This document provides comprehensive usage examples for the cleaned Hydroscope component and its integrated InfoPanel and StyleTuner components. These examples demonstrate best practices, common patterns, and advanced usage scenarios.

## Table of Contents

1. [Hydroscope Component Examples](#hydroscope-component-examples)
2. [InfoPanel Component Examples](#infopanel-component-examples)
3. [StyleTuner Component Examples](#styletuner-component-examples)
4. [Integration Patterns](#integration-patterns)
5. [Error Handling Examples](#error-handling-examples)
6. [Performance Optimization Examples](#performance-optimization-examples)
7. [Migration Examples](#migration-examples)

## Hydroscope Component Examples

The new Hydroscope component provides complete functionality with clean architecture and v1.0.0 integration.

## InfoPanel Component

The InfoPanel provides search functionality, container hierarchy management, and legend display.

### Basic Usage

```tsx
import React, { useState } from 'react';
import { InfoPanel, VisualizationState } from '@hydro-project/hydroscope';

function BasicInfoPanelExample() {
  const [infoPanelOpen, setInfoPanelOpen] = useState(true);
  const [visualizationState, setVisualizationState] = useState<VisualizationState | null>(null);
  const [collapsedContainers, setCollapsedContainers] = useState(new Set<string>());

  return (
    <InfoPanel
      visualizationState={visualizationState}
      open={infoPanelOpen}
      onOpenChange={setInfoPanelOpen}
      collapsedContainers={collapsedContainers}
      onToggleContainer={(containerId) => {
        const newCollapsed = new Set(collapsedContainers);
        if (newCollapsed.has(containerId)) {
          newCollapsed.delete(containerId);
        } else {
          newCollapsed.add(containerId);
        }
        setCollapsedContainers(newCollapsed);
      }}
      onSearchUpdate={(query, matches, current) => {
        console.log(`Search: "${query}" found ${matches.length} matches`);
        if (current) {
          console.log(`Current match: ${current.label}`);
        }
      }}
      onError={(error) => {
        console.error('InfoPanel error:', error);
      }}
    />
  );
}
```

### Advanced Usage with v1.0.0 Architecture

```tsx
import React, { useState, useEffect, useRef } from 'react';
import { 
  InfoPanel, 
  InfoPanelRef,
  VisualizationState, 
  AsyncCoordinator 
} from '@hydro-project/hydroscope';

function AdvancedInfoPanelExample() {
  const [visualizationState, setVisualizationState] = useState<VisualizationState | null>(null);
  const [asyncCoordinator, setAsyncCoordinator] = useState<AsyncCoordinator | null>(null);
  const infoPanelRef = useRef<InfoPanelRef>(null);

  // Initialize v1.0.0 architecture
  useEffect(() => {
    const initializev1.0.0 = async () => {
      const visState = new VisualizationState();
      const coordinator = new AsyncCoordinator();
      
      // Load your data here
      // await visState.loadData(yourData);
      
      setVisualizationState(visState);
      setAsyncCoordinator(coordinator);
    };

    initializev1.0.0();
  }, []);

  // Keyboard shortcut for search
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'f') {
        e.preventDefault();
        infoPanelRef.current?.focusSearch();
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, []);

  return (
    <InfoPanel
      ref={infoPanelRef}
      visualizationState={visualizationState}
      asyncCoordinator={asyncCoordinator}
      open={true}
      onOpenChange={() => {}}
      legendData={{
        title: "Node Types",
        items: [
          { type: "process", label: "Process", description: "Processing nodes" },
          { type: "data", label: "Data", description: "Data storage nodes" }
        ]
      }}
      hierarchyChoices={[
        { id: "type", name: "By Type", description: "Group by node type" },
        { id: "container", name: "By Container", description: "Group by container" }
      ]}
      onGroupingChange={(groupingId) => {
        console.log(`Grouping changed to: ${groupingId}`);
      }}
      onResetToDefaults={() => {
        console.log('Resetting InfoPanel to defaults');
      }}
    />
  );
}
```

## StyleTuner Component

The StyleTuner provides real-time style configuration and layout controls.

### Basic Usage

```tsx
import React, { useState } from 'react';
import { StyleTuner, StyleConfig } from '@hydro-project/hydroscope';

function BasicStyleTunerExample() {
  const [stylePanelOpen, setStylePanelOpen] = useState(true);
  const [styleConfig, setStyleConfig] = useState<StyleConfig>({
    edgeStyle: 'bezier',
    edgeWidth: 2,
    edgeColor: '#666666',
    nodePadding: 8,
    nodeFontSize: 12,
    containerBorderWidth: 2
  });

  return (
    <StyleTuner
      value={styleConfig}
      onChange={setStyleConfig}
      open={stylePanelOpen}
      onOpenChange={setStylePanelOpen}
      colorPalette="Set2"
      onPaletteChange={(palette) => {
        console.log(`Color palette changed to: ${palette}`);
      }}
      currentLayout="layered"
      onLayoutChange={(layout) => {
        console.log(`Layout algorithm changed to: ${layout}`);
      }}
      onResetToDefaults={() => {
        setStyleConfig({
          edgeStyle: 'bezier',
          edgeWidth: 2,
          nodePadding: 8
        });
      }}
    />
  );
}
```

### Advanced Usage with v1.0.0 Integration

```tsx
import React, { useState, useEffect } from 'react';
import { 
  StyleTuner, 
  StyleConfig,
  VisualizationState,
  AsyncCoordinator 
} from '@hydro-project/hydroscope';

function AdvancedStyleTunerExample() {
  const [visualizationState, setVisualizationState] = useState<VisualizationState | null>(null);
  const [asyncCoordinator, setAsyncCoordinator] = useState<AsyncCoordinator | null>(null);
  const [styleConfig, setStyleConfig] = useState<StyleConfig>({});

  // Load persisted settings
  useEffect(() => {
    try {
      const saved = localStorage.getItem('hydroscope-style-config');
      if (saved) {
        setStyleConfig(JSON.parse(saved));
      }
    } catch (error) {
      console.error('Failed to load style config:', error);
    }
  }, []);

  // Save settings on change
  const handleStyleChange = (config: StyleConfig) => {
    setStyleConfig(config);
    
    try {
      localStorage.setItem('hydroscope-style-config', JSON.stringify(config));
    } catch (error) {
      console.error('Failed to save style config:', error);
    }
  };

  return (
    <StyleTuner
      value={styleConfig}
      onChange={handleStyleChange}
      visualizationState={visualizationState}
      asyncCoordinator={asyncCoordinator}
      open={true}
      onOpenChange={() => {}}
      onError={(error) => {
        console.error('StyleTuner error:', error);
        // Implement fallback behavior
      }}
    />
  );
}
```

## Hydroscope Component

The new Hydroscope component provides complete functionality with clean architecture.

### Basic Usage

```tsx
import React, { useState } from 'react';
import { Hydroscope, HydroscopeData } from '@hydro-project/hydroscope';

function BasicHydroscopeExample() {
  const [data, setData] = useState<HydroscopeData | null>(null);

  return (
    <div style={{ height: '100vh', width: '100vw' }}>
      <Hydroscope
        data={data}
        showFileUpload={true}
        showInfoPanel={true}
        showStylePanel={true}
        enableCollapse={true}
        onFileUpload={(uploadedData, filename) => {
          console.log(`Loaded file: ${filename}`);
          setData(uploadedData);
        }}
        onNodeClick={(event, node) => {
          console.log('Node clicked:', node.id);
        }}
      />
    </div>
  );
}
```

### Advanced Usage with Full Configuration

```tsx
import React, { useState, useCallback } from 'react';
import { 
  Hydroscope, 
  HydroscopeData, 
  RenderConfig,
  VisualizationState 
} from '@hydro-project/hydroscope';

function AdvancedHydroscopeExample() {
  const [data, setData] = useState<HydroscopeData | null>(null);
  const [config, setConfig] = useState<RenderConfig>({});

  const handleFileUpload = useCallback((uploadedData: HydroscopeData, filename?: string) => {
    console.log(`Processing file: ${filename}`);
    
    // Validate data before setting
    if (uploadedData && uploadedData.nodes && uploadedData.edges) {
      setData(uploadedData);
    } else {
      console.error('Invalid data format');
    }
  }, []);

  const handleNodeClick = useCallback((event: any, node: any, visualizationState?: VisualizationState) => {
    console.log('Node interaction:', {
      nodeId: node.id,
      nodeType: node.type,
      position: node.position,
      hasVisualizationState: !!visualizationState
    });
  }, []);

  const handleContainerOperation = useCallback((containerId: string, operation: 'collapse' | 'expand') => {
    console.log(`Container ${operation}:`, containerId);
  }, []);

  return (
    <div style={{ height: '100vh', width: '100vw' }}>
      <Hydroscope
        data={data}
        height="100%"
        width="100%"
        showControls={true}
        showMiniMap={true}
        showBackground={true}
        showFileUpload={true}
        showInfoPanel={true}
        showStylePanel={true}
        showPerformancePanel={process.env.NODE_ENV === 'development'}
        enableCollapse={true}
        initialLayoutAlgorithm="layered"
        initialColorPalette="Set2"
        responsive={true}
        enableUrlParams={true}
        onFileUpload={handleFileUpload}
        onNodeClick={handleNodeClick}
        onContainerCollapse={(containerId, visualizationState) => 
          handleContainerOperation(containerId, 'collapse')
        }
        onContainerExpand={(containerId, visualizationState) => 
          handleContainerOperation(containerId, 'expand')
        }
        onConfigChange={(newConfig) => {
          console.log('Configuration updated:', newConfig);
          setConfig(newConfig);
        }}
        className="custom-hydroscope"
        style={{ border: '1px solid #ccc' }}
      />
    </div>
  );
}
```

## Integration Patterns

### Using Components Together

```tsx
import React, { useState, useEffect } from 'react';
import { 
  InfoPanel, 
  StyleTuner, 
  VisualizationState,
  AsyncCoordinator,
  ReactFlowBridge,
  ELKBridge 
} from '@hydro-project/hydroscope';

function CustomIntegrationExample() {
  const [visualizationState, setVisualizationState] = useState<VisualizationState | null>(null);
  const [asyncCoordinator, setAsyncCoordinator] = useState<AsyncCoordinator | null>(null);
  const [infoPanelOpen, setInfoPanelOpen] = useState(true);
  const [stylePanelOpen, setStylePanelOpen] = useState(true);

  // Initialize v1.0.0 architecture
  useEffect(() => {
    const initialize = async () => {
      try {
        const visState = new VisualizationState();
        const coordinator = new AsyncCoordinator();
        
        // Initialize bridges
        const reactFlowBridge = new ReactFlowBridge({
          nodeStyles: {},
          edgeStyles: {},
          semanticMappings: {},
          propertyMappings: {}
        });
        
        const elkBridge = new ELKBridge({});
        
        setVisualizationState(visState);
        setAsyncCoordinator(coordinator);
      } catch (error) {
        console.error('Failed to initialize v1.0.0 architecture:', error);
      }
    };

    initialize();
  }, []);

  return (
    <div style={{ display: 'flex', height: '100vh' }}>
      {/* Main visualization area */}
      <div style={{ flex: 1 }}>
        {/* Your ReactFlow or other visualization component */}
      </div>
      
      {/* Side panels */}
      <div style={{ width: '300px', display: 'flex', flexDirection: 'column' }}>
        <InfoPanel
          visualizationState={visualizationState}
          asyncCoordinator={asyncCoordinator}
          open={infoPanelOpen}
          onOpenChange={setInfoPanelOpen}
          onError={(error) => console.error('InfoPanel error:', error)}
        />
        
        <StyleTuner
          value={{}}
          onChange={() => {}}
          visualizationState={visualizationState}
          asyncCoordinator={asyncCoordinator}
          open={stylePanelOpen}
          onOpenChange={setStylePanelOpen}
          onError={(error) => console.error('StyleTuner error:', error)}
        />
      </div>
    </div>
  );
}
```

### Error Handling Patterns

```tsx
import React, { useState } from 'react';
import { Hydroscope, HydroscopeData } from '@hydro-project/hydroscope';

function ErrorHandlingExample() {
  const [data, setData] = useState<HydroscopeData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleError = (error: Error, component: string) => {
    console.error(`${component} error:`, error);
    setError(`${component}: ${error.message}`);
    
    // Clear error after 5 seconds
    setTimeout(() => setError(null), 5000);
  };

  if (error) {
    return (
      <div style={{ padding: '20px', color: 'red', border: '1px solid red' }}>
        <h3>Error occurred:</h3>
        <p>{error}</p>
        <button onClick={() => setError(null)}>Dismiss</button>
      </div>
    );
  }

  return (
    <Hydroscope
      data={data}
      onFileUpload={(uploadedData, filename) => {
        try {
          // Validate data
          if (!uploadedData || !uploadedData.nodes) {
            throw new Error('Invalid data format');
          }
          setData(uploadedData);
        } catch (err) {
          handleError(err as Error, 'File Upload');
        }
      }}
      // Error handling would be implemented in the component itself
      // This is just an example of how to handle errors at the application level
    />
  );
}
```

## Migration Examples

### From HydroscopeEnhanced

```tsx
// Before (HydroscopeEnhanced)
import { HydroscopeEnhanced } from '@hydro-project/hydroscope';

function OldComponent() {
  return (
    <HydroscopeEnhanced
      data={data}
      // Embedded panel configuration
      infoPanelConfig={{ showSearch: true }}
      stylePanelConfig={{ showLayoutControls: true }}
    />
  );
}

// After (New Hydroscope)
import { Hydroscope } from '@hydro-project/hydroscope';

function NewComponent() {
  return (
    <Hydroscope
      data={data}
      showInfoPanel={true}
      showStylePanel={true}
      onFileUpload={(data, filename) => {
        // Handle file upload
      }}
      onConfigChange={(config) => {
        // Handle configuration changes
      }}
    />
  );
}
```

### From Main Branch Hydroscope

```tsx
// Before (Main Branch)
import { Hydroscope } from '@hydro-project/hydroscope';

function OldMainBranchComponent() {
  return (
    <Hydroscope
      data={data}
      // Main branch props
      onNodeClick={handleNodeClick}
      // May have architectural bugs
    />
  );
}

// After (New Clean Hydroscope)
import { Hydroscope } from '@hydro-project/hydroscope';

function NewCleanComponent() {
  return (
    <Hydroscope
      data={data}
      // Same props but with v1.0.0 architecture integration
      onNodeClick={(event, node, visualizationState) => {
        // Now includes visualizationState for better integration
        handleNodeClick(event, node, visualizationState);
      }}
      // No architectural bugs, proper error handling
      onConfigChange={(config) => {
        // Better configuration management
      }}
    />
  );
}
```

## Best Practices

1. **Always handle errors**: Implement error callbacks for graceful degradation
2. **Use TypeScript**: Leverage the comprehensive type definitions
3. **Persist settings**: Save user preferences to localStorage
4. **v1.0.0 Integration**: Use VisualizationState and AsyncCoordinator for proper architecture
5. **Performance**: Use React.memo for components that don't need frequent re-renders
6. **Accessibility**: Ensure keyboard navigation works (Ctrl+F for search)
7. **Responsive Design**: Consider different screen sizes and container dimensions