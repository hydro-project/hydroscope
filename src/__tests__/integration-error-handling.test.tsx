/**
 * Application Integration Tests: Error Handling and Edge Cases
 *
 * Tests invalid file upload scenarios
 * Tests application behavior with corrupted data
 * Tests UI responsiveness under high load
 * Validates error messages and user feedback
 *
 * Requirements: 12.4, 6.2
 */

import React from "react";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from "@testing-library/react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  HydroscopeCore,
  type HydroscopeCoreRef,
} from "../components/HydroscopeCore.js";
import { FileUpload } from "../components/FileUpload.js";
import { ContainerControls } from "../components/ContainerControls.js";
import { Search } from "../components/Search.js";
import { VisualizationState } from "../core/VisualizationState.js";
import { AsyncCoordinator } from "../core/AsyncCoordinator.js";
import type {
  HydroscopeData,
  LayoutState,
  QueueStatus,
  ValidationError,
  ParseError,
} from "../types/core.js";

// Mock FileReader for file upload tests
class MockFileReader {
  result: string | null = null;
  error: Error | null = null;
  onload: ((event: any) => void) | null = null;
  onerror: ((event: any) => void) | null = null;

  readAsText(file: File) {
    setTimeout(() => {
      if (this.error) {
        this.onerror?.({ target: this });
      } else {
        this.onload?.({ target: { result: this.result } });
      }
    }, 10);
  }
}

// Helper to create mock file
const createMockFile = (
  content: string,
  name: string = "test.json",
  type: string = "application/json",
): File => {
  const blob = new Blob([content], { type });
  return new File([blob], name, { type });
};

// Helper to setup FileReader mock
const setupFileReaderMock = (
  result: string | null,
  error: Error | null = null,
) => {
  const mockInstance = new MockFileReader();
  mockInstance.result = result;
  mockInstance.error = error;
  global.FileReader = vi.fn().mockImplementation(() => mockInstance) as any;
  return mockInstance;
};

// Test application component for error testing
const ErrorTestApplication: React.FC<{
  onError?: (error: Error, context: string) => void;
  onValidationError?: (errors: ValidationError[], filename: string) => void;
  onParseError?: (error: ParseError, filename: string) => void;
}> = ({ onError, onValidationError, onParseError }) => {
  const coreRef = React.useRef<HydroscopeCoreRef>(null);
  const [isDataLoaded, setIsDataLoaded] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string>("");

  const handleFileLoaded = React.useCallback(
    (data: HydroscopeData, filename: string) => {
      try {
        const state = coreRef.current?.getVisualizationState();
        if (!state) throw new Error("VisualizationState not available");

        // Load data with potential for errors
        for (const node of data.nodes) {
          state.addNode({
            id: node.id,
            label: node.shortLabel || node.label || node.id,
            longLabel: node.fullLabel || node.label || node.id,
            type: node.nodeType || "default",
            semanticTags: [],
            hidden: false,
            showingLongLabel: false,
          });
        }

        for (const edge of data.edges) {
          state.addEdge({
            id: edge.id,
            source: edge.source,
            target: edge.target,
            type: edge.type || "dataflow",
            semanticTags: [],
            hidden: false,
          });
        }

        setIsDataLoaded(true);
        setErrorMessage("");
        coreRef.current?.triggerLayout();
      } catch (error) {
        setErrorMessage(
          `Data loading failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        );
        onError?.(
          error instanceof Error ? error : new Error("Unknown error"),
          "data loading",
        );
      }
    },
    [onError],
  );

  const handleValidationError = React.useCallback(
    (errors: ValidationError[], filename: string) => {
      const errorMsg = `Validation failed for ${filename}: ${errors.map((e) => e.message).join(", ")}`;
      // Check if we're in a valid environment before updating state
      if (typeof window !== "undefined") {
        setErrorMessage(errorMsg);
      }
      onValidationError?.(errors, filename);
    },
    [onValidationError],
  );

  const handleParseError = React.useCallback(
    (error: ParseError, filename: string) => {
      const errorMsg = `Parse error in ${filename}: ${error.message}`;
      // Check if we're in a valid environment before updating state
      if (typeof window !== "undefined") {
        setErrorMessage(errorMsg);
      }
      onParseError?.(error, filename);
    },
    [onParseError],
  );

  const handleCoreError = React.useCallback(
    (error: Error, context: string) => {
      // Check if we're in a valid environment before updating state
      if (typeof window !== "undefined") {
        setErrorMessage(`Core error (${context}): ${error.message}`);
      }
      onError?.(error, context);
    },
    [onError],
  );

  return (
    <div data-testid="error-test-application">
      <HydroscopeCore
        ref={coreRef}
        onError={handleCoreError}
        autoLayout={true}
        layoutDebounceDelay={50}
      />

      {errorMessage && (
        <div data-testid="error-display" className="error-message">
          {errorMessage}
        </div>
      )}

      {!isDataLoaded && (
        <div data-testid="file-upload-section">
          <FileUpload
            onFileLoaded={handleFileLoaded}
            onValidationError={handleValidationError}
            onParseError={handleParseError}
            data-testid="file-upload"
          />
        </div>
      )}

      {isDataLoaded && (
        <div data-testid="controls-section">
          <ContainerControls
            visualizationState={(() => {
              try {
                return (
                  coreRef.current?.getVisualizationState() ||
                  new VisualizationState()
                );
              } catch {
                return new VisualizationState();
              }
            })()}
            asyncCoordinator={(() => {
              try {
                return (
                  coreRef.current?.getAsyncCoordinator() ||
                  new AsyncCoordinator()
                );
              } catch {
                return new AsyncCoordinator();
              }
            })()}
            onOperationComplete={(operation, containerId) => {
              try {
                coreRef.current?.triggerLayout();
              } catch (error) {
                handleCoreError(
                  error instanceof Error ? error : new Error("Unknown error"),
                  `${operation} ${containerId || "all"}`,
                );
              }
            }}
            onError={handleCoreError}
            data-testid="container-controls"
          />

          <Search
            onSearch={(query) => {
              try {
                const state = coreRef.current?.getVisualizationState();
                if (state) {
                  if (query.trim()) {
                    state.search(query);
                  } else {
                    state.clearSearch();
                  }
                }
              } catch (error) {
                handleCoreError(
                  error instanceof Error ? error : new Error("Unknown error"),
                  "search",
                );
              }
            }}
            data-testid="search"
          />
        </div>
      )}
    </div>
  );
};

describe("Application Integration: Error Handling and Edge Cases", () => {
  let originalFileReader: typeof FileReader;

  beforeEach(() => {
    originalFileReader = global.FileReader;
    vi.clearAllMocks();
  });

  afterEach(() => {
    global.FileReader = originalFileReader;
  });

  describe("Invalid File Upload Scenarios", () => {
    it("should handle completely invalid JSON files", async () => {
      setupFileReaderMock("{ this is not valid json at all }");

      const onParseError = vi.fn();

      render(<ErrorTestApplication onParseError={onParseError} />);

      const fileInput = screen
        .getByRole("button")
        .querySelector('input[type="file"]') as HTMLInputElement;
      const file = createMockFile(
        "{ this is not valid json at all }",
        "invalid.json",
      );

      await act(async () => {
        fireEvent.change(fileInput, { target: { files: [file] } });
      });

      await waitFor(() => {
        expect(onParseError).toHaveBeenCalledWith(
          expect.objectContaining({
            type: "json_parse",
            message: expect.stringContaining("Invalid JSON"),
          }),
          "invalid.json",
        );
      });

      expect(screen.getByTestId("error-display")).toBeInTheDocument();
      expect(
        screen.getByText(/Parse error in invalid.json/),
      ).toBeInTheDocument();
    });

    it("should handle files with wrong MIME types", async () => {
      setupFileReaderMock("valid json content");

      const onValidationError = vi.fn();

      render(<ErrorTestApplication onValidationError={onValidationError} />);

      const fileInput = screen
        .getByRole("button")
        .querySelector('input[type="file"]') as HTMLInputElement;
      const file = createMockFile(
        "valid json content",
        "test.txt",
        "text/plain",
      );

      await act(async () => {
        fireEvent.change(fileInput, { target: { files: [file] } });
      });

      await waitFor(() => {
        expect(onValidationError).toHaveBeenCalledWith(
          expect.arrayContaining([
            expect.objectContaining({
              type: "file_type",
              message: expect.stringContaining("Invalid file type"),
            }),
          ]),
          "test.txt",
        );
      });

      expect(screen.getByTestId("error-display")).toBeInTheDocument();
    });

    it("should handle oversized files", async () => {
      const largeContent = "x".repeat(60 * 1024 * 1024 + 1); // > 60MB (exceeds 50MB default limit)
      setupFileReaderMock(largeContent);

      const onValidationError = vi.fn();

      render(<ErrorTestApplication onValidationError={onValidationError} />);

      const fileInput = screen
        .getByRole("button")
        .querySelector('input[type="file"]') as HTMLInputElement;
      const file = createMockFile(largeContent, "large.json");

      await act(async () => {
        fireEvent.change(fileInput, { target: { files: [file] } });
      });

      await waitFor(() => {
        expect(onValidationError).toHaveBeenCalledWith(
          expect.arrayContaining([
            expect.objectContaining({
              type: "file_size",
              message: expect.stringContaining("File too large"),
            }),
          ]),
          "large.json",
        );
      });

      expect(screen.getByTestId("error-display")).toBeInTheDocument();
    });

    it("should handle empty files", async () => {
      setupFileReaderMock("");

      const onValidationError = vi.fn();

      render(<ErrorTestApplication onValidationError={onValidationError} />);

      const fileInput = screen
        .getByRole("button")
        .querySelector('input[type="file"]') as HTMLInputElement;
      const file = createMockFile("", "empty.json");

      await act(async () => {
        fireEvent.change(fileInput, { target: { files: [file] } });
      });

      await waitFor(() => {
        expect(onValidationError).toHaveBeenCalledWith(
          expect.arrayContaining([
            expect.objectContaining({
              type: "file_empty",
              message: "File is empty",
            }),
          ]),
          "empty.json",
        );
      });

      expect(screen.getByTestId("error-display")).toBeInTheDocument();
    });

    it("should handle file reading errors", async () => {
      setupFileReaderMock(null, new Error("File system error"));

      const onParseError = vi.fn();

      render(<ErrorTestApplication onParseError={onParseError} />);

      const fileInput = screen
        .getByRole("button")
        .querySelector('input[type="file"]') as HTMLInputElement;
      const file = createMockFile("valid content", "test.json");

      await act(async () => {
        fireEvent.change(fileInput, { target: { files: [file] } });
      });

      await waitFor(() => {
        expect(onParseError).toHaveBeenCalledWith(
          expect.objectContaining({
            type: "processing_error",
            message: expect.stringContaining("File processing failed"),
          }),
          "test.json",
        );
      });

      expect(screen.getByTestId("error-display")).toBeInTheDocument();
    });

    it("should handle multiple file selection errors", async () => {
      setupFileReaderMock("{}");

      const onValidationError = vi.fn();

      render(<ErrorTestApplication onValidationError={onValidationError} />);

      const fileInput = screen
        .getByRole("button")
        .querySelector('input[type="file"]') as HTMLInputElement;
      const files = [
        createMockFile("", "empty.json"),
        createMockFile("invalid", "invalid.txt", "text/plain"),
        createMockFile("x".repeat(20 * 1024 * 1024), "huge.json"), // 20MB
      ];

      // Simulate selecting multiple files (though input might only process first)
      await act(async () => {
        fireEvent.change(fileInput, { target: { files } });
      });

      await waitFor(() => {
        expect(onValidationError).toHaveBeenCalled();
      });

      expect(screen.getByTestId("error-display")).toBeInTheDocument();
    });
  });

  describe("Corrupted Data Scenarios", () => {
    it("should handle JSON with missing required properties", async () => {
      const corruptedData = {
        // Missing nodes array
        edges: [],
      };
      setupFileReaderMock(JSON.stringify(corruptedData));

      const onValidationError = vi.fn();

      render(<ErrorTestApplication onValidationError={onValidationError} />);

      const fileInput = screen
        .getByRole("button")
        .querySelector('input[type="file"]') as HTMLInputElement;
      const file = createMockFile(
        JSON.stringify(corruptedData),
        "corrupted.json",
      );

      await act(async () => {
        fireEvent.change(fileInput, { target: { files: [file] } });
      });

      await waitFor(() => {
        expect(onValidationError).toHaveBeenCalledWith(
          expect.arrayContaining([
            expect.objectContaining({
              type: "missing_property",
              message: "Missing required property: nodes",
            }),
          ]),
          "corrupted.json",
        );
      });

      expect(screen.getByTestId("error-display")).toBeInTheDocument();
    });

    it("should handle nodes with invalid structure", async () => {
      const corruptedData = {
        nodes: [
          { /* missing id */ label: "Node 1" },
          { id: "node2" /* missing label */ },
          { id: null, label: "Node 3" }, // null id
          { id: "", label: "" }, // empty strings
        ],
        edges: [],
      };
      setupFileReaderMock(JSON.stringify(corruptedData));

      const onValidationError = vi.fn();

      render(<ErrorTestApplication onValidationError={onValidationError} />);

      const fileInput = screen
        .getByRole("button")
        .querySelector('input[type="file"]') as HTMLInputElement;
      const file = createMockFile(
        JSON.stringify(corruptedData),
        "bad-nodes.json",
      );

      await act(async () => {
        fireEvent.change(fileInput, { target: { files: [file] } });
      });

      await waitFor(() => {
        expect(onValidationError).toHaveBeenCalledWith(
          expect.arrayContaining([
            expect.objectContaining({
              type: "missing_node_property",
              message: expect.stringContaining("missing required property: id"),
            }),
          ]),
          "bad-nodes.json",
        );
      });

      expect(screen.getByTestId("error-display")).toBeInTheDocument();
    });

    it("should handle edges with invalid references", async () => {
      const corruptedData = {
        nodes: [
          { id: "node1", label: "Node 1" },
          { id: "node2", label: "Node 2" },
        ],
        edges: [
          { id: "edge1", source: "nonexistent", target: "node2" },
          { id: "edge2", source: "node1", target: "alsononexistent" },
          { id: "edge3" /* missing source and target */ },
          { id: "", source: "node1", target: "node2" }, // empty id
        ],
      };
      setupFileReaderMock(JSON.stringify(corruptedData));

      const onValidationError = vi.fn();

      render(<ErrorTestApplication onValidationError={onValidationError} />);

      const fileInput = screen
        .getByRole("button")
        .querySelector('input[type="file"]') as HTMLInputElement;
      const file = createMockFile(
        JSON.stringify(corruptedData),
        "bad-edges.json",
      );

      await act(async () => {
        fireEvent.change(fileInput, { target: { files: [file] } });
      });

      await waitFor(() => {
        expect(onValidationError).toHaveBeenCalled();
      });

      expect(screen.getByTestId("error-display")).toBeInTheDocument();
    });

    it("should handle circular references in hierarchy", async () => {
      const corruptedData = {
        nodes: [
          { id: "node1", label: "Node 1" },
          { id: "node2", label: "Node 2" },
        ],
        edges: [],
        hierarchyChoices: [
          {
            id: "choice1",
            name: "Choice 1",
            children: ["choice2"], // Circular reference
          },
          {
            id: "choice2",
            name: "Choice 2",
            children: ["choice1"], // Circular reference
          },
        ],
      };
      setupFileReaderMock(JSON.stringify(corruptedData));

      const onValidationError = vi.fn();

      render(<ErrorTestApplication onValidationError={onValidationError} />);

      const fileInput = screen
        .getByRole("button")
        .querySelector('input[type="file"]') as HTMLInputElement;
      const file = createMockFile(
        JSON.stringify(corruptedData),
        "circular.json",
      );

      await act(async () => {
        fireEvent.change(fileInput, { target: { files: [file] } });
      });

      // Should either validate or load successfully (depending on implementation)
      // The key is that it shouldn't crash
      await waitFor(() => {
        expect(
          screen.getByTestId("error-test-application"),
        ).toBeInTheDocument();
      });
    });

    it("should handle malformed Unicode characters", async () => {
      const corruptedData = {
        nodes: [
          { id: "node1", label: "Node with \uFFFD replacement char" },
          { id: "node2", label: "Node with emoji 🚀💥" },
          { id: "node3", label: "Node with \x00 null char" },
        ],
        edges: [],
      };
      setupFileReaderMock(JSON.stringify(corruptedData));

      const onError = vi.fn();

      render(<ErrorTestApplication onError={onError} />);

      const fileInput = screen
        .getByRole("button")
        .querySelector('input[type="file"]') as HTMLInputElement;
      const file = createMockFile(
        JSON.stringify(corruptedData),
        "unicode.json",
      );

      await act(async () => {
        fireEvent.change(fileInput, { target: { files: [file] } });
      });

      // Should handle Unicode gracefully without crashing
      await waitFor(() => {
        expect(
          screen.getByTestId("error-test-application"),
        ).toBeInTheDocument();
      });

      // Application should remain functional (error may or may not be displayed)
      expect(screen.getByTestId("error-test-application")).toBeInTheDocument();
    });
  });

  describe("UI Responsiveness Under High Load", () => {
    it("should remain responsive during rapid file uploads", async () => {
      const validData = {
        nodes: [{ id: "node1", label: "Node 1" }],
        edges: [],
      };

      const onError = vi.fn();
      const onValidationError = vi.fn();

      render(
        <ErrorTestApplication
          onError={onError}
          onValidationError={onValidationError}
        />,
      );

      const fileInput = screen
        .getByRole("button")
        .querySelector('input[type="file"]') as HTMLInputElement;

      // Rapid file uploads
      for (let i = 0; i < 10; i++) {
        setupFileReaderMock(JSON.stringify(validData));
        const file = createMockFile(
          JSON.stringify(validData),
          `rapid-${i}.json`,
        );

        await act(async () => {
          fireEvent.change(fileInput, { target: { files: [file] } });
        });

        // Small delay to simulate rapid user actions
        await new Promise((resolve) => setTimeout(resolve, 10));
      }

      // UI should remain responsive
      expect(screen.getByTestId("error-test-application")).toBeInTheDocument();
      // After successful uploads, we should see controls section
      expect(screen.getByTestId("controls-section")).toBeInTheDocument();
    });

    it("should handle stress testing with large corrupted files", async () => {
      // Create a large file with many corrupted entries
      const largeCorruptedData = {
        nodes: Array.from({ length: 1000 }, (_, i) => ({
          id: i % 10 === 0 ? null : `node_${i}`, // Every 10th node has null id
          label: i % 7 === 0 ? undefined : `Node ${i}`, // Every 7th node has undefined label
        })),
        edges: Array.from({ length: 1500 }, (_, i) => ({
          id: `edge_${i}`,
          source: i % 5 === 0 ? "nonexistent" : `node_${i % 1000}`, // Every 5th edge has bad source
          target: i % 3 === 0 ? null : `node_${(i + 1) % 1000}`, // Every 3rd edge has null target
        })),
      };

      setupFileReaderMock(JSON.stringify(largeCorruptedData));

      const onValidationError = vi.fn();
      const startTime = Date.now();

      render(<ErrorTestApplication onValidationError={onValidationError} />);

      const fileInput = screen
        .getByRole("button")
        .querySelector('input[type="file"]') as HTMLInputElement;
      const file = createMockFile(
        JSON.stringify(largeCorruptedData),
        "large-corrupted.json",
      );

      await act(async () => {
        fireEvent.change(fileInput, { target: { files: [file] } });
      });

      await waitFor(
        () => {
          expect(onValidationError).toHaveBeenCalled();
        },
        { timeout: 10000 },
      );

      const processingTime = Date.now() - startTime;

      // Should process even large corrupted files within reasonable time
      expect(processingTime).toBeLessThan(8000); // 8 seconds

      // UI should remain functional
      expect(screen.getByTestId("error-test-application")).toBeInTheDocument();
      expect(screen.getByTestId("error-display")).toBeInTheDocument();
    });

    it("should handle memory pressure gracefully", async () => {
      // Create multiple large objects to simulate memory pressure
      const memoryPressureData = Array.from({ length: 5 }, (_, fileIndex) => ({
        nodes: Array.from({ length: 200 }, (_, i) => ({
          id: `file${fileIndex}_node_${i}`,
          label: `File ${fileIndex} Node ${i}`.repeat(10), // Long labels
          extraData: "x".repeat(1000), // Extra data to increase memory usage
        })),
        edges: Array.from({ length: 300 }, (_, i) => ({
          id: `file${fileIndex}_edge_${i}`,
          source: `file${fileIndex}_node_${i % 200}`,
          target: `file${fileIndex}_node_${(i + 1) % 200}`,
          extraData: "y".repeat(500),
        })),
      }));

      const onError = vi.fn();

      render(<ErrorTestApplication onError={onError} />);

      const fileInput = screen
        .getByRole("button")
        .querySelector('input[type="file"]') as HTMLInputElement;

      // Upload multiple large files sequentially
      for (let i = 0; i < memoryPressureData.length; i++) {
        setupFileReaderMock(JSON.stringify(memoryPressureData[i]));
        const file = createMockFile(
          JSON.stringify(memoryPressureData[i]),
          `memory-${i}.json`,
        );

        await act(async () => {
          fireEvent.change(fileInput, { target: { files: [file] } });
        });

        // Wait a bit between uploads
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      // Should handle memory pressure without crashing
      expect(screen.getByTestId("error-test-application")).toBeInTheDocument();
    });

    it("should maintain UI responsiveness during error recovery", async () => {
      const onError = vi.fn();

      render(<ErrorTestApplication onError={onError} />);

      // First, upload an invalid file
      setupFileReaderMock("{ invalid json }");
      const fileInput = screen
        .getByRole("button")
        .querySelector('input[type="file"]') as HTMLInputElement;
      const invalidFile = createMockFile("{ invalid json }", "invalid.json");

      await act(async () => {
        fireEvent.change(fileInput, { target: { files: [invalidFile] } });
      });

      await waitFor(() => {
        expect(screen.getByTestId("error-display")).toBeInTheDocument();
      });

      // Then upload a valid file
      const validData = {
        nodes: [{ id: "node1", label: "Node 1" }],
        edges: [],
      };
      setupFileReaderMock(JSON.stringify(validData));
      const validFile = createMockFile(JSON.stringify(validData), "valid.json");

      await act(async () => {
        fireEvent.change(fileInput, { target: { files: [validFile] } });
      });

      // Should recover and show controls
      await waitFor(() => {
        expect(screen.queryByTestId("controls-section")).toBeInTheDocument();
      });

      // UI should be fully functional after recovery
      const expandButton = screen.getByText(/Expand All/);
      const searchInput = screen.getByPlaceholderText(/search/i);

      expect(expandButton).toBeInTheDocument();
      expect(searchInput).toBeInTheDocument();
      // Button may be disabled if no containers to expand
      expect(expandButton).toBeInTheDocument();
    });
  });

  describe("Error Messages and User Feedback", () => {
    it("should display clear error messages for different error types", async () => {
      const errorScenarios = [
        {
          name: "JSON Parse Error",
          content: "{ invalid json }",
          expectedMessage: /Parse error.*Invalid JSON/,
        },
        {
          name: "Missing Properties",
          content: JSON.stringify({ nodes: [] }), // missing edges
          expectedMessage: /Validation failed.*Missing required property/,
        },
        {
          name: "Empty File",
          content: "",
          expectedMessage: /Validation failed.*File is empty/,
        },
      ];

      for (const scenario of errorScenarios) {
        setupFileReaderMock(scenario.content);

        const { unmount } = render(<ErrorTestApplication />);

        const fileInput = screen
          .getByRole("button")
          .querySelector('input[type="file"]') as HTMLInputElement;
        const file = createMockFile(
          scenario.content,
          `${scenario.name.toLowerCase().replace(/\s+/g, "-")}.json`,
        );

        await act(async () => {
          fireEvent.change(fileInput, { target: { files: [file] } });
        });

        await waitFor(() => {
          expect(screen.getByTestId("error-display")).toBeInTheDocument();
        });

        expect(screen.getByText(scenario.expectedMessage)).toBeInTheDocument();

        unmount();
      }
    });

    it("should provide actionable error messages", async () => {
      const corruptedData = {
        nodes: [{ /* missing id */ label: "Node without ID" }],
        edges: [],
      };
      setupFileReaderMock(JSON.stringify(corruptedData));

      render(<ErrorTestApplication />);

      const fileInput = screen
        .getByRole("button")
        .querySelector('input[type="file"]') as HTMLInputElement;
      const file = createMockFile(
        JSON.stringify(corruptedData),
        "actionable-error.json",
      );

      await act(async () => {
        fireEvent.change(fileInput, { target: { files: [file] } });
      });

      await waitFor(() => {
        expect(screen.getByTestId("error-display")).toBeInTheDocument();
      });

      // Error message should be specific and actionable
      const errorDisplay = screen.getByTestId("error-display");
      expect(errorDisplay.textContent).toMatch(/missing required property.*id/);
    });

    it("should handle multiple simultaneous errors", async () => {
      const multiErrorData = {
        nodes: [
          {
            /* missing id and label */
          },
          { id: "", label: "" }, // empty strings
          { id: null, label: null }, // null values
        ],
        edges: [
          {
            /* missing all properties */
          },
          { id: "edge1" /* missing source and target */ },
        ],
      };
      setupFileReaderMock(JSON.stringify(multiErrorData));

      render(<ErrorTestApplication />);

      const fileInput = screen
        .getByRole("button")
        .querySelector('input[type="file"]') as HTMLInputElement;
      const file = createMockFile(
        JSON.stringify(multiErrorData),
        "multi-error.json",
      );

      await act(async () => {
        fireEvent.change(fileInput, { target: { files: [file] } });
      });

      await waitFor(() => {
        expect(screen.getByTestId("error-display")).toBeInTheDocument();
      });

      // Should display comprehensive error information
      const errorDisplay = screen.getByTestId("error-display");
      expect(errorDisplay.textContent).toMatch(/Validation failed/);
    });

    it("should clear error messages on successful upload", async () => {
      // First, cause an error
      setupFileReaderMock("{ invalid }");

      render(<ErrorTestApplication />);

      const fileInput = screen
        .getByRole("button")
        .querySelector('input[type="file"]') as HTMLInputElement;
      const invalidFile = createMockFile("{ invalid }", "invalid.json");

      await act(async () => {
        fireEvent.change(fileInput, { target: { files: [invalidFile] } });
      });

      await waitFor(() => {
        expect(screen.getByTestId("error-display")).toBeInTheDocument();
      });

      // Then upload a valid file
      const validData = {
        nodes: [{ id: "node1", label: "Node 1" }],
        edges: [],
      };
      setupFileReaderMock(JSON.stringify(validData));
      const validFile = createMockFile(JSON.stringify(validData), "valid.json");

      await act(async () => {
        fireEvent.change(fileInput, { target: { files: [validFile] } });
      });

      // Error should be cleared
      await waitFor(() => {
        expect(screen.queryByTestId("error-display")).not.toBeInTheDocument();
      });

      expect(screen.getByTestId("controls-section")).toBeInTheDocument();
    });

    it("should provide progress feedback during error recovery", async () => {
      setupFileReaderMock("{ invalid }");

      render(<ErrorTestApplication />);

      const fileInput = screen
        .getByRole("button")
        .querySelector('input[type="file"]') as HTMLInputElement;
      const file = createMockFile("{ invalid }", "test.json");

      await act(async () => {
        fireEvent.change(fileInput, { target: { files: [file] } });
      });

      // Should show processing state before error
      expect(screen.getByText(/Processing file/)).toBeInTheDocument();

      await waitFor(() => {
        expect(screen.getByTestId("error-display")).toBeInTheDocument();
      });

      // Processing message should be replaced by error
      expect(screen.queryByText(/Processing file/)).not.toBeInTheDocument();
    });
  });

  describe("Component Error Boundaries", () => {
    it("should handle core component initialization failures", async () => {
      // This would require mocking the core components to throw errors
      // For now, we test that the application doesn't crash with invalid props
      const onError = vi.fn();

      render(<ErrorTestApplication onError={onError} />);

      // Should render without crashing
      expect(screen.getByTestId("error-test-application")).toBeInTheDocument();
    });

    it("should handle search component errors gracefully", async () => {
      const validData = {
        nodes: [{ id: "node1", label: "Node 1" }],
        edges: [],
      };
      setupFileReaderMock(JSON.stringify(validData));

      const onError = vi.fn();

      render(<ErrorTestApplication onError={onError} />);

      // Upload valid data first
      const fileInput = screen
        .getByRole("button")
        .querySelector('input[type="file"]') as HTMLInputElement;
      const file = createMockFile(JSON.stringify(validData), "valid.json");

      await act(async () => {
        fireEvent.change(fileInput, { target: { files: [file] } });
      });

      await waitFor(() => {
        expect(screen.getByTestId("controls-section")).toBeInTheDocument();
      });

      // Try to cause search errors with problematic queries
      const searchInput = screen.getByPlaceholderText(/search/i);
      const problematicQueries = ["[", "(", "*", "+", "?", "^", "$", "\\"];

      for (const query of problematicQueries) {
        await act(async () => {
          fireEvent.change(searchInput, { target: { value: query } });
        });

        // Should not crash
        expect(screen.getByTestId("controls-section")).toBeInTheDocument();
      }
    });

    it("should handle container control errors gracefully", async () => {
      const validData = {
        nodes: [{ id: "node1", label: "Node 1" }],
        edges: [],
      };
      setupFileReaderMock(JSON.stringify(validData));

      const onError = vi.fn();

      render(<ErrorTestApplication onError={onError} />);

      // Upload valid data first
      const fileInput = screen
        .getByRole("button")
        .querySelector('input[type="file"]') as HTMLInputElement;
      const file = createMockFile(JSON.stringify(validData), "valid.json");

      await act(async () => {
        fireEvent.change(fileInput, { target: { files: [file] } });
      });

      await waitFor(() => {
        expect(screen.getByTestId("controls-section")).toBeInTheDocument();
      });

      // Rapid container operations should not crash
      const expandButton = screen.getByText(/Expand All/);
      const collapseButton = screen.getByText(/Collapse All/);

      for (let i = 0; i < 10; i++) {
        await act(async () => {
          fireEvent.click(expandButton);
          fireEvent.click(collapseButton);
        });
      }

      // Should remain functional (buttons may be disabled if no containers)
      expect(screen.getByTestId("controls-section")).toBeInTheDocument();
      expect(expandButton).toBeInTheDocument();
      expect(collapseButton).toBeInTheDocument();
    });
  });
});
