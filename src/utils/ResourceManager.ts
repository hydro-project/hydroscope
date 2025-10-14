/**
 * Resource Manager Utility
 *
 * Provides comprehensive resource management and cleanup for React components
 */
export type CleanupFunction = () => void;
export type ResourceType =
  | "timeout"
  | "interval"
  | "observer"
  | "listener"
  | "subscription"
  | "custom";
interface ManagedResource {
  id: string;
  type: ResourceType;
  resource: any;
  cleanup: CleanupFunction;
  createdAt: number;
}
/**
 * Resource Manager for tracking and cleaning up resources
 */
export class ResourceManager {
  private resources = new Map<string, ManagedResource>();
  private isDestroyed = false;
  /**
   * Add a timeout to be managed
   */
  addTimeout(callback: () => void, delay: number): NodeJS.Timeout {
    if (this.isDestroyed) {
      throw new Error("ResourceManager has been destroyed");
    }
    const timeoutId = setTimeout(callback, delay);
    const id = `timeout_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.resources.set(id, {
      id,
      type: "timeout",
      resource: timeoutId,
      cleanup: () => clearTimeout(timeoutId),
      createdAt: Date.now(),
    });
    return timeoutId;
  }
  /**
   * Add an interval to be managed
   */
  addInterval(callback: () => void, delay: number): NodeJS.Timeout {
    if (this.isDestroyed) {
      throw new Error("ResourceManager has been destroyed");
    }
    const intervalId = setInterval(callback, delay);
    const id = `interval_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.resources.set(id, {
      id,
      type: "interval",
      resource: intervalId,
      cleanup: () => clearInterval(intervalId),
      createdAt: Date.now(),
    });
    return intervalId;
  }
  /**
   * Add an observer to be managed
   */
  addObserver(
    observer: ResizeObserver | MutationObserver | IntersectionObserver,
  ): string {
    if (this.isDestroyed) {
      throw new Error("ResourceManager has been destroyed");
    }
    const id = `observer_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.resources.set(id, {
      id,
      type: "observer",
      resource: observer,
      cleanup: () => {
        try {
          observer.disconnect();
        } catch (error) {
          console.warn("Error disconnecting observer:", error);
        }
      },
      createdAt: Date.now(),
    });
    return id;
  }
  /**
   * Add an event listener to be managed
   */
  addEventListener(
    target: EventTarget,
    event: string,
    listener: EventListener,
    options?: boolean | AddEventListenerOptions,
  ): string {
    if (this.isDestroyed) {
      throw new Error("ResourceManager has been destroyed");
    }
    target.addEventListener(event, listener, options);
    const id = `listener_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.resources.set(id, {
      id,
      type: "listener",
      resource: { target, event, listener, options },
      cleanup: () => {
        try {
          target.removeEventListener(event, listener, options);
        } catch (error) {
          console.warn("Error removing event listener:", error);
        }
      },
      createdAt: Date.now(),
    });
    return id;
  }
  /**
   * Add a custom resource with cleanup function
   */
  addCustomResource(resource: any, cleanup: CleanupFunction): string {
    if (this.isDestroyed) {
      throw new Error("ResourceManager has been destroyed");
    }
    const id = `custom_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.resources.set(id, {
      id,
      type: "custom",
      resource,
      cleanup,
      createdAt: Date.now(),
    });
    return id;
  }
  /**
   * Remove a specific resource by ID
   */
  removeResource(id: string): boolean {
    const resource = this.resources.get(id);
    if (!resource) {
      return false;
    }
    try {
      resource.cleanup();
    } catch (error) {
      console.warn(`Error cleaning up resource ${id}:`, error);
    }
    this.resources.delete(id);
    return true;
  }
  /**
   * Remove all resources of a specific type
   */
  removeResourcesByType(type: ResourceType): number {
    let count = 0;
    const toRemove: string[] = [];
    for (const [id, resource] of this.resources) {
      if (resource.type === type) {
        toRemove.push(id);
      }
    }
    for (const id of toRemove) {
      if (this.removeResource(id)) {
        count++;
      }
    }
    return count;
  }
  /**
   * Get resource count by type
   */
  getResourceCount(type?: ResourceType): number {
    if (!type) {
      return this.resources.size;
    }
    let count = 0;
    for (const resource of this.resources.values()) {
      if (resource.type === type) {
        count++;
      }
    }
    return count;
  }
  /**
   * Get all resource IDs by type
   */
  getResourceIds(type?: ResourceType): string[] {
    const ids: string[] = [];
    for (const [id, resource] of this.resources) {
      if (!type || resource.type === type) {
        ids.push(id);
      }
    }
    return ids;
  }
  /**
   * Clean up resources older than specified age (in milliseconds)
   */
  cleanupOldResources(maxAge: number): number {
    const now = Date.now();
    const toRemove: string[] = [];
    for (const [id, resource] of this.resources) {
      if (now - resource.createdAt > maxAge) {
        toRemove.push(id);
      }
    }
    let count = 0;
    for (const id of toRemove) {
      if (this.removeResource(id)) {
        count++;
      }
    }
    return count;
  }
  /**
   * Clean up all resources and destroy the manager
   */
  destroy(): void {
    if (this.isDestroyed) {
      return;
    }
    const resourceCount = this.resources.size;
    // Clean up all resources
    for (const [id, resource] of this.resources) {
      try {
        resource.cleanup();
      } catch (error) {
        console.warn(`Error cleaning up resource ${id} during destroy:`, error);
      }
    }
    this.resources.clear();
    this.isDestroyed = true;
    if (resourceCount > 0) {
      hscopeLogger.log(
        "debug",
        `ResourceManager destroyed, cleaned up ${resourceCount} resources`,
      );
    }
  }
  /**
   * Get resource statistics
   */
  getStats(): Record<ResourceType, number> & {
    total: number;
  } {
    const stats: Record<ResourceType, number> & {
      total: number;
    } = {
      timeout: 0,
      interval: 0,
      observer: 0,
      listener: 0,
      subscription: 0,
      custom: 0,
      total: this.resources.size,
    };
    for (const resource of this.resources.values()) {
      stats[resource.type]++;
    }
    return stats;
  }
  /**
   * Check if the manager has been destroyed
   */
  get destroyed(): boolean {
    return this.isDestroyed;
  }
}
/**
 * React hook for using ResourceManager
 */
export function useResourceManager(): ResourceManager {
  const managerRef = React.useRef<ResourceManager | null>(null);
  // Create manager on first use
  if (!managerRef.current) {
    managerRef.current = new ResourceManager();
  }
  // Clean up on unmount
  React.useEffect(() => {
    const manager = managerRef.current;
    return () => {
      if (manager && !manager.destroyed) {
        manager.destroy();
      }
    };
  }, []);
  return managerRef.current;
}
/**
 * Utility function to create a safe timeout that won't execute after component unmount
 */
export function createSafeTimeout(
  callback: () => void,
  delay: number,
  mountedRef: React.MutableRefObject<boolean>,
): NodeJS.Timeout {
  return setTimeout(() => {
    if (mountedRef.current) {
      callback();
    }
  }, delay);
}
/**
 * Utility function to create a safe interval that won't execute after component unmount
 */
export function createSafeInterval(
  callback: () => void,
  delay: number,
  mountedRef: React.MutableRefObject<boolean>,
): NodeJS.Timeout {
  return setInterval(() => {
    if (mountedRef.current) {
      callback();
    }
  }, delay);
}
// Import React for the hook
import { hscopeLogger } from "./logger.js";
import React from "react";
export default ResourceManager;
