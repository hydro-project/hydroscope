/**
 * Shared test setup for Hydroscope component tests
 *
 * This file contains all the necessary mocks and setup required
 * for testing Hydroscope components in a test environment.
 */

import React from "react";
import { vi } from "vitest";
import "@testing-library/jest-dom";

// Mock ResizeObserver for ReactFlow
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Mock matchMedia for Ant Design components
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Core architecture mocks removed - let tests use real implementations or mock individually

// JSONParser mock removed - let tests use real implementation or mock individually

// Bridge mocks removed - let tests use real implementations or mock individually

// Handle unhandled promise rejections that occur during test teardown
process.on("unhandledRejection", (reason, _promise) => {
  const reasonStr = reason?.toString() || "";
  if (
    reasonStr.includes("window is not defined") ||
    reasonStr.includes("resolveUpdatePriority") ||
    reasonStr.includes("requestUpdateLane")
  ) {
    // Suppress React DOM errors that occur during test teardown
    return;
  }
  // Re-throw other unhandled rejections
  throw reason;
});

// Mock ReactFlow components
vi.mock("@xyflow/react", () => ({
  ReactFlow: ({ children, ...props }: any) =>
    React.createElement(
      "div",
      {
        "data-testid": "react-flow",
        ...props,
      },
      React.createElement("div", { "data-testid": "rf__wrapper" }, children),
    ),
  ReactFlowProvider: ({ children }: any) =>
    React.createElement("div", {}, children),
  Background: () => React.createElement("div", { "data-testid": "background" }),
  Controls: ({ children, ...props }: any) =>
    React.createElement(
      "div",
      { "data-testid": "controls", ...props },
      children,
    ),
  MiniMap: () => React.createElement("div", { "data-testid": "minimap" }),
  ControlButton: ({ children, ...props }: any) =>
    React.createElement(
      "button",
      { "data-testid": "control-button", ...props },
      children,
    ),
  Position: {
    Top: "top",
    Bottom: "bottom",
    Left: "left",
    Right: "right",
  },
  MarkerType: {
    Arrow: "arrow",
    ArrowClosed: "arrowclosed",
  },
  useReactFlow: () => ({
    fitView: vi.fn(),
    getNodes: vi.fn(() => []),
    getEdges: vi.fn(() => []),
    setNodes: vi.fn(),
    setEdges: vi.fn(),
  }),
  useUpdateNodeInternals: () => vi.fn(),
}));
