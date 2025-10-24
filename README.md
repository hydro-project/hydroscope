# @hydro-project/hydroscope

[![CI](https://github.com/hydro-project/hydro/actions/workflows/ci.yml/badge.svg)](https://github.com/hydro-project/hydro/actions/workflows/ci.yml)

A web-based interactive graph visualization and exploration library, well suited for exploring large directed graphs, especially those that have nested subgraph structure.

Hydroscope was originally designed for visualizing [Hydro](https://hydro.run) dataflow graphs, which come with two distinct nested hierarchies: call stacks and runtime locations. However Hydroscope is not tightly coupled to Hydro and is configurable for use with any directed graph -- nested or flat.

## Features

- **Hierarchical Graph Visualization**: Visualize complex nested container structures with automatic layout
- **Interactive Controls**: Pan, zoom, search, and navigate through graph hierarchies
- **Smart Node Collapsing**: Collapse and expand containers with preserved relationships
- **Search and Focus**: Functionality to search for nodes in the graph and hide subgraphs to improve focus.
- **Info Panels**: View detailed node information with context-aware popups

## Installation

```bash
npm install @hydro-project/hydroscope
```

## Usage Guides

- **[Embedding Hydroscope](docs/EMBEDDING.md)** - Complete guide with examples, props, and patterns
- **[Embedding HydroscopeCore](docs/EMBEDDING_CORE.md)** - Advanced customization guide
- **[JSON Format](docs/JSON_FORMAT.md)** - Data format specification

## Quick Start

### Loading from JSON File

The most common way to use Hydroscope is to load a graph from a JSON file:

```tsx
import { Hydroscope } from "@hydro-project/hydroscope";
import "@hydro-project/hydroscope/style.css";
import { useState, useEffect } from "react";

function App() {
  const [graphData, setGraphData] = useState(null);

  useEffect(() => {
    // Load your graph JSON file
    fetch("/data/my-graph.json")
      .then((res) => res.json())
      .then((data) => setGraphData(data))
      .catch((err) => console.error("Failed to load graph:", err));
  }, []);

  if (!graphData) return <div>Loading...</div>;

  return (
    <div style={{ width: "100vw", height: "100vh" }}>
      <Hydroscope
        initialGraph={graphData}
        onReady={(api) => console.log("Graph ready!", api)}
      />
    </div>
  );
}
```

### Minimal JSON Example

The simplest graph requires just nodes and edges:

```json
{
  "nodes": [
    { "id": "1", "nodeType": "Source", "shortLabel": "input" },
    { "id": "2", "nodeType": "Transform", "shortLabel": "process" },
    { "id": "3", "nodeType": "Sink", "shortLabel": "output" }
  ],
  "edges": [
    { "id": "e1", "source": "1", "target": "2" },
    { "id": "e2", "source": "2", "target": "3" }
  ]
}
```

### Loading from URL or File Upload

```tsx
function GraphViewer() {
  const [graphData, setGraphData] = useState(null);

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const data = JSON.parse(e.target.result);
        setGraphData(data);
      };
      reader.readAsText(file);
    }
  };

  return (
    <div>
      <input type="file" accept=".json" onChange={handleFileUpload} />
      {graphData && (
        <div style={{ width: "100vw", height: "90vh" }}>
          <Hydroscope initialGraph={graphData} />
        </div>
      )}
    </div>
  );
}
```

For complete JSON format documentation, see [JSON Format Specification](docs/JSON_FORMAT.md).

## API Reference

### `<Hydroscope />` Component

#### Props

- `initialGraph`: Graph data with nodes and edges
- `onReady`: Callback invoked when the graph is rendered and interactive
- `enableSearch`: Enable/disable search functionality (default: true)
- `enableHierarchyTree`: Show hierarchy tree view (default: true)
- `layoutOptions`: Custom ELK layout configuration

### API Methods

When `onReady` is called, you receive an API object with methods:

- `getNodes()`: Get all nodes in the graph
- `getEdges()`: Get all edges in the graph
- `centerNode(nodeId)`: Center view on a specific node
- `collapseContainer(nodeId)`: Collapse a container node
- `expandContainer(nodeId)`: Expand a container node
- `search(query)`: Search for nodes by label

## Styling

Import the default styles in your application:

```tsx
import "@hydro-project/hydroscope/style.css";
```

You can customize the appearance by overriding CSS variables or providing your own styles.

## Development

This project uses:

- **TypeScript** for type safety
- **React Flow** for graph rendering
- **ELK** (Eclipse Layout Kernel) for graph layout
- **Vitest** for testing
- **Rollup** for building

### Setup

```bash
npm install
npm run build
npm test
```

### Running Tests

```bash
# Run all tests
npm test

# Run performance tests
npm run test:performance
```

## Documentation

For detailed documentation, see:

- **[JSON Format Specification](docs/JSON_FORMAT.md)** - Complete guide to the graph JSON format
- [Development Documentation](docs/development/) - Architecture and implementation details
- [Logging Guide](docs/development/LOGGING.md) - Debugging and logging patterns
- [Bridge Architecture](docs/development/bridge-reset-architecture.md) - Bridge pattern details
- [Performance Testing](src/__tests__/performance/README.md) - Performance test suite

## Sample Data

Example JSON files are available in `test-data/`:
- `paxos.json` - Complex distributed system (543 nodes, 581 edges)
- `chat.json` - Simpler chat application example

These can be used as templates for your own graph data.

## Contributing

Contributions are welcome! Please ensure all tests pass and follow the existing code style.

## License

Apache-2.0 - See [LICENSE](LICENSE) for details.

## Credits

Built by the [Hydro Project](https://github.com/hydro-project) team.
