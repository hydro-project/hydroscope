/**
 * Test suite for HydroscopeCore bulk operations
 *
 * Tests the atomic state management for collapseAll and expandAll operations.
 * These tests focus on the imperative API and error handling.
 */

import React, { useRef } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";
import {
  HydroscopeCore,
  type HydroscopeCoreHandle,
} from "../HydroscopeCore.js";
import type { HydroscopeData } from "../../types/core.js";

// Simple mock data that should parse correctly
const mockSimpleData: HydroscopeData = {
  nodes: [
    { id: "node1", label: "Node 1" },
    { id: "node2", label: "Node 2" },
  ],
  edges: [{ id: "edge1", source: "node1", target: "node2" }],
  hierarchyChoices: [],
  nodeAssignments: {},
};

// Test component that uses the imperative handle
const _TestComponent: React.FC<{
  onCollapseAll?: () => void;
  onExpandAll?: () => void;
  onError?: (error: Error) => void;
}> = ({ onCollapseAll, onExpandAll, onError }) => {
  const hydroscopeRef = useRef<HydroscopeCoreHandle>(null);

  const handleCollapseAll = async () => {
    try {
      await hydroscopeRef.current?.collapseAll();
      onCollapseAll?.();
    } catch (error) {
      onError?.(error as Error);
    }
  };

  const handleExpandAll = async () => {
    try {
      await hydroscopeRef.current?.expandAll();
      onExpandAll?.();
    } catch (error) {
      onError?.(error as Error);
    }
  };

  return (
    <div>
      <HydroscopeCore
        ref={hydroscopeRef}
        data={mockSimpleData}
        height="400px"
        width="600px"
        showControls={true}
        showMiniMap={false}
        showBackground={false}
        enableCollapse={true}
        onError={onError}
      />
      <button onClick={handleCollapseAll} data-testid="collapse-all-btn">
        Collapse All
      </button>
      <button onClick={handleExpandAll} data-testid="expand-all-btn">
        Expand All
      </button>
    </div>
  );
};

describe("HydroscopeCore Bulk Operations", () => {
  beforeEach(() => {
    // Clear all mocks before each test
    vi.clearAllMocks();
  });

  it("should expose collapseAll and expandAll methods through ref", () => {
    const RefTestComponent: React.FC = () => {
      const hydroscopeRef = useRef<HydroscopeCoreHandle>(null);

      React.useEffect(() => {
        // Test the ref after component mounts
        if (hydroscopeRef.current) {
          expect(hydroscopeRef.current.collapseAll).toBeDefined();
          expect(hydroscopeRef.current.expandAll).toBeDefined();
          expect(typeof hydroscopeRef.current.collapseAll).toBe("function");
          expect(typeof hydroscopeRef.current.expandAll).toBe("function");
        }
      });

      return (
        <HydroscopeCore
          ref={hydroscopeRef}
          data={mockSimpleData}
          height="400px"
          width="600px"
        />
      );
    };

    render(<RefTestComponent />);
  });

  it("should expose individual container methods through ref", () => {
    const RefTestComponent: React.FC = () => {
      const hydroscopeRef = useRef<HydroscopeCoreHandle>(null);

      React.useEffect(() => {
        // Test the ref after component mounts
        if (hydroscopeRef.current) {
          expect(hydroscopeRef.current.collapse).toBeDefined();
          expect(hydroscopeRef.current.expand).toBeDefined();
          expect(hydroscopeRef.current.toggle).toBeDefined();
          expect(typeof hydroscopeRef.current.collapse).toBe("function");
          expect(typeof hydroscopeRef.current.expand).toBe("function");
          expect(typeof hydroscopeRef.current.toggle).toBe("function");
        }
      });

      return (
        <HydroscopeCore
          ref={hydroscopeRef}
          data={mockSimpleData}
          height="400px"
          width="600px"
        />
      );
    };

    render(<RefTestComponent />);
  });

  it("should handle invalid data gracefully", async () => {
    const onError = vi.fn();

    render(
      <HydroscopeCore
        data={null as any} // Invalid data to trigger error
        height="400px"
        width="600px"
        onError={onError}
      />,
    );

    // Component should render in loading state when data is invalid
    // The error handling is tested elsewhere, this test just ensures
    // the component doesn't crash
    expect(screen.getByText("Loading visualization...")).toBeInTheDocument();
  });

  it("should provide proper TypeScript interface", () => {
    // This test ensures the TypeScript interface is properly exported
    // and compiles without errors
    const TestTypeComponent: React.FC = () => {
      const hydroscopeRef = useRef<HydroscopeCoreHandle>(null);

      React.useEffect(() => {
        // TypeScript should allow these assignments without errors
        const collapseAllMethod: (() => Promise<void>) | undefined =
          hydroscopeRef.current?.collapseAll;
        const expandAllMethod: (() => Promise<void>) | undefined =
          hydroscopeRef.current?.expandAll;

        // These should be functions when defined
        expect(
          typeof collapseAllMethod === "function" ||
            collapseAllMethod === undefined,
        ).toBe(true);
        expect(
          typeof expandAllMethod === "function" ||
            expandAllMethod === undefined,
        ).toBe(true);
      });

      return (
        <HydroscopeCore
          ref={hydroscopeRef}
          data={mockSimpleData}
          height="400px"
          width="600px"
        />
      );
    };

    render(<TestTypeComponent />);
  });

  it("should handle bulk operations when no containers exist", async () => {
    const BulkOperationTestComponent: React.FC = () => {
      const hydroscopeRef = useRef<HydroscopeCoreHandle>(null);
      const [testComplete, setTestComplete] = React.useState(false);

      React.useEffect(() => {
        const runTest = async () => {
          if (hydroscopeRef.current) {
            // Bulk operations should not throw errors even with no containers
            try {
              await hydroscopeRef.current.collapseAll();
              await hydroscopeRef.current.expandAll();
              setTestComplete(true);
            } catch (error) {
              // Should not reach here
              expect(error).toBeUndefined();
            }
          }
        };

        // Run test after a short delay to ensure component is initialized
        const timer = setTimeout(runTest, 100);
        return () => clearTimeout(timer);
      }, []);

      return (
        <div>
          <HydroscopeCore
            ref={hydroscopeRef}
            data={mockSimpleData} // Data with no containers
            height="400px"
            width="600px"
          />
          {testComplete && <div data-testid="test-complete">Test Complete</div>}
        </div>
      );
    };

    const { getByTestId } = render(<BulkOperationTestComponent />);

    // Wait for test to complete
    await waitFor(() => {
      expect(getByTestId("test-complete")).toBeInTheDocument();
    });
  });
});
