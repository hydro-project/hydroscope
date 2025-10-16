/**
 * Performance Test Configuration
 * Defines thresholds, test scenarios, and performance baselines
 */

export interface PerformanceThresholds {
  // Core operation thresholds (milliseconds)
  jsonParse: number;
  visualizationStateLoad: number;
  elkConversion: number;
  elkLayout: number;
  reactFlowConversion: number;
  containerOperations: number;
  searchOperations: number;

  // Memory thresholds (MB)
  memoryUsage: number;
  memoryGrowth: number;

  // Throughput thresholds (operations per second)
  nodeProcessingThroughput: number;
  edgeProcessingThroughput: number;
  searchThroughput: number;
}

export const DEFAULT_PERFORMANCE_THRESHOLDS: PerformanceThresholds = {
  // Core operations - based on paxos.json complexity (adjusted for test environment)
  jsonParse: 1000, // JSON parsing with validation (increased for test env)
  visualizationStateLoad: 400, // Loading parsed data into state
  elkConversion: 200, // Converting to ELK format
  elkLayout: 4000, // ELK layout processing (most expensive)
  reactFlowConversion: 300, // Converting to ReactFlow format
  containerOperations: 100, // Container expand/collapse
  searchOperations: 200, // Search with highlighting

  // Memory constraints (adjusted for test environment)
  memoryUsage: 300, // Peak memory usage (increased for test env)
  memoryGrowth: 50, // Memory growth per operation (increased for test env)

  // Throughput requirements
  nodeProcessingThroughput: 500, // Nodes processed per second (reduced for test env)
  edgeProcessingThroughput: 1000, // Edges processed per second (reduced for test env)
  searchThroughput: 50, // Search operations per second (reduced for test env)
};

export interface TestScenario {
  name: string;
  description: string;
  iterations: number;
  warmupIterations: number;
  dataSize: "small" | "medium" | "large" | "paxos";
  operations: string[];
}

export const PERFORMANCE_TEST_SCENARIOS: TestScenario[] = [
  {
    name: "baseline",
    description: "Basic functionality with paxos.json",
    iterations: 5,
    warmupIterations: 2,
    dataSize: "paxos",
    operations: ["parse", "load", "elk-convert", "reactflow-convert"],
  },
  {
    name: "container-stress",
    description: "Intensive container operations",
    iterations: 10,
    warmupIterations: 3,
    dataSize: "paxos",
    operations: ["expand-all", "collapse-all", "individual-toggles"],
  },
  {
    name: "search-stress",
    description: "Multiple search operations",
    iterations: 20,
    warmupIterations: 5,
    dataSize: "paxos",
    operations: ["search-common", "search-rare", "search-clear"],
  },
  {
    name: "memory-leak",
    description: "Memory leak detection over many iterations",
    iterations: 50,
    warmupIterations: 10,
    dataSize: "paxos",
    operations: ["full-pipeline"],
  },
  {
    name: "large-graph",
    description: "Performance with large synthetic graphs",
    iterations: 3,
    warmupIterations: 1,
    dataSize: "large",
    operations: ["parse", "load", "elk-convert"],
  },
];

export interface PerformanceBaseline {
  version: string;
  timestamp: number;
  environment: {
    nodeVersion: string;
    platform: string;
    arch: string;
    cpus: number;
    memory: number;
  };
  thresholds: PerformanceThresholds;
  results: Record<
    string,
    {
      duration: number;
      memoryGrowth: number;
      throughput?: number;
    }
  >;
}

import * as os from "os";

export function getCurrentEnvironment() {
  return {
    nodeVersion: process.version,
    platform: process.platform,
    arch: process.arch,
    cpus: os.cpus().length,
    memory: Math.round(os.totalmem() / 1024 / 1024 / 1024), // GB
  };
}

export function createPerformanceBaseline(
  version: string,
  results: Record<string, any>,
): PerformanceBaseline {
  return {
    version,
    timestamp: Date.now(),
    environment: getCurrentEnvironment(),
    thresholds: DEFAULT_PERFORMANCE_THRESHOLDS,
    results,
  };
}

// Performance test data generators
export function generateSyntheticGraphData(size: "small" | "medium" | "large") {
  const configs = {
    small: { nodes: 100, edges: 150, containers: 10 },
    medium: { nodes: 500, edges: 750, containers: 25 },
    large: { nodes: 2000, edges: 3000, containers: 50 },
  };

  const config = configs[size];
  const nodes = [];
  const edges = [];
  const containers = [];

  // Generate nodes
  for (let i = 0; i < config.nodes; i++) {
    nodes.push({
      id: `node_${i}`,
      label: `Node ${i}`,
      longLabel: `This is a longer label for node ${i} with more details`,
      type: i % 3 === 0 ? "source" : i % 3 === 1 ? "operator" : "sink",
      semanticTags: [`tag_${i % 5}`, `category_${i % 3}`],
    });
  }

  // Generate containers
  for (let i = 0; i < config.containers; i++) {
    containers.push({
      id: `container_${i}`,
      label: `Container ${i}`,
      type: "container",
      semanticTags: [`container_tag_${i % 3}`],
    });
  }

  // Generate edges
  for (let i = 0; i < config.edges; i++) {
    const sourceIdx = Math.floor(Math.random() * config.nodes);
    let targetIdx = Math.floor(Math.random() * config.nodes);

    // Ensure no self-loops
    while (targetIdx === sourceIdx) {
      targetIdx = Math.floor(Math.random() * config.nodes);
    }

    edges.push({
      id: `edge_${i}`,
      source: `node_${sourceIdx}`,
      target: `node_${targetIdx}`,
      type: i % 2 === 0 ? "data" : "control",
      semanticTags: [`edge_tag_${i % 4}`],
    });
  }

  // Generate node assignments (assign nodes to containers)
  const nodeAssignments: Record<string, string> = {};
  for (let i = 0; i < config.nodes; i++) {
    const containerIdx = Math.floor(Math.random() * config.containers);
    nodeAssignments[`node_${i}`] = `container_${containerIdx}`;
  }

  return {
    nodes,
    edges,
    containers,
    hierarchyChoices: [
      {
        id: "synthetic",
        name: "synthetic",
        displayName: "Synthetic Grouping",
      },
    ],
    nodeAssignments: {
      synthetic: nodeAssignments,
    },
  };
}

export const PERFORMANCE_QUERIES = [
  "node",
  "container",
  "source",
  "operator",
  "sink",
  "data",
  "control",
  "paxos",
  "client",
  "stream",
  "tick",
  "defer",
  "build",
  "core",
  "cluster",
];

export function getRandomQuery(): string {
  return PERFORMANCE_QUERIES[
    Math.floor(Math.random() * PERFORMANCE_QUERIES.length)
  ];
}
