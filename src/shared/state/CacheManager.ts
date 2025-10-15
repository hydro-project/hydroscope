/**
 * CacheManager - Performance optimization caches
 * Manages various caches for visibility, hierarchy, and aggregation
 */
import type { GraphNode, Container, GraphEdge, AggregatedEdge } from "../../types/core.js";

export class CacheManager {
  // Visibility caches
  private _visibleNodesCache: GraphNode[] | null = null;
  private _visibleContainersCache: Container[] | null = null;
  private _visibleEdgesCache: (GraphEdge | AggregatedEdge)[] | null = null;
  
  // Hierarchy caches
  private _rootContainersCache: Container[] | null = null;
  private _descendantCache = new Map<string, Set<string>>();
  private _ancestorCache = new Map<string, string[]>();
  private _collapsedContainersCache: Container[] | null = null;
  private _hierarchyPathCache = new Map<string, string[]>();
  private _hierarchyPathCacheTimestamp = 0;
  
  // Visibility state cache
  private _visibilityCache = new Map<string, boolean>();
  private _visibilityCacheTimestamp = 0;
  
  // Aggregation cache
  private _aggregationCache = new Map<string, Map<string, any>>();
  private _aggregationCacheTimestamp = 0;
  
  // General cache management
  private _cacheVersion = 0;
  private _cacheInvalidationThreshold = 100; // Invalidate caches after 100ms

  // Visibility cache getters/setters
  getVisibleNodesCache(): GraphNode[] | null {
    return this._visibleNodesCache;
  }

  setVisibleNodesCache(nodes: GraphNode[] | null): void {
    this._visibleNodesCache = nodes;
  }

  getVisibleContainersCache(): Container[] | null {
    return this._visibleContainersCache;
  }

  setVisibleContainersCache(containers: Container[] | null): void {
    this._visibleContainersCache = containers;
  }

  getVisibleEdgesCache(): (GraphEdge | AggregatedEdge)[] | null {
    return this._visibleEdgesCache;
  }

  setVisibleEdgesCache(edges: (GraphEdge | AggregatedEdge)[] | null): void {
    this._visibleEdgesCache = edges;
  }

  // Hierarchy cache getters/setters
  getRootContainersCache(): Container[] | null {
    return this._rootContainersCache;
  }

  setRootContainersCache(containers: Container[] | null): void {
    this._rootContainersCache = containers;
  }

  getDescendantCache(containerId: string): Set<string> | undefined {
    return this._descendantCache.get(containerId);
  }

  setDescendantCache(containerId: string, descendants: Set<string>): void {
    this._descendantCache.set(containerId, descendants);
  }

  getAncestorCache(entityId: string): string[] | undefined {
    return this._ancestorCache.get(entityId);
  }

  setAncestorCache(entityId: string, ancestors: string[]): void {
    this._ancestorCache.set(entityId, ancestors);
  }

  getCollapsedContainersCache(): Container[] | null {
    return this._collapsedContainersCache;
  }

  setCollapsedContainersCache(containers: Container[] | null): void {
    this._collapsedContainersCache = containers;
  }

  getHierarchyPath(elementId: string): string[] | undefined {
    return this._hierarchyPathCache.get(elementId);
  }

  setHierarchyPath(elementId: string, path: string[]): void {
    this._hierarchyPathCache.set(elementId, path);
  }

  getHierarchyPathCacheTimestamp(): number {
    return this._hierarchyPathCacheTimestamp;
  }

  setHierarchyPathCacheTimestamp(timestamp: number): void {
    this._hierarchyPathCacheTimestamp = timestamp;
  }

  // Visibility state cache
  getVisibilityState(entityId: string): boolean | undefined {
    return this._visibilityCache.get(entityId);
  }

  setVisibilityState(entityId: string, visible: boolean): void {
    this._visibilityCache.set(entityId, visible);
  }

  getVisibilityCacheTimestamp(): number {
    return this._visibilityCacheTimestamp;
  }

  setVisibilityCacheTimestamp(timestamp: number): void {
    this._visibilityCacheTimestamp = timestamp;
  }

  // Aggregation cache
  getAggregationCache(): Map<string, Map<string, any>> {
    return this._aggregationCache;
  }

  getAggregationCacheTimestamp(): number {
    return this._aggregationCacheTimestamp;
  }

  setAggregationCacheTimestamp(timestamp: number): void {
    this._aggregationCacheTimestamp = timestamp;
  }

  // Cache version management
  getCacheVersion(): number {
    return this._cacheVersion;
  }

  incrementCacheVersion(): void {
    this._cacheVersion++;
  }

  getCacheInvalidationThreshold(): number {
    return this._cacheInvalidationThreshold;
  }

  // Cache invalidation
  invalidateVisibilityCache(): void {
    this._visibleNodesCache = null;
    this._visibleContainersCache = null;
    this._visibleEdgesCache = null;
    this._visibilityCache.clear();
    this._visibilityCacheTimestamp = Date.now();
  }

  invalidateHierarchyCache(): void {
    this._rootContainersCache = null;
    this._descendantCache.clear();
    this._ancestorCache.clear();
    this._collapsedContainersCache = null;
    this._hierarchyPathCache.clear();
    this._hierarchyPathCacheTimestamp = Date.now();
  }

  invalidateAggregationCache(): void {
    this._aggregationCache.clear();
    this._aggregationCacheTimestamp = Date.now();
  }

  invalidateAllCaches(): void {
    this.invalidateVisibilityCache();
    this.invalidateHierarchyCache();
    this.invalidateAggregationCache();
    this.incrementCacheVersion();
  }

  clear(): void {
    this.invalidateAllCaches();
    this._cacheVersion = 0;
  }
}
