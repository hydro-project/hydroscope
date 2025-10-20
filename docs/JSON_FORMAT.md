# Hydroscope JSON Format Specification

This document describes the JSON format used to define graphs in Hydroscope.

## Overview

A Hydroscope JSON file contains a complete graph definition including nodes, edges, hierarchy configurations, styling, and metadata. The format is designed to support complex dataflow visualizations with hierarchical organization.

## Top-Level Structure

```json
{
  "nodes": [...],
  "edges": [...],
  "hierarchyChoices": [...],
  "nodeAssignments": {...},
  "nodeTypeConfig": {...},
  "edgeStyleConfig": {...},
  "legend": {...}
}
```

### Required Fields

- **`nodes`** (Array): List of all nodes in the graph
- **`edges`** (Array): List of all edges connecting nodes

### Optional Fields

- **`hierarchyChoices`** (Array): Hierarchy definitions for organizing nodes into containers
- **`nodeAssignments`** (Object): Maps nodes to hierarchy containers
- **`nodeTypeConfig`** (Object): Node type definitions and styling
- **`edgeStyleConfig`** (Object): Edge styling and semantic mappings
- **`legend`** (Object): Legend configuration for the visualization

## Node Format

Each node represents a vertex in the graph.

### Minimal Node

```json
{
  "id": "node1",
  "nodeType": "Transform",
  "shortLabel": "my_node"
}
```

### Full Node Example

```json
{
  "id": "195",
  "nodeType": "Sink",
  "shortLabel": "cycle_sink",
  "fullLabel": "cycle_sink(cycle_10)",
  "data": {
    "locationId": 2,
    "locationType": "Cluster",
    "backtrace": [
      {
        "file": "src/cluster/paxos.rs",
        "fn": "paxos_core",
        "line": 194
      }
    ]
  }
}
```

### Node Fields

- **`id`** (string, required): Unique identifier for the node
- **`nodeType`** (string, required): Type classification (e.g., "Source", "Transform", "Sink", "Join", "Network")
- **`shortLabel`** (string, required): Brief label displayed on the node
- **`fullLabel`** (string, optional): Detailed label shown in info panels
- **`data`** (object, optional): Custom metadata for the node
  - Can include any application-specific fields
  - Common fields: `locationId`, `locationType`, `backtrace`

## Edge Format

Each edge represents a connection between two nodes.

### Minimal Edge

```json
{
  "id": "e1",
  "source": "node1",
  "target": "node2"
}
```

### Full Edge Example

```json
{
  "id": "e0",
  "source": "0",
  "target": "1",
  "edgeProperties": ["Unbounded", "TotalOrder"],
  "semanticTags": ["Unbounded", "TotalOrder"]
}
```

### Edge Fields

- **`id`** (string, required): Unique identifier for the edge
- **`source`** (string, required): ID of the source node
- **`target`** (string, required): ID of the target node
- **`edgeProperties`** (array, optional): List of semantic properties
- **`semanticTags`** (array, optional): Tags used for styling (line width, pattern, animation, etc.)

## Hierarchy Configuration

Hierarchies organize nodes into nested containers.

### Hierarchy Choices

```json
{
  "hierarchyChoices": [
    {
      "id": "location",
      "name": "Location",
      "children": [
        {
          "id": "loc_0",
          "name": "hydro_test::cluster::paxos::Proposer",
          "children": []
        },
        {
          "id": "loc_1",
          "name": "hydro_test::cluster::paxos::Acceptor",
          "children": []
        }
      ]
    }
  ]
}
```

### Node Assignments

Maps each node to a container in the hierarchy:

```json
{
  "nodeAssignments": {
    "location": {
      "0": "loc_0",
      "1": "loc_0",
      "100": "loc_1",
      "101": "loc_1"
    },
    "backtrace": {
      "0": "bt_func_1",
      "1": "bt_func_2"
    }
  }
}
```

The key is the hierarchy ID (e.g., "location"), and the value is a mapping from node IDs to container IDs.

## Node Type Configuration

Defines the available node types and their visual styling.

```json
{
  "nodeTypeConfig": {
    "defaultType": "Transform",
    "types": [
      {
        "id": "Source",
        "label": "Source",
        "colorIndex": 0
      },
      {
        "id": "Transform",
        "label": "Transform",
        "colorIndex": 1
      },
      {
        "id": "Sink",
        "label": "Sink",
        "colorIndex": 5
      }
    ]
  }
}
```

## Edge Style Configuration

Defines semantic mappings for edge styling based on tags.

```json
{
  "edgeStyleConfig": {
    "semanticMappings": {
      "NetworkGroup": {
        "Local": { "line-pattern": "solid", "animation": "static" },
        "Network": { "line-pattern": "dashed", "animation": "animated" }
      },
      "OrderingGroup": {
        "TotalOrder": { "waviness": "straight" },
        "NoOrder": { "waviness": "wavy" }
      },
      "BoundednessGroup": {
        "Bounded": { "halo": "none" },
        "Unbounded": { "halo": "light-blue" }
      },
      "KeyednessGroup": {
        "NotKeyed": { "line-style": "single" },
        "Keyed": { "line-style": "double" }
      },
      "CollectionGroup": {
        "Stream": { "color": "#2563eb", "arrowhead": "triangle-filled" },
        "Singleton": { "color": "#000000", "arrowhead": "circle-filled" },
        "Optional": { "color": "#6b7280", "arrowhead": "diamond-open" }
      }
    }
  }
}
```

### Supported Style Properties

- **`line-pattern`**: "solid" or "dashed"
- **`line-style`**: "single" (plain line) or "hash-marks" (line with vertical hash marks for keyed streams)
- **`waviness`**: "straight" or "wavy" (for ordering information)
- **`animation`**: "static" or "animated"
- **`arrowhead`**: "triangle-filled", "circle-filled", "diamond-open"
- **`halo`**: "none", "light-blue" (transparent halo for unbounded streams)
- **`color`**: Hex color code for the edge (e.g., "#001f3f" for navy blue)

## Legend Configuration

Defines the legend displayed in the visualization.

```json
{
  "legend": {
    "title": "Node Types",
    "items": [
      { "type": "Source", "label": "Source" },
      { "type": "Transform", "label": "Transform" },
      { "type": "Sink", "label": "Sink" }
    ]
  }
}
```

## Complete Minimal Example

```json
{
  "nodes": [
    {
      "id": "1",
      "nodeType": "Source",
      "shortLabel": "input"
    },
    {
      "id": "2",
      "nodeType": "Transform",
      "shortLabel": "process"
    },
    {
      "id": "3",
      "nodeType": "Sink",
      "shortLabel": "output"
    }
  ],
  "edges": [
    {
      "id": "e1",
      "source": "1",
      "target": "2"
    },
    {
      "id": "e2",
      "source": "2",
      "target": "3"
    }
  ]
}
```

## Best Practices

1. **Node IDs**: Use consistent, meaningful identifiers
2. **Labels**: Keep `shortLabel` concise (1-2 words); use `fullLabel` for details
3. **Node Types**: Define a clear set of types that represent your domain
4. **Hierarchies**: Use hierarchies to organize large graphs (>50 nodes)
5. **Edge Semantics**: Use consistent semantic tags across your edges
6. **Custom Data**: Store application-specific metadata in the `data` field

## Loading JSON Files

See the [README](../README.md) for examples of loading JSON files in your application.

## Sample Files

Example JSON files are available in the `test-data/` directory:
- `test-data/paxos.json` - Complex distributed system (543 nodes, 581 edges)
- `test-data/chat.json` - Simpler chat application example

## Further Reading

- [Main README](../README.md) - Getting started and API reference
- [Development Documentation](development/) - Architecture and implementation details
