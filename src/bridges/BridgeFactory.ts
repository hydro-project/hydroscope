/**
 * BridgeFactory - Singleton factory for stateless bridge instances
 * Ensures consistent bridge instances across the application
 */
import { ReactFlowBridge } from "./ReactFlowBridge.js";
import { ELKBridge } from "./ELKBridge.js";
import type { LayoutConfig, StyleConfig } from "../types/core.js";
import type {
  IBridgeFactory,
  IReactFlowBridge,
  IELKBridge,
} from "../types/bridges.js";
export class BridgeFactory implements IBridgeFactory {
  private static instance: BridgeFactory;
  private reactFlowBridge: ReactFlowBridge | null = null;
  private elkBridge: ELKBridge | null = null;
  private constructor() {
    // Private constructor for singleton pattern
  }
  /**
   * Get singleton instance of BridgeFactory
   */
  static getInstance(): BridgeFactory {
    if (!BridgeFactory.instance) {
      BridgeFactory.instance = new BridgeFactory();
    }
    return BridgeFactory.instance;
  }
  /**
   * Get singleton ReactFlowBridge instance with default configuration
   */
  getReactFlowBridge(styleConfig: StyleConfig = {}): IReactFlowBridge {
    if (!this.reactFlowBridge) {
      this.reactFlowBridge = new ReactFlowBridge(styleConfig);
    }
    return this.reactFlowBridge;
  }
  /**
   * Get singleton ELKBridge instance with default configuration
   */
  getELKBridge(layoutConfig: LayoutConfig = {}): IELKBridge {
    if (!this.elkBridge) {
      this.elkBridge = new ELKBridge(layoutConfig);
    }
    return this.elkBridge;
  }
  /**
   * Reset bridge instances (useful for testing)
   */
  reset(): void {
    this.reactFlowBridge = null;
    this.elkBridge = null;
  }
  /**
   * Update ReactFlowBridge configuration
   * Note: Since bridges are stateless, this creates a new instance
   */
  updateReactFlowBridgeConfig(styleConfig: StyleConfig): void {
    this.reactFlowBridge = new ReactFlowBridge(styleConfig);
  }
  /**
   * Update ELKBridge configuration
   * Note: Since bridges are stateless, this creates a new instance
   */
  updateELKBridgeConfig(layoutConfig: LayoutConfig): void {
    this.elkBridge = new ELKBridge(layoutConfig);
  }
}
// Export singleton instance for convenience
export const bridgeFactory = BridgeFactory.getInstance();
