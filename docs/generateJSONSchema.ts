/**
 * JSON Schema Documentation Generator
 * 
 * AUTO-GENERATED - DO NOT EDIT MANUALLY
 * Last updated: 2025-08-21T23:14:19.441Z
 * Source: JSONParser.ts interfaces
 *
 * Example usage:
 * import { Hydroscope } from '@hydro-project/hydroscope';
 * <Hydroscope data={example} />
 *
 * For minimal rendering:
 * import { HydroscopeCore } from '@hydro-project/hydroscope';
 * <HydroscopeCore data={example} />
 */

// Generated from JSONParser.ts interfaces
export interface GroupingOptionSchema {
  id: string;
  name: string;
}

export interface ParseResultSchema {
  state: any;
  metadata: {
  selectedGrouping: string | null;
  nodeCount: number;
  edgeCount: number;
  containerCount: number;
  availableGroupings: any[];
  edgeStyleConfig?: {
  propertyMappings: Record<string, any>;
  };
  nodeTypeConfig?: {
  defaultType?: string;
  types?: Array<{
  id: string;
  label: string;
  colorIndex: number;
  }>;
  };
  };
}

export interface ValidationResultSchema {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  nodeCount: number;
  edgeCount: number;
  hierarchyCount: number;
}

export interface ParserOptionsSchema {
  validateData?: boolean;
  strictMode?: boolean;
  defaultNodeStyle?: any;
  defaultEdgeStyle?: any;
}

export interface RawNodeSchema {
  id: string;
  semanticTags?: string[];
  [key: string]: any;
}

export interface RawEdgeSchema {
  id: string;
  source: string;
  target: string;
  semanticTags?: string[];
  [key: string]: any;
}

export interface RawHierarchySchema {
  id: string;
  name: string;
  groups: Record<string, string[]>;
}

export interface RawHierarchyChoiceSchema {
  id: string;
  name: string;
  children?: RawHierarchyItemSchema[];  // Direct children, no wrapper
}

export interface RawHierarchyItemSchema {
  id: string;
  name: string;
  children?: RawHierarchyItemSchema[];
}

export interface RawGraphDataSchema {
  nodes: RawNodeSchema[];
  edges: RawEdgeSchema[];
  hierarchyChoices?: RawHierarchyChoiceSchema[];
  nodeAssignments?: Record<string, Record<string, string>>;
  edgeStyleConfig?: {
    propertyMappings: Record<string, any>;
  };
  nodeTypeConfig?: {
    defaultType?: string;
    types?: Array<{
      id: string;
      label: string;
      colorIndex: number;
    }>;
  };
  metadata?: Record<string, any>;
}

/**
 * Generate JSON schema documentation from TypeScript interfaces
 * AUTO-GENERATED from actual parser interfaces
 */
export function generateSchemaDocumentation(): {
  requiredExample: string;
  optionalExample: string;
  completeExample: string;
  description: string;
} {
  // These examples are derived from the actual TypeScript interfaces
  const requiredExample = `{
  "nodes": [
    { "id": "0", "nodeType": "Source", "shortLabel": "source_iter", "fullLabel": "source_iter" },
    { "id": "1", "nodeType": "Transform", "shortLabel": "persist", "fullLabel": "persist [state storage]" },
    { "id": "2", "nodeType": "Network", "shortLabel": "network(recv)", "fullLabel": "network(ser + deser)" }
  ],
  "edges": [
    { "id": "e0", "source": "0", "target": "1", "semanticTags": ["Unbounded", "TotalOrder"] },
    { "id": "e1", "source": "1", "target": "2", "semanticTags": ["TotalOrder", "Unbounded", "Network"] }
  ]
}`;

  const optionalExample = `{
  "hierarchyChoices": [
    {
      "id": "location",
      "name": "Location",
      "children": [
        { "id": "loc_0", "name": "Clients" },
        { "id": "loc_1", "name": "Server" }
      ]
    }
  ],
  "nodeAssignments": {
    "location": {
      "0": "loc_0",
      "1": "loc_0",
      "2": "loc_1"
    }
  },
  "edgeStyleConfig": {
    "propertyMappings": {
      "Unbounded": "thin-stroke",
      "TotalOrder": "smooth-line",
      "Network": "dashed-animated"
    }
  },
  "nodeTypeConfig": {
    "defaultType": "Transform",
    "types": [
      { "id": "Source", "label": "Source", "colorIndex": 0 },
      { "id": "Transform", "label": "Transform", "colorIndex": 1 },
      { "id": "Network", "label": "Network", "colorIndex": 2 }
    ]
  }
}`;

  const description = `
This JSON format is used by the Hydro visualization system to represent graph data.
The schema is automatically maintained to stay in sync with the JSONParser implementation.

Key features:
- Nodes and edges are required (minimal: id, source, target)
- Your own rich node metadata via 'data' field (nodeType, labels, backtrace, location info)
- Edge styling via semanticTags
- Support for multiple nesting hierarchies via hierarchyChoices
- Extensive styling and configuration options
- Node type configuration for visual categorization
- Legend support for documentation (display only)
- Semantic tags for flexible categorization
- All additional properties are preserved by the parser

Generated: 2025-08-21T23:14:19.441Z
`;

  const completeExample = JSON.stringify(generateCompleteExample(), null, 2);

  return {
    requiredExample,
    optionalExample,
    completeExample,
    description: description.trim()
  };
}

/**
 * Generate a complete, valid example JSON that can be used as a working sample
 */
export function generateCompleteExample() {
  return {
    "nodes": [
      {
        "id": "web_server",
        "nodeType": "Transform",
        "fullLabel": "Web Server (HTTP Handler)",
        "shortLabel": "WebSrv",
        "semanticTags": ["critical", "backend"],
        "data": {
          "locationId": 1,
          "locationType": "Process",
          "backtrace": [
            {
              "file": "src/server.rs",
              "fn": "handle_request",
              "line": 42
            },
            {
              "file": "main.rs",
              "fn": "main",
              "line": 15
            }
          ]
        }
      },
      {
        "id": "database",
        "nodeType": "Sink",
        "fullLabel": "PostgreSQL Database",
        "shortLabel": "DB",
        "label": "Database",
        "semanticTags": ["critical", "storage"],
        "data": {
          "locationId": 2,
          "locationType": "Process"
        }
      },
      {
        "id": "cache",
        "nodeType": "Transform",
        "fullLabel": "Redis Cache (In-Memory)",
        "shortLabel": "Cache",
        "semanticTags": ["performance", "storage"],
      },
      {
        "id": "load_balancer",
        "nodeType": "Source",
        "fullLabel": "HAProxy Load Balancer",
        "shortLabel": "LB",
        "semanticTags": ["network", "frontend"],
      }
    ],
    "edges": [
      {
        "id": "e1",
        "source": "load_balancer",
        "target": "web_server",
        "label": "HTTP",
        "semanticTags": ["Network", "TotalOrder", "Unbounded"]
      },
      {
        "id": "e2", 
        "source": "web_server",
        "target": "database",
        "label": "SQL Query",
        "semanticTags": ["Bounded", "TotalOrder"]
      },
      {
        "id": "e3",
        "source": "web_server", 
        "target": "cache",
        "label": "Cache Check",
        "semanticTags": ["Keyed", "NoOrder", "Unbounded"]
      }
    ],
    "hierarchyChoices": [
      {
        "id": "by_layer",
        "name": "Architecture Layer",
        "children": [
          {
            "id": "frontend",
            "name": "Frontend Layer"
          },
          {
            "id": "backend", 
            "name": "Backend Layer"
          },
          {
            "id": "storage",
            "name": "Storage Layer"
          }
        ]
      },
      {
        "id": "by_criticality",
        "name": "Criticality",
        "children": [
          {
            "id": "critical_services",
            "name": "Critical Services"
          },
          {
            "id": "support_services",
            "name": "Support Services"
          }
        ]
      }
    ],
    "nodeAssignments": {
      "by_layer": {
        "load_balancer": "frontend",
        "web_server": "backend",
        "database": "storage",
        "cache": "storage"
      },
      "by_criticality": {
        "web_server": "critical_services",
        "database": "critical_services", 
        "cache": "support_services",
        "load_balancer": "support_services"
      }
    },
    "edgeStyleConfig": {
      "propertyMappings": {
        "Bounded": "thick-stroke",
        "Keyed": "double-line",
        "Network": "dashed-animated",
        "NoOrder": "wavy-line",
        "TotalOrder": "smooth-line",
        "Unbounded": "thin-stroke"
      }
    },
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
          "colorIndex": 2
        },
        {
          "id": "Network",
          "label": "Network",
          "colorIndex": 3
        }
      ]
    }
  };
}

/**
 * Version information for schema tracking
 */
export const SCHEMA_VERSION = "v4.0.0";
export const LAST_UPDATED = "2025-08-21T23:14:19.441Z";