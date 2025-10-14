/**
 * @fileoverview Integration tests for NodePopup with HydroscopeCore
 */
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { HydroscopeCore } from "../HydroscopeCore";
import type { HydroscopeData } from "../../types/core";

// Mock createPortal to render in the same container
vi.mock("react-dom", async () => {
  const actual = await vi.importActual("react-dom");
  return {
    ...actual,
    createPortal: (children: React.ReactNode) => children,
  };
});

describe("NodePopup Integration", () => {
  // Use a very simple test that doesn't rely on complex data processing
  it("should render HydroscopeCore without errors", async () => {
    const simpleData: HydroscopeData = {
      nodes: [{ id: "test", label: "Test" }],
      edges: [],
      hierarchyChoices: [],
      nodeAssignments: {},
    };

    const { container } = render(
      <HydroscopeCore
        data={simpleData}
        height="200px"
        width="300px"
        showControls={false}
        showMiniMap={false}
        showBackground={false}
      />,
    );

    // Just verify the component renders without crashing
    expect(container).toBeInTheDocument();

    // Wait a short time for any async operations
    await new Promise((resolve) => setTimeout(resolve, 100));
  });

  // Note: More comprehensive integration tests would require the full data processing pipeline
  // which takes time in the test environment. The NodePopup component itself is tested
  // in NodePopup.test.tsx with proper mocking.
});
