# Panel Integration Guide

This guide explains how to integrate InfoPanel and StyleTuner components with the Hydroscope visualization component, including advanced patterns for custom layouts and v6 architecture integration.

## Overview

The Hydroscope component provides seamless integration with InfoPanel and StyleTuner components through:

- **Automatic State Coordination**: Panels automatically sync with visualization state
- **V6 Architecture Integration**: Proper use of VisualizationState and AsyncCoordinator
- **Error Isolation**: Panel errors don't crash the main visualization
- **Settings Persistence**: Panel states are automatically saved to localStorage
- **Keyboard Shortcuts**: Built-in shortcuts for common panel operations

## Basic Panel Integration

### Automatic Integration (Recommended)

The simplest way to use panels is through the main Hydroscope component:

```tsx
import React, { useState } from 'react';
import { Hydroscope, HydroscopeData } from '@hydro-project/hydroscope';

function BasicPanelIntegration() {
  const [data, setData] = useState<HydroscopeData | null>(null);

  return (
    <div style={{ height: '100vh', width: '100vw' }}>
      <Hydroscope
        data={data}
        // Panel visibility controls
        showInfoPanel={true}
        showStylePanel={true}
        
        // Panel integration callbacks
        onFileUpload={(uploadedData, filename) => {
          console.log(`File loaded: ${filename}`);
          setData(uploadedData);
        }}
        onConfigChange={(config) => {
          console.log('Style configuration changed:', config);
        }}
        onContainerCollapse={(containerId, visualizationState) => {
          console.log(`Container ${containerId} collapsed`);
        }}
        onContainerExpand={(containerId, visualizationState) => {
          console.log(`Container ${containerId} expanded`);
        }}
      />
    </div>
  );
}
```

### Panel State Management

The Hydroscope component automatically manages panel state:

```tsx
function PanelStateExample() {
  return (
    <Hydroscope
      data={data}
      showInfoPanel={true}
      showStylePanel={true}
      
      // Initial panel configuration
      initialLayoutAlgorithm="layered"
      initialColorPalette="Set2"
      
      // Settings are automatically persisted to localStorage
      // Panel open/closed state is remembered across sessions
    />
  );
}
```

## Advanced Panel Integration

### Custom Panel Layout

For custom layouts, use panels as standalone components:

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

function CustomPanelLayout() {
  const [visualizationState, setVisualizationState] = useState<VisualizationState | null>(null);
  const [asyncCoordinator, setAsyncCoordinator] = useState<AsyncCoordinator | null>(null);
  const [infoPanelOpen, setInfoPanelOpen] = useState(true);
  const [stylePanelOpen, setStylePanelOpen] = useState(false);
  const [styleConfig, setStyleConfig] = useState({});

  // Initialize v6 architecture
  useEffect(() => {
    const initialize = async () => {
      try {
        const visState = new VisualizationState();
        const coordinator = new AsyncCoordinator();
        
        // Load your data into visualization state
        // await visState.loadData(yourData);
        
        setVisualizationState(visState);
        setAsyncCoordinator(coordinator);
      } catch (error) {
        console.error('Failed to initialize v6 architecture:', error);
      }
    };

    initialize();
  }, []);

  return (
    <div style={{ display: 'flex', height: '100vh' }}>
      {/* Main visualization area */}
      <div style={{ flex: 1 }}>
        {/* Your custom ReactFlow or other visualization */}
      </div>
      
      {/* Custom panel layout */}
      <div style={{ width: '350px', display: 'flex', flexDirection: 'column' }}>
        {/* InfoPanel with custom positioning */}
        <div style={{ height: '60%', borderBottom: '1px solid #ddd' }}>
          <InfoPanel
            visualizationState={visualizationState}
            asyncCoordinator={asyncCoordinator}
            open={infoPanelOpen}
            onOpenChange={setInfoPanelOpen}
            onSearchUpdate={(query, matches, current) => {
              console.log(`Search: "${query}" - ${matches.length} matches`);
              if (current) {
                console.log(`Current match: ${current.label}`);
              }
            }}
            onToggleContainer={(containerId) => {
              console.log(`Container ${containerId} toggled`);
            }}
            onError={(error) => {
              console.error('InfoPanel error:', error);
              // Implement custom error handling
            }}
          />
        </div>
        
        {/* StyleTuner with custom positioning */}
        <div style={{ height: '40%' }}>
          <StyleTuner
            value={styleConfig}
            onChange={setStyleConfig}
            open={stylePanelOpen}
            onOpenChange={setStylePanelOpen}
            onLayoutChange={(layout) => {
              console.log(`Layout changed to: ${layout}`);
            }}
            onPaletteChange={(palette) => {
              console.log(`Palette changed to: ${palette}`);
            }}
            onError={(error) => {
              console.error('StyleTuner error:', error);
              // Implement custom error handling
            }}
          />
        </div>
      </div>
    </div>
  );
}
```

### Panel Communication Patterns

#### Search Coordination

```tsx
function SearchCoordinationExample() {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchMatches, setSearchMatches] = useState([]);
  const [currentMatch, setCurrentMatch] = useState(null);

  const handleSearchUpdate = useCallback((query, matches, current) => {
    setSearchQuery(query);
    setSearchMatches(matches);
    setCurrentMatch(current);
    
    // Highlight search results in visualization
    if (current && visualizationState) {
      // Focus on the current search match
      visualizationState.focusNode(current.id);
    }
  }, [visualizationState]);

  return (
    <InfoPanel
      visualizationState={visualizationState}
      open={true}
      onOpenChange={() => {}}
      onSearchUpdate={handleSearchUpdate}
      // Search state is managed by InfoPanel internally
      // but you can coordinate with external components
    />
  );
}
```

#### Style Configuration Sync

```tsx
function StyleConfigSyncExample() {
  const [globalStyleConfig, setGlobalStyleConfig] = useState({
    edgeStyle: 'bezier',
    edgeWidth: 2,
    nodePadding: 8
  });

  const handleStyleChange = useCallback((newConfig) => {
    setGlobalStyleConfig(newConfig);
    
    // Apply changes to visualization
    if (visualizationState) {
      // Update visualization styling
      visualizationState.updateRenderConfig(newConfig);
    }
    
    // Persist to localStorage
    try {
      localStorage.setItem('custom-style-config', JSON.stringify(newConfig));
    } catch (error) {
      console.error('Failed to save style config:', error);
    }
  }, [visualizationState]);

  return (
    <StyleTuner
      value={globalStyleConfig}
      onChange={handleStyleChange}
      open={true}
      onOpenChange={() => {}}
      // Configuration is automatically applied to visualization
    />
  );
}
```

## V6 Architecture Integration

### Proper VisualizationState Usage

```tsx
function V6IntegrationExample() {
  const [visualizationState, setVisualizationState] = useState(null);
  const [asyncCoordinator, setAsyncCoordinator] = useState(null);

  // Initialize v6 architecture properly
  useEffect(() => {
    const initializeV6 = async () => {
      try {
        // Create v6 instances
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
        
        // Load data if available
        if (data) {
          await visState.loadData(data);
          await elkBridge.layout(visState);
        }
        
        setVisualizationState(visState);
        setAsyncCoordinator(coordinator);
      } catch (error) {
        console.error('V6 initialization failed:', error);
      }
    };

    initializeV6();
  }, [data]);

  return (
    <>
      <InfoPanel
        visualizationState={visualizationState}
        asyncCoordinator={asyncCoordinator}
        open={true}
        onOpenChange={() => {}}
        // V6 integration enables advanced features
      />
      
      <StyleTuner
        visualizationState={visualizationState}
        asyncCoordinator={asyncCoordinator}
        value={styleConfig}
        onChange={setStyleConfig}
        open={true}
        onOpenChange={() => {}}
        // V6 integration enables layout coordination
      />
    </>
  );
}
```

### Container Operations with V6

```tsx
function ContainerOperationsExample() {
  const handleContainerToggle = useCallback(async (containerId) => {
    if (!asyncCoordinator || !visualizationState) return;

    try {
      // Use v6 AsyncCoordinator for proper operation sequencing
      const isCollapsed = visualizationState.isContainerCollapsed(containerId);
      
      if (isCollapsed) {
        await asyncCoordinator.expandContainer(visualizationState, containerId, {
          triggerLayout: true,
          animateTransition: true
        });
      } else {
        await asyncCoordinator.collapseContainer(visualizationState, containerId, {
          triggerLayout: true,
          animateTransition: true
        });
      }
      
      // Update ReactFlow visualization
      const updatedData = reactFlowBridge.toReactFlowData(visualizationState);
      setReactFlowData(updatedData);
      
    } catch (error) {
      console.error('Container operation failed:', error);
    }
  }, [asyncCoordinator, visualizationState, reactFlowBridge]);

  return (
    <InfoPanel
      visualizationState={visualizationState}
      asyncCoordinator={asyncCoordinator}
      open={true}
      onOpenChange={() => {}}
      onToggleContainer={handleContainerToggle}
      // Container operations are properly coordinated
    />
  );
}
```

## Error Handling Patterns

### Panel Error Isolation

```tsx
function ErrorIsolationExample() {
  const [panelErrors, setPanelErrors] = useState({});

  const handlePanelError = useCallback((panelName, error) => {
    console.error(`${panelName} error:`, error);
    
    setPanelErrors(prev => ({
      ...prev,
      [panelName]: error.message
    }));
    
    // Clear error after 5 seconds
    setTimeout(() => {
      setPanelErrors(prev => {
        const { [panelName]: _, ...rest } = prev;
        return rest;
      });
    }, 5000);
  }, []);

  return (
    <>
      {/* Error display */}
      {Object.entries(panelErrors).map(([panel, error]) => (
        <div key={panel} style={{
          position: 'fixed',
          top: '10px',
          right: '10px',
          padding: '8px 12px',
          backgroundColor: '#fff3cd',
          border: '1px solid #ffeaa7',
          borderRadius: '4px',
          zIndex: 9999
        }}>
          {panel} error: {error}
        </div>
      ))}
      
      {/* Panels with error isolation */}
      <InfoPanel
        visualizationState={visualizationState}
        open={true}
        onOpenChange={() => {}}
        onError={(error) => handlePanelError('InfoPanel', error)}
      />
      
      <StyleTuner
        value={styleConfig}
        onChange={setStyleConfig}
        open={true}
        onOpenChange={() => {}}
        onError={(error) => handlePanelError('StyleTuner', error)}
      />
    </>
  );
}
```

### Graceful Degradation

```tsx
function GracefulDegradationExample() {
  const [panelAvailability, setPanelAvailability] = useState({
    infoPanel: true,
    stylePanel: true
  });

  const handlePanelFailure = useCallback((panelName) => {
    setPanelAvailability(prev => ({
      ...prev,
      [panelName]: false
    }));
    
    console.warn(`${panelName} disabled due to error`);
  }, []);

  return (
    <>
      {/* Main visualization always works */}
      <div style={{ flex: 1 }}>
        {/* Your visualization component */}
      </div>
      
      {/* Conditionally render panels */}
      {panelAvailability.infoPanel ? (
        <InfoPanel
          visualizationState={visualizationState}
          open={true}
          onOpenChange={() => {}}
          onError={(error) => {
            console.error('InfoPanel failed:', error);
            handlePanelFailure('infoPanel');
          }}
        />
      ) : (
        <div style={{ padding: '20px', color: '#666' }}>
          InfoPanel temporarily unavailable
        </div>
      )}
      
      {panelAvailability.stylePanel ? (
        <StyleTuner
          value={styleConfig}
          onChange={setStyleConfig}
          open={true}
          onOpenChange={() => {}}
          onError={(error) => {
            console.error('StyleTuner failed:', error);
            handlePanelFailure('stylePanel');
          }}
        />
      ) : (
        <div style={{ padding: '20px', color: '#666' }}>
          StyleTuner temporarily unavailable
        </div>
      )}
    </>
  );
}
```

## Performance Optimization

### Panel Memoization

```tsx
import React, { memo, useMemo } from 'react';

// Memoize panels to prevent unnecessary re-renders
const MemoizedInfoPanel = memo(InfoPanel);
const MemoizedStyleTuner = memo(StyleTuner);

function OptimizedPanelIntegration() {
  // Memoize expensive computations
  const panelProps = useMemo(() => ({
    visualizationState,
    asyncCoordinator,
    // Only recreate when these dependencies change
  }), [visualizationState, asyncCoordinator]);

  const styleConfig = useMemo(() => ({
    edgeStyle: 'bezier',
    edgeWidth: 2,
    // Memoize style configuration
  }), [/* style dependencies */]);

  return (
    <>
      <MemoizedInfoPanel
        {...panelProps}
        open={infoPanelOpen}
        onOpenChange={setInfoPanelOpen}
      />
      
      <MemoizedStyleTuner
        value={styleConfig}
        onChange={setStyleConfig}
        open={stylePanelOpen}
        onOpenChange={setStylePanelOpen}
      />
    </>
  );
}
```

### Lazy Panel Loading

```tsx
import React, { lazy, Suspense } from 'react';

// Lazy load panels for better initial performance
const LazyInfoPanel = lazy(() => import('@hydro-project/hydroscope/panels/InfoPanel'));
const LazyStyleTuner = lazy(() => import('@hydro-project/hydroscope/panels/StyleTuner'));

function LazyPanelIntegration() {
  return (
    <>
      {infoPanelOpen && (
        <Suspense fallback={<div>Loading InfoPanel...</div>}>
          <LazyInfoPanel
            visualizationState={visualizationState}
            open={true}
            onOpenChange={setInfoPanelOpen}
          />
        </Suspense>
      )}
      
      {stylePanelOpen && (
        <Suspense fallback={<div>Loading StyleTuner...</div>}>
          <LazyStyleTuner
            value={styleConfig}
            onChange={setStyleConfig}
            open={true}
            onOpenChange={setStylePanelOpen}
          />
        </Suspense>
      )}
    </>
  );
}
```

## Keyboard Shortcuts Integration

### Built-in Shortcuts

The Hydroscope component provides built-in keyboard shortcuts:

- **Ctrl+F / Cmd+F**: Focus search in InfoPanel
- **Escape**: Close panels or clear search
- **Ctrl+Shift+I**: Toggle InfoPanel

### Custom Shortcuts

```tsx
function CustomShortcutsExample() {
  useEffect(() => {
    const handleKeyDown = (event) => {
      // Ctrl+Shift+S: Toggle StyleTuner
      if (event.ctrlKey && event.shiftKey && event.key === 'S') {
        event.preventDefault();
        setStylePanelOpen(prev => !prev);
      }
      
      // Ctrl+R: Reset to defaults
      if (event.ctrlKey && event.key === 'r') {
        event.preventDefault();
        setStyleConfig(getDefaultStyleConfig());
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <Hydroscope
      data={data}
      showInfoPanel={true}
      showStylePanel={true}
      // Built-in shortcuts work automatically
    />
  );
}
```

## Best Practices

### 1. Always Handle Errors

```tsx
// Always provide error callbacks
<InfoPanel
  onError={(error) => {
    console.error('InfoPanel error:', error);
    // Implement fallback behavior
  }}
/>
```

### 2. Use V6 Architecture Properly

```tsx
// Initialize v6 components correctly
const visState = new VisualizationState();
const coordinator = new AsyncCoordinator();

// Pass to panels for enhanced functionality
<InfoPanel
  visualizationState={visState}
  asyncCoordinator={coordinator}
/>
```

### 3. Optimize Performance

```tsx
// Memoize panels and expensive computations
const MemoizedPanel = memo(InfoPanel);

const panelProps = useMemo(() => ({
  visualizationState,
  asyncCoordinator
}), [visualizationState, asyncCoordinator]);
```

### 4. Persist Settings

```tsx
// Settings are automatically persisted in Hydroscope component
// For custom implementations, handle persistence manually
useEffect(() => {
  localStorage.setItem('panel-config', JSON.stringify(config));
}, [config]);
```

### 5. Provide Fallbacks

```tsx
// Always provide fallback UI for panel failures
{panelError ? (
  <div>Panel temporarily unavailable</div>
) : (
  <InfoPanel {...props} />
)}
```

This guide covers the essential patterns for integrating InfoPanel and StyleTuner components with Hydroscope visualizations. The key is to leverage the v6 architecture properly while providing robust error handling and performance optimization.