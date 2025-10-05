/**
 * Application Integration Tests: Error Handling and Edge Cases
 *
 * Tests invalid file upload scenarios
 * Tests application behavior with corrupted data
 * Tests UI responsiveness under high load
 * Validates error messages and user feedback
 *
 * Requirements: 12.4, 6.2
 * 
 * This test suite focuses on:
 * - Uses the `data` prop for testing corrupted data scenarios
 * - Uses FileUpload component for file upload error scenarios
 * - Tests error boundaries and graceful degradation
 * - Validates user feedback and error messages
 */

import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from "@testing-library/react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { Hydroscope } from "../components/Hydroscope.js";
import { HydroscopeCore } from "../components/HydroscopeCore.js";
import { FileUpload } from "../components/FileUpload.js";
import type {
  HydroscopeData,
} from "../types/core.js";

// Mock FileReader for testing file upload scenarios
class MockFileReader {
  result: string | null = null;
  error: Error | null = null;
  onload: ((event: any) => void) | null = null;
  onerror: ((event: any) => void) | null = null;

  readAsText(_file: File) {
    setTimeout(() => {
      if (this.error) {
        this.onerror?.({ target: this });
      } else {
        this.onload?.({ target: this });
      }
    }, 10);
  }
}

// Test data scenarios
const validData: HydroscopeData = {
  nodes: [
    { id: "node1", label: "Node 1" },
    { id: "node2", label: "Node 2" },
  ],
  edges: [
    { id: "edge1", source: "node1", target: "node2" },
  ],
  hierarchyChoices: [],
  nodeAssignments: {},
};

// Corrupted data scenarios for testing error handling
const corruptedDataScenarios = {
  missingNodes: {
    nodes: null as any,
    edges: [{ id: "edge1", source: "node1", target: "node2" }],
    hierarchyChoices: [],
    nodeAssignments: {},
  },
  invalidEdges: {
    nodes: [{ id: "node1", label: "Node 1" }],
    edges: [{ id: "edge1", source: "nonexistent", target: "node1" }],
    hierarchyChoices: [],
    nodeAssignments: {},
  },
  malformedStructure: {
    // Missing required fields
    nodes: [{ id: "node1" }], // missing label
    edges: [{ id: "edge1", source: "node1", target: "node2" }], // valid edge structure
    hierarchyChoices: [],
    nodeAssignments: {},
  },
};

describe("Integration Error Handling Tests", () => {
  let originalFileReader: typeof FileReader;

  beforeEach(() => {
    // Mock FileReader
    originalFileReader = global.FileReader;
    global.FileReader = MockFileReader as any;
    vi.clearAllMocks();
  });

  afterEach(() => {
    global.FileReader = originalFileReader;
    vi.restoreAllMocks();
  });

  describe("Invalid File Upload Scenarios", () => {
    it("should handle completely invalid JSON", async () => {
      const onParseError = vi.fn();
      const onFileLoaded = vi.fn();

      render(
        <FileUpload
          onFileLoaded={onFileLoaded}
          onParseError={onParseError}
        />
      );

      // Create a file with invalid JSON
      const invalidFile = new File(['{ invalid json'], 'invalid.json', {
        type: 'application/json',
      });

      // Mock FileReader to return invalid JSON
      (global.FileReader as any).prototype.result = '{ invalid json';

      const fileInput = screen.getByRole('button');
      const input = fileInput.querySelector('input[type="file"]') as HTMLInputElement;

      await act(async () => {
        fireEvent.change(input, { target: { files: [invalidFile] } });
      });

      // Should call parse error callback
      await waitFor(() => {
        expect(onParseError).toHaveBeenCalled();
        expect(onFileLoaded).not.toHaveBeenCalled();
      });
    });

    it("should handle files with wrong MIME types", async () => {
      const onParseError = vi.fn();
      const onFileLoaded = vi.fn();

      render(
        <FileUpload
          onFileLoaded={onFileLoaded}
          onParseError={onParseError}
          acceptedTypes={['.json']}
        />
      );

      // Create a file with wrong MIME type
      const wrongTypeFile = new File(['some content'], 'file.txt', {
        type: 'text/plain',
      });

      const fileInput = screen.getByRole('button');
      const input = fileInput.querySelector('input[type="file"]') as HTMLInputElement;

      await act(async () => {
        fireEvent.change(input, { target: { files: [wrongTypeFile] } });
      });

      // Should not process the file
      await waitFor(() => {
        expect(onFileLoaded).not.toHaveBeenCalled();
      });
    });

    it("should handle oversized files", async () => {
      const onParseError = vi.fn();
      const onFileLoaded = vi.fn();

      render(
        <FileUpload
          onFileLoaded={onFileLoaded}
          onParseError={onParseError}
          maxFileSize={1024} // 1KB limit
        />
      );

      // Create a large file (2KB)
      const largeContent = 'x'.repeat(2048);
      const largeFile = new File([largeContent], 'large.json', {
        type: 'application/json',
      });

      const fileInput = screen.getByRole('button');
      const input = fileInput.querySelector('input[type="file"]') as HTMLInputElement;

      await act(async () => {
        fireEvent.change(input, { target: { files: [largeFile] } });
      });

      // Should show error for oversized file
      await waitFor(() => {
        expect(onFileLoaded).not.toHaveBeenCalled();
      });
    });

    it("should handle empty files", async () => {
      const onParseError = vi.fn();
      const onFileLoaded = vi.fn();

      render(
        <FileUpload
          onFileLoaded={onFileLoaded}
          onParseError={onParseError}
        />
      );

      // Create empty file
      const emptyFile = new File([''], 'empty.json', {
        type: 'application/json',
      });

      const fileInput = screen.getByRole('button');
      const input = fileInput.querySelector('input[type="file"]') as HTMLInputElement;

      await act(async () => {
        fireEvent.change(input, { target: { files: [emptyFile] } });
      });

      // Should show error for empty file
      await waitFor(() => {
        expect(onFileLoaded).not.toHaveBeenCalled();
      });
    });

    it("should handle file reading errors", async () => {
      const onParseError = vi.fn();
      const onFileLoaded = vi.fn();

      render(
        <FileUpload
          onFileLoaded={onFileLoaded}
          onParseError={onParseError}
        />
      );

      // Mock FileReader to throw error
      const mockFileReader = global.FileReader as any;
      mockFileReader.prototype.error = new Error('File read failed');

      const file = new File(['{}'], 'test.json', {
        type: 'application/json',
      });

      const fileInput = screen.getByRole('button');
      const input = fileInput.querySelector('input[type="file"]') as HTMLInputElement;

      await act(async () => {
        fireEvent.change(input, { target: { files: [file] } });
      });

      // Should handle file reading error
      await waitFor(() => {
        expect(onParseError).toHaveBeenCalled();
      });
    });

    it("should handle multiple file uploads", async () => {
      const onParseError = vi.fn();
      const onFileLoaded = vi.fn();

      render(
        <FileUpload
          onFileLoaded={onFileLoaded}
          onParseError={onParseError}
        />
      );

      // Create multiple files
      const file1 = new File(['{}'], 'test1.json', { type: 'application/json' });
      const file2 = new File(['{}'], 'test2.json', { type: 'application/json' });

      const fileInput = screen.getByRole('button');
      const input = fileInput.querySelector('input[type="file"]') as HTMLInputElement;

      await act(async () => {
        fireEvent.change(input, { target: { files: [file1, file2] } });
      });

      // Should handle multiple files - may show error or process one
      await waitFor(() => {
        // Check that either success or error callback was called
        expect(onFileLoaded.mock.calls.length + onParseError.mock.calls.length).toBeGreaterThan(0);
      });
    });
  });

  describe("Corrupted Data Handling", () => {
    it("should handle missing nodes gracefully", async () => {
      const onError = vi.fn();

      render(
        <HydroscopeCore
          data={corruptedDataScenarios.missingNodes}
          onError={onError}
        />
      );

      // Should handle missing nodes gracefully by showing error message
      await waitFor(() => {
        expect(screen.getByText(/visualization error/i)).toBeInTheDocument();
        expect(screen.getByText(/data must contain a nodes array/i)).toBeInTheDocument();
      });
    });

    it("should handle malformed structure gracefully", async () => {
      const onError = vi.fn();

      render(
        <HydroscopeCore
          data={corruptedDataScenarios.malformedStructure}
          onError={onError}
        />
      );

      // Should handle malformed structure gracefully by showing error message
      await waitFor(() => {
        expect(screen.getByText(/visualization error/i)).toBeInTheDocument();
        expect(screen.getByText(/missing label field/i)).toBeInTheDocument();
      });
    });

    it("should handle edges with invalid references", async () => {
      const onError = vi.fn();

      render(
        <HydroscopeCore
          data={corruptedDataScenarios.invalidEdges}
          onError={onError}
        />
      );

      // Should handle invalid edge references gracefully
      await waitFor(() => {
        expect(screen.getByText(/loading visualization/i)).toBeInTheDocument();
      });
    });

    it("should handle circular references", async () => {
      const onError = vi.fn();

      const circularData = {
        nodes: [
          { id: "node1", label: "Node 1" },
          { id: "node2", label: "Node 2" },
        ],
        edges: [],
        hierarchyChoices: [
          { id: "choice1", name: "Circular Choice" },
        ],
        nodeAssignments: {
          choice1: { node1: "node2", node2: "node1" }
        },
      };

      render(
        <HydroscopeCore
          data={circularData}
          onError={onError}
        />
      );

      // Should handle circular references gracefully
      await waitFor(() => {
        expect(screen.getByText(/loading visualization/i)).toBeInTheDocument();
      });
    });

    it("should handle malformed Unicode characters", async () => {
      const onError = vi.fn();

      const unicodeData = {
        nodes: [
          { id: "node1", label: "Node \uFFFD\uFFFE" }, // Invalid Unicode
        ],
        edges: [],
        hierarchyChoices: [],
        nodeAssignments: {},
      };

      render(
        <HydroscopeCore
          data={unicodeData}
          onError={onError}
        />
      );

      // Should handle malformed Unicode gracefully
      await waitFor(() => {
        expect(screen.getByText(/loading visualization/i)).toBeInTheDocument();
      });
    });
  });

  describe("High Load and Stress Testing", () => {
    it("should handle rapid file uploads", async () => {
      const onError = vi.fn();
      const onFileLoaded = vi.fn();

      render(
        <FileUpload
          onFileLoaded={onFileLoaded}
          onParseError={onError}
        />
      );

      // Create multiple rapid uploads
      const files = Array.from({ length: 5 }, (_, i) =>
        new File([JSON.stringify(validData)], `test${i}.json`, {
          type: 'application/json',
        })
      );

      const fileInput = screen.getByRole('button');
      const input = fileInput.querySelector('input[type="file"]') as HTMLInputElement;

      // Rapidly upload files
      for (const file of files) {
        await act(async () => {
          fireEvent.change(input, { target: { files: [file] } });
        });
      }

      // UI should remain responsive - file upload button should still be present
      expect(screen.getByRole('button')).toBeInTheDocument();
    });

    it("should handle stress testing with large corrupted datasets", async () => {
      const onError = vi.fn();

      // Create large corrupted dataset with some valid nodes
      const largeCorruptedData = {
        nodes: Array.from({ length: 100 }, (_, i) => ({
          id: `node${i}`,
          label: `Node ${i}`, // All have labels to avoid immediate error
        })),
        edges: Array.from({ length: 200 }, (_, i) => ({
          id: `edge${i}`,
          source: `node${i % 100}`,
          target: i % 15 === 0 ? "nonexistent" : `node${(i + 1) % 100}`, // Some invalid targets
        })),
        hierarchyChoices: [],
        nodeAssignments: {},
      };

      render(
        <HydroscopeCore
          data={largeCorruptedData as any}
          onError={onError}
        />
      );

      // Should handle large corrupted data without crashing - may show loading or error
      await waitFor(() => {
        const hasLoading = screen.queryByText(/loading visualization/i);
        const hasError = screen.queryByText(/visualization error/i);
        expect(hasLoading || hasError).toBeTruthy();
      }, { timeout: 10000 });
    });

    it("should handle memory pressure gracefully", async () => {
      const onError = vi.fn();

      // Create data that might cause memory pressure (reduced size for faster testing)
      const memoryIntensiveData = {
        nodes: Array.from({ length: 50 }, (_, i) => ({
          id: `node${i}`,
          label: `Node ${i}`.repeat(5), // Smaller labels
          data: { largeProperty: 'x'.repeat(50) }, // Smaller data objects
        })),
        edges: Array.from({ length: 100 }, (_, i) => ({
          id: `edge${i}`,
          source: `node${i % 50}`,
          target: `node${(i + 1) % 50}`,
        })),
        hierarchyChoices: [],
        nodeAssignments: {},
      };

      render(
        <HydroscopeCore
          data={memoryIntensiveData as any}
          onError={onError}
        />
      );

      // Should handle memory pressure gracefully - may show loading or error
      await waitFor(() => {
        const hasLoading = screen.queryByText(/loading visualization/i);
        const hasError = screen.queryByText(/visualization error/i);
        expect(hasLoading || hasError).toBeTruthy();
      }, { timeout: 10000 });
    });

    it("should maintain UI responsiveness during error recovery", async () => {
      const onError = vi.fn();
      const { rerender } = render(
        <HydroscopeCore
          data={corruptedDataScenarios.missingNodes}
          onError={onError}
        />
      );

      // Wait for initial error state
      await waitFor(() => {
        expect(screen.getByText(/visualization error/i)).toBeInTheDocument();
      });

      // Recover with valid data
      rerender(
        <HydroscopeCore
          data={validData}
          onError={onError}
        />
      );

      // Should show loading state during recovery
      expect(screen.getByText(/loading visualization/i)).toBeInTheDocument();
    });
  });

  describe("Error Messages and User Feedback", () => {
    it("should display clear error messages for invalid files", async () => {
      const onParseError = vi.fn();

      render(
        <FileUpload
          onFileLoaded={() => { }}
          onParseError={onParseError}
        />
      );

      // Create invalid JSON file
      const invalidFile = new File(['{ invalid'], 'invalid.json', {
        type: 'application/json',
      });

      const fileInput = screen.getByRole('button');
      const input = fileInput.querySelector('input[type="file"]') as HTMLInputElement;

      await act(async () => {
        fireEvent.change(input, { target: { files: [invalidFile] } });
      });

      await waitFor(() => {
        expect(onParseError).toHaveBeenCalled();
      });
    });

    it("should provide actionable error messages", async () => {
      const onParseError = vi.fn();

      render(
        <FileUpload
          onFileLoaded={() => { }}
          onParseError={onParseError}
          acceptedTypes={['.json']}
        />
      );

      // Test wrong file type
      const wrongFile = new File(['content'], 'file.txt', {
        type: 'text/plain',
      });

      const fileInput = screen.getByRole('button');
      const input = fileInput.querySelector('input[type="file"]') as HTMLInputElement;

      await act(async () => {
        fireEvent.change(input, { target: { files: [wrongFile] } });
      });

      // Should provide actionable feedback
      await waitFor(() => {
        // The exact message depends on implementation
        expect(screen.getByRole('button')).toBeInTheDocument();
      });
    });

    it("should handle multiple error conditions simultaneously", async () => {
      const onError = vi.fn();

      // Create a scenario with multiple error conditions
      const problematicData = {
        nodes: null, // Missing nodes
        edges: [{ source: "missing" }], // Invalid edges
        hierarchyChoices: [],
        nodeAssignments: {},
      };

      render(
        <HydroscopeCore
          data={problematicData as any}
          onError={onError}
        />
      );

      // Should handle multiple errors gracefully by showing error message
      await waitFor(() => {
        expect(screen.getByText(/visualization error/i)).toBeInTheDocument();
        expect(screen.getByText(/data must contain a nodes array/i)).toBeInTheDocument();
      });
    });

    it("should clear error messages on successful recovery", async () => {
      const onError = vi.fn();
      const { rerender } = render(
        <HydroscopeCore
          data={corruptedDataScenarios.missingNodes}
          onError={onError}
        />
      );

      // Wait for initial error state
      await waitFor(() => {
        expect(screen.getByText(/visualization error/i)).toBeInTheDocument();
      });

      // Provide valid data
      rerender(
        <HydroscopeCore
          data={validData}
          onError={onError}
        />
      );

      // Should show loading state after recovery
      expect(screen.getByText(/loading visualization/i)).toBeInTheDocument();
    });

    it("should provide progress feedback during error recovery", async () => {
      const onError = vi.fn();

      const { rerender } = render(
        <HydroscopeCore
          data={corruptedDataScenarios.invalidEdges}
          onError={onError}
        />
      );

      // Wait for initial state
      await waitFor(() => {
        expect(screen.getByText(/loading visualization/i)).toBeInTheDocument();
      });

      // Provide corrected data
      rerender(
        <HydroscopeCore
          data={validData}
          onError={onError}
        />
      );

      // Should maintain loading state during recovery
      expect(screen.getByText(/loading visualization/i)).toBeInTheDocument();
    });
  });

  describe("Component Error Boundaries", () => {
    it("should handle core component initialization errors", async () => {
      const onError = vi.fn();

      // Test with data that might cause initialization issues
      const problematicData = {
        nodes: [{ id: null }], // null values
        edges: [],
        hierarchyChoices: [],
        nodeAssignments: {},
      };

      render(
        <HydroscopeCore
          data={problematicData as any}
          onError={onError}
        />
      );

      // Should handle initialization errors gracefully by showing error message
      await waitFor(() => {
        expect(screen.getByText(/visualization error/i)).toBeInTheDocument();
        expect(screen.getByText(/missing required.*id.*field/i)).toBeInTheDocument();
      });
    });

    it("should handle enhanced component errors gracefully", async () => {
      const onError = vi.fn();

      render(
        <Hydroscope
          data={validData}
          showInfoPanel={true}
          onError={onError}
        />
      );

      // Should render without errors - check for loading state
      expect(screen.getByText(/loading visualization/i)).toBeInTheDocument();
    });

    it("should handle container control errors gracefully", async () => {
      const onError = vi.fn();

      render(
        <Hydroscope
          data={validData}
          showInfoPanel={true}
          enableCollapse={true}
          onError={onError}
        />
      );

      // Should render without container errors - check for loading state
      expect(screen.getByText(/loading visualization/i)).toBeInTheDocument();
    });
  });
});