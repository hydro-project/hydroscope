/**
 * @fileoverview Bridge Reset Utilities
 *
 * Provides utility functions for completely resetting bridge instances and their
 * underlying components (ELK and ReactFlow). This ensures clean state when toggling
 * features like "Show full node labels" that require edge handle recalculation.
 *
 * Each reset function performs a complete reallocation:
 * 1. Deallocate old instance
 * 2. Create new instance
 * 3. Force component remount (if applicable)
 * 4. Update all references
 */

import { hscopeLogger } from "./logger.js";
import { ELKBridge } from "../bridges/ELKBridge.js";
import { ReactFlowBridge } from "../bridges/ReactFlowBridge.js";
import type { AsyncCoordinator } from "../core/AsyncCoordinator.js";
import type { VisualizationState } from "../core/VisualizationState.js";

export interface ELKResetOptions {
  /** Current layout algorithm to use for new ELK bridge */
  algorithm: string;
  /** AsyncCoordinator instance to update with new bridge */
  asyncCoordinator: AsyncCoordinator;
  /** Current ELK bridge ref to update */
  elkBridgeRef: { current: ELKBridge | null };
}

export interface ReactFlowResetOptions {
  /** AsyncCoordinator instance to update with new bridge */
  asyncCoordinator: AsyncCoordinator;
  /** Current ReactFlow bridge ref to update */
  reactFlowBridgeRef: { current: ReactFlowBridge | null };
  /** HydroscopeCore ref with forceReactFlowRemount method */
  hydroscopeCoreRef: {
    current: {
      forceReactFlowRemount?: () => void;
    } | null;
  };
}

export interface FullBridgeResetOptions {
  /** Current layout algorithm to use for new ELK bridge */
  algorithm: string;
  /** AsyncCoordinator instance to update with new bridges */
  asyncCoordinator: AsyncCoordinator;
  /** Current ELK bridge ref to update */
  elkBridgeRef: { current: ELKBridge | null };
  /** Current ReactFlow bridge ref to update */
  reactFlowBridgeRef: { current: ReactFlowBridge | null };
  /** HydroscopeCore ref with forceReactFlowRemount method */
  hydroscopeCoreRef: {
    current: {
      forceReactFlowRemount?: () => void;
      getAsyncCoordinator?: () => AsyncCoordinator | null;
      getVisualizationState?: () => VisualizationState | null;
    } | null;
  };
}

export interface FullBridgeResetResult {
  asyncCoordinator: AsyncCoordinator;
  visualizationState: VisualizationState | null;
  elkBridge: ELKBridge;
  reactFlowBridge: ReactFlowBridge;
}

/**
 * Reset ELK bridge and its underlying ELK instance
 *
 * This performs a complete reallocation:
 * 1. Deallocates old ELK bridge (which deallocates the ELK instance inside it)
 * 2. Creates new ELK bridge (which creates a fresh ELK instance)
 * 3. Updates AsyncCoordinator with new bridge
 *
 * @param options - Configuration for ELK reset
 * @returns New ELK bridge instance
 */
export function resetELKBridge(options: ELKResetOptions): ELKBridge {
  const { algorithm, elkBridgeRef } = options;

  hscopeLogger.log(
    "op",
    "🔄 [BridgeReset] Resetting ELK bridge and ELK instance",
  );

  // Step 1: Deallocate old ELK bridge
  if (elkBridgeRef.current) {
    hscopeLogger.log("op", "  ✓ Deallocating old ELK bridge");
    elkBridgeRef.current = null;
  }

  // Step 2: Create new ELK bridge (this creates a fresh ELK instance internally)
  hscopeLogger.log(
    "op",
    "  ✓ Creating new ELK bridge with algorithm:",
    algorithm,
  );
  const newELKBridge = new ELKBridge({ algorithm });
  elkBridgeRef.current = newELKBridge;

  // Note: Caller must update AsyncCoordinator with both bridges via setBridgeInstances

  hscopeLogger.log("op", "✅ [BridgeReset] ELK bridge reset complete");
  return newELKBridge;
}

/**
 * Reset ReactFlow bridge (without forcing remount yet)
 *
 * This performs bridge reallocation:
 * 1. Deallocates old ReactFlow bridge
 * 2. Creates new ReactFlow bridge
 *
 * Note: Does NOT force ReactFlow remount - caller should do that AFTER
 * the layout pipeline completes to ensure ReactFlow remounts with fresh data.
 *
 * @param options - Configuration for ReactFlow reset
 * @returns New ReactFlow bridge instance
 */
export function resetReactFlowBridge(
  options: ReactFlowResetOptions,
): ReactFlowBridge {
  const { reactFlowBridgeRef } = options;

  hscopeLogger.log("op", "🔄 [BridgeReset] Resetting ReactFlow bridge");

  // Step 1: Deallocate old ReactFlow bridge
  if (reactFlowBridgeRef.current) {
    hscopeLogger.log("op", "  ✓ Deallocating old ReactFlow bridge");
    reactFlowBridgeRef.current = null;
  }

  // Step 2: Create new ReactFlow bridge
  hscopeLogger.log("op", "  ✓ Creating new ReactFlow bridge");
  const newReactFlowBridge = new ReactFlowBridge({});
  reactFlowBridgeRef.current = newReactFlowBridge;

  // Note: Caller must update AsyncCoordinator with both bridges via setBridgeInstances
  // Note: Caller should force ReactFlow remount AFTER layout pipeline completes

  hscopeLogger.log("op", "✅ [BridgeReset] ReactFlow bridge reset complete");
  return newReactFlowBridge;
}

/**
 * Reset both ELK and ReactFlow bridges (without forcing ReactFlow remount yet)
 *
 * This performs bridge reallocation:
 * 1. ELK bridge → creates new ELK instance
 * 2. ReactFlow bridge
 * 3. Updates AsyncCoordinator with new bridges
 *
 * Note: Does NOT force ReactFlow remount - caller should do that AFTER
 * the layout pipeline completes to ensure ReactFlow remounts with fresh data.
 *
 * Use this when you need a complete clean slate, such as when toggling
 * "Show full node labels" which changes node dimensions and requires
 * edge handle recalculation.
 *
 * @param options - Configuration for full reset
 * @returns Object containing all new instances and a function to force remount
 */
export function resetAllBridges(
  options: FullBridgeResetOptions,
): (FullBridgeResetResult & { forceRemount: () => void }) | null {
  hscopeLogger.log(
    "op",
    "🔄 [BridgeReset] Starting FULL bridge reset (ELK + ReactFlow bridges)",
  );

  const {
    algorithm,
    asyncCoordinator,
    elkBridgeRef,
    reactFlowBridgeRef,
    hydroscopeCoreRef,
  } = options;

  // Reset ELK bridge (and ELK instance)
  const newELKBridge = resetELKBridge({
    algorithm,
    asyncCoordinator,
    elkBridgeRef,
  });

  // Reset ReactFlow bridge (without forcing remount yet)
  const newReactFlowBridge = resetReactFlowBridge({
    asyncCoordinator,
    reactFlowBridgeRef,
    hydroscopeCoreRef,
  });

  // Update AsyncCoordinator with both new bridge instances
  hscopeLogger.log(
    "op",
    "  ✓ Updating AsyncCoordinator with new bridge instances",
  );
  asyncCoordinator.setBridgeInstances(newReactFlowBridge, newELKBridge);

  // Get current visualization state
  const visualizationState =
    hydroscopeCoreRef.current?.getVisualizationState?.() || null;

  // Create function to force ReactFlow remount (to be called AFTER pipeline completes)
  const forceRemount = () => {
    hscopeLogger.log(
      "op",
      "🔄 [BridgeReset] Forcing ReactFlow component remount",
    );
    if (hydroscopeCoreRef.current?.forceReactFlowRemount) {
      hydroscopeCoreRef.current.forceReactFlowRemount();
    } else {
      console.warn(
        "  ⚠️ forceReactFlowRemount not available - ReactFlow may have stale state",
      );
    }
  };

  hscopeLogger.log(
    "op",
    "✅ [BridgeReset] Bridge reset complete (remount pending)",
  );
  hscopeLogger.log("op", "  ✓ New ELK bridge created");
  hscopeLogger.log("op", "  ✓ New ELK instance created");
  hscopeLogger.log("op", "  ✓ New ReactFlow bridge created");
  hscopeLogger.log(
    "op",
    "  ⏳ ReactFlow remount will happen after pipeline completes",
  );

  return {
    asyncCoordinator,
    visualizationState,
    elkBridge: newELKBridge,
    reactFlowBridge: newReactFlowBridge,
    forceRemount,
  };
}
