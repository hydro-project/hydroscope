import { describe, it, expect } from "vitest";
import {
  createTestVisualizationState,
  createTestAsyncCoordinator,
} from "../utils/testData.js";

/**
 * Regression: Post-layout window gating prevents remount loop after immediate dimension changes.
 *
 * This test asserts that immediately after a layout+render pipeline flush,
 * AsyncCoordinator.isInPostLayoutWindow() returns true for a brief period,
 * allowing consumers to classify subsequent dimension changes as "major"
 * even when there are no pending post-render callbacks.
 */
describe("Post-layout window gating", () => {
  it("is active immediately after a pipeline flush (treatAsMajor=true) and expires after window", async () => {
    const state = await createTestVisualizationState();
    const { asyncCoordinator } = await createTestAsyncCoordinator();

    // Run a simple pipeline without fitView to simulate the search/layout step
    await asyncCoordinator.executeLayoutAndRenderPipeline(state, {
      fitView: false,
    });

    // Immediately after flush, there should generally be no pending callbacks,
    // but the post-layout window should be active.
    const hasPending = asyncCoordinator.hasPendingCallbacks();
    const inWindowNow = asyncCoordinator.isInPostLayoutWindow(800);
    const treatAsMajorNow = hasPending || inWindowNow;

    expect(hasPending).toBe(false);
    expect(inWindowNow).toBe(true);
    expect(treatAsMajorNow).toBe(true);

    // After the window elapses, treatAsMajor should no longer be true
    // (unless something else scheduled callbacks, which this test does not).
    await new Promise((r) => setTimeout(r, 900));
    const inWindowLater = asyncCoordinator.isInPostLayoutWindow(800);
    const hasPendingLater = asyncCoordinator.hasPendingCallbacks();
    const treatAsMajorLater = hasPendingLater || inWindowLater;

    expect(inWindowLater).toBe(false);
    expect(treatAsMajorLater).toBe(false);
  });

  it("re-activates the post-layout window after a subsequent constrained layout flush", async () => {
    const state = await createTestVisualizationState();
    const { asyncCoordinator } = await createTestAsyncCoordinator();

    // Initial pipeline flush
    await asyncCoordinator.executeLayoutAndRenderPipeline(state, {
      fitView: false,
    });
    // Allow window to expire
    await new Promise((r) => setTimeout(r, 900));
    expect(asyncCoordinator.isInPostLayoutWindow(800)).toBe(false);

    // Simulate a constrained layout (like a label toggle) by relayouting a single entity
    await asyncCoordinator.executeLayoutAndRenderPipeline(state, {
      relayoutEntities: ["n1"],
      fitView: false,
    });

    // After the second flush, gating should be active again
    const hasPending = asyncCoordinator.hasPendingCallbacks();
    const inWindow = asyncCoordinator.isInPostLayoutWindow(800);
    expect(hasPending).toBe(false);
    expect(inWindow).toBe(true);
  });
});
