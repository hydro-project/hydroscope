/**
 * @fileoverview Performance Configuration
 *
 * Performance-related constants including operation limits,
 * timeouts, and optimization thresholds.
 */

// ============================================================================
// OPERATION MANAGER CONSTANTS
// ============================================================================

export const OPERATION_MANAGER_CONSTANTS = {
  // Immediate follow-up limits to prevent livelock
  MAX_IMMEDIATE_FOLLOW_UPS: 5, // Maximum number of immediate follow-ups in a chain
  MAX_FOLLOW_UP_CHAIN_DURATION_MS: 10000, // Maximum duration (10 seconds) for a follow-up chain
} as const;

// ============================================================================
// ASYNC COORDINATOR CONSTANTS
// ============================================================================

export const ASYNC_COORDINATOR_CONSTANTS = {
  // Queue polling
  QUEUE_POLL_INTERVAL: 50, // Check every 50ms

  // Operation timeouts
  DEFAULT_OPERATION_TIMEOUT: 5000, // 5 seconds default timeout
  LAYOUT_OPERATION_TIMEOUT: 10000, // 10 seconds for layout operations

  // Batch processing
  MAX_BATCH_SIZE: 100, // Maximum operations to process in one batch
  BATCH_PROCESSING_DELAY: 10, // milliseconds between batches
} as const;

// ============================================================================
// MEMORY AND RESOURCE LIMITS
// ============================================================================

export const RESOURCE_LIMITS = {
  // File upload limits
  MAX_FILE_SIZE: 50 * 1024 * 1024, // 50MB default for file uploads

  // Graph size limits for performance warnings
  LARGE_GRAPH_NODE_THRESHOLD: 1000, // nodes
  LARGE_GRAPH_EDGE_THRESHOLD: 2000, // edges
  LARGE_GRAPH_CONTAINER_THRESHOLD: 100, // containers

  // Memory usage thresholds (approximate)
  MEMORY_WARNING_THRESHOLD: 100 * 1024 * 1024, // 100MB
  MEMORY_CRITICAL_THRESHOLD: 500 * 1024 * 1024, // 500MB
} as const;

// ============================================================================
// PERFORMANCE OPTIMIZATION CONSTANTS
// ============================================================================

export const PERFORMANCE_CONSTANTS = {
  // Rendering optimizations
  VIRTUALIZATION_THRESHOLD: 500, // Enable virtualization for graphs with more than this many nodes
  DEBOUNCE_LAYOUT_MS: 300, // Debounce layout recalculations
  DEBOUNCE_SEARCH_MS: 300, // Debounce search operations

  // Caching
  LAYOUT_CACHE_SIZE: 10, // Number of layout results to cache
  SEARCH_CACHE_SIZE: 50, // Number of search results to cache

  // Background processing
  IDLE_CALLBACK_TIMEOUT: 5000, // milliseconds - timeout for idle callbacks
  CHUNK_PROCESSING_SIZE: 50, // Process this many items per chunk
} as const;
