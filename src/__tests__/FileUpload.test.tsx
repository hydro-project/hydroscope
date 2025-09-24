/**
 * FileUpload Component Tests
 * Tests file upload UI with drag-and-drop support, validation, and error handling
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FileUpload } from '../components/FileUpload.js';
import type { HydroscopeData, ParseError, ValidationResult } from '../types/core.js';

// Mock FileReader
class MockFileReader {
  result: string | null = null;
  error: Error | null = null;
  onload: ((event: any) => void) | null = null;
  onerror: ((event: any) => void) | null = null;

  readAsText(file: File) {
    // Simulate async file reading
    setTimeout(() => {
      if (this.error) {
        this.onerror?.({ target: this });
      } else {
        this.onload?.({ target: { result: this.result } });
      }
    }, 10);
  }
}

// Store original FileReader
const originalFileReader = global.FileReader;

beforeEach(() => {
  // Reset FileReader to original before each test
  global.FileReader = originalFileReader;
});

afterEach(() => {
  // Clean up after each test
  global.FileReader = originalFileReader;
  vi.clearAllMocks();
});

// Test data
const validJSONData = {
  nodes: [
    { id: 'node1', label: 'Node 1', type: 'Transform' },
    { id: 'node2', label: 'Node 2', type: 'Source' }
  ],
  edges: [
    { id: 'edge1', source: 'node1', target: 'node2' }
  ],
  hierarchyChoices: [
    { id: 'location', name: 'Location', children: [] }
  ],
  nodeAssignments: {
    location: { node1: 'container1', node2: 'container2' }
  }
};

const invalidJSONString = '{ invalid json }';
const validJSONString = JSON.stringify(validJSONData);

// Helper to create mock file
const createMockFile = (content: string, name: string = 'test.json', type: string = 'application/json'): File => {
  const blob = new Blob([content], { type });
  const file = new File([blob], name, { type });
  return file;
};

// Helper to setup FileReader mock
const setupFileReaderMock = (result: string | null, error: Error | null = null) => {
  const mockInstance = new MockFileReader();
  mockInstance.result = result;
  mockInstance.error = error;
  
  // Replace global FileReader with our mock
  global.FileReader = vi.fn().mockImplementation(() => mockInstance) as any;
  
  return mockInstance;
};

describe('FileUpload Component', () => {
  describe('Rendering', () => {
    it('renders upload area with correct initial state', () => {
      render(<FileUpload />);
      
      expect(screen.getByText('Drop a JSON file here or click to select')).toBeInTheDocument();
      expect(screen.getByText(/Supported formats: \.json/)).toBeInTheDocument();
      expect(screen.getByRole('button')).toBeInTheDocument();
    });

    it('renders with custom accepted types and max file size', () => {
      render(
        <FileUpload 
          acceptedTypes={['.json', '.txt']} 
          maxFileSize={10 * 1024 * 1024} // 10MB
        />
      );
      
      expect(screen.getByText(/Supported formats: \.json, \.txt/)).toBeInTheDocument();
      expect(screen.getByText(/Max size: 10MB/)).toBeInTheDocument();
    });

    it('shows processing state when file is being processed', async () => {
      setupFileReaderMock(validJSONString);
      const onFileLoaded = vi.fn();
      
      render(<FileUpload onFileLoaded={onFileLoaded} />);
      
      const file = createMockFile(validJSONString);
      const input = screen.getByRole('button').querySelector('input[type="file"]') as HTMLInputElement;
      
      fireEvent.change(input, { target: { files: [file] } });
      
      expect(screen.getByText('Processing file...')).toBeInTheDocument();
      expect(screen.getByText('Processing file...')).toBeInTheDocument();
    });
  });

  describe('File Validation', () => {
    it('rejects files with invalid extensions', async () => {
      const onValidationError = vi.fn();
      
      render(<FileUpload onValidationError={onValidationError} />);
      
      const file = createMockFile(validJSONString, 'test.txt', 'text/plain');
      const input = screen.getByRole('button').querySelector('input[type="file"]') as HTMLInputElement;
      
      fireEvent.change(input, { target: { files: [file] } });
      
      await waitFor(() => {
        expect(onValidationError).toHaveBeenCalledWith(
          expect.arrayContaining([
            expect.objectContaining({
              type: 'file_type',
              message: expect.stringContaining('Invalid file type')
            })
          ]),
          'test.txt'
        );
      });
    });

    it('rejects files that are too large', async () => {
      const onValidationError = vi.fn();
      const maxSize = 1024; // 1KB
      
      render(<FileUpload onValidationError={onValidationError} maxFileSize={maxSize} />);
      
      // Create a file larger than maxSize
      const largeContent = 'x'.repeat(maxSize + 1);
      const file = createMockFile(largeContent);
      const input = screen.getByRole('button').querySelector('input[type="file"]') as HTMLInputElement;
      
      fireEvent.change(input, { target: { files: [file] } });
      
      await waitFor(() => {
        expect(onValidationError).toHaveBeenCalledWith(
          expect.arrayContaining([
            expect.objectContaining({
              type: 'file_size',
              message: expect.stringContaining('File too large')
            })
          ]),
          'test.json'
        );
      });
    });

    it('rejects empty files', async () => {
      const onValidationError = vi.fn();
      
      render(<FileUpload onValidationError={onValidationError} />);
      
      const file = createMockFile('');
      const input = screen.getByRole('button').querySelector('input[type="file"]') as HTMLInputElement;
      
      fireEvent.change(input, { target: { files: [file] } });
      
      await waitFor(() => {
        expect(onValidationError).toHaveBeenCalledWith(
          expect.arrayContaining([
            expect.objectContaining({
              type: 'file_empty',
              message: 'File is empty'
            })
          ]),
          'test.json'
        );
      });
    });
  });

  describe('JSON Parsing', () => {
    it('handles invalid JSON gracefully', async () => {
      setupFileReaderMock(invalidJSONString);
      const onParseError = vi.fn();
      
      render(<FileUpload onParseError={onParseError} />);
      
      const file = createMockFile(invalidJSONString);
      const input = screen.getByRole('button').querySelector('input[type="file"]') as HTMLInputElement;
      
      fireEvent.change(input, { target: { files: [file] } });
      
      await waitFor(() => {
        expect(onParseError).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'json_parse',
            message: expect.stringContaining('Invalid JSON')
          }),
          'test.json'
        );
      });
    });

    it('handles file reading errors', async () => {
      setupFileReaderMock(null, new Error('File read error'));
      const onParseError = vi.fn();
      
      render(<FileUpload onParseError={onParseError} />);
      
      const file = createMockFile(validJSONString);
      const input = screen.getByRole('button').querySelector('input[type="file"]') as HTMLInputElement;
      
      fireEvent.change(input, { target: { files: [file] } });
      
      await waitFor(() => {
        expect(onParseError).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'processing_error',
            message: expect.stringContaining('File processing failed')
          }),
          'test.json'
        );
      });
    });
  });

  describe('JSON Structure Validation', () => {
    it('validates required top-level properties', async () => {
      const invalidData = { nodes: [] }; // missing edges
      setupFileReaderMock(JSON.stringify(invalidData));
      const onValidationError = vi.fn();
      
      render(<FileUpload onValidationError={onValidationError} />);
      
      const file = createMockFile(JSON.stringify(invalidData));
      const input = screen.getByRole('button').querySelector('input[type="file"]') as HTMLInputElement;
      
      fireEvent.change(input, { target: { files: [file] } });
      
      await waitFor(() => {
        expect(onValidationError).toHaveBeenCalledWith(
          expect.arrayContaining([
            expect.objectContaining({
              type: 'missing_property',
              message: 'Missing required property: edges'
            })
          ]),
          'test.json'
        );
      });
    });

    it('validates nodes array structure', async () => {
      const invalidData = { 
        nodes: [{ /* missing id */ label: 'Node 1' }], 
        edges: [] 
      };
      setupFileReaderMock(JSON.stringify(invalidData));
      const onValidationError = vi.fn();
      
      render(<FileUpload onValidationError={onValidationError} />);
      
      const file = createMockFile(JSON.stringify(invalidData));
      const input = screen.getByRole('button').querySelector('input[type="file"]') as HTMLInputElement;
      
      fireEvent.change(input, { target: { files: [file] } });
      
      await waitFor(() => {
        expect(onValidationError).toHaveBeenCalledWith(
          expect.arrayContaining([
            expect.objectContaining({
              type: 'missing_node_property',
              message: expect.stringContaining('missing required property: id')
            })
          ]),
          'test.json'
        );
      });
    });

    it('validates edges array structure', async () => {
      const invalidData = { 
        nodes: [{ id: 'node1', label: 'Node 1' }], 
        edges: [{ id: 'edge1' /* missing source and target */ }] 
      };
      setupFileReaderMock(JSON.stringify(invalidData));
      const onValidationError = vi.fn();
      
      render(<FileUpload onValidationError={onValidationError} />);
      
      const file = createMockFile(JSON.stringify(invalidData));
      const input = screen.getByRole('button').querySelector('input[type="file"]') as HTMLInputElement;
      
      fireEvent.change(input, { target: { files: [file] } });
      
      await waitFor(() => {
        expect(onValidationError).toHaveBeenCalledWith(
          expect.arrayContaining([
            expect.objectContaining({
              type: 'missing_edge_property',
              message: expect.stringContaining('missing required property: source')
            }),
            expect.objectContaining({
              type: 'missing_edge_property',
              message: expect.stringContaining('missing required property: target')
            })
          ]),
          'test.json'
        );
      });
    });

    it('validates hierarchyChoices structure when present', async () => {
      const invalidData = { 
        nodes: [{ id: 'node1', label: 'Node 1' }], 
        edges: [],
        hierarchyChoices: [{ /* missing id and name */ children: [] }]
      };
      setupFileReaderMock(JSON.stringify(invalidData));
      const onValidationError = vi.fn();
      
      render(<FileUpload onValidationError={onValidationError} />);
      
      const file = createMockFile(JSON.stringify(invalidData));
      const input = screen.getByRole('button').querySelector('input[type="file"]') as HTMLInputElement;
      
      fireEvent.change(input, { target: { files: [file] } });
      
      await waitFor(() => {
        expect(onValidationError).toHaveBeenCalledWith(
          expect.arrayContaining([
            expect.objectContaining({
              type: 'missing_hierarchy_choice_property',
              message: expect.stringContaining('missing required property: id')
            }),
            expect.objectContaining({
              type: 'missing_hierarchy_choice_property',
              message: expect.stringContaining('missing required property: name')
            })
          ]),
          'test.json'
        );
      });
    });
  });

  describe('Custom Validation', () => {
    it('runs custom validator when provided', async () => {
      const customValidator = vi.fn().mockReturnValue([
        {
          type: 'custom_error',
          message: 'Custom validation failed',
          severity: 'error' as const
        }
      ]);
      setupFileReaderMock(validJSONString);
      const onValidationError = vi.fn();
      
      render(
        <FileUpload 
          customValidator={customValidator}
          onValidationError={onValidationError}
        />
      );
      
      const file = createMockFile(validJSONString);
      const input = screen.getByRole('button').querySelector('input[type="file"]') as HTMLInputElement;
      
      fireEvent.change(input, { target: { files: [file] } });
      
      await waitFor(() => {
        expect(customValidator).toHaveBeenCalledWith(validJSONData);
        expect(onValidationError).toHaveBeenCalledWith(
          expect.arrayContaining([
            expect.objectContaining({
              type: 'custom_error',
              message: 'Custom validation failed'
            })
          ]),
          'test.json'
        );
      });
    });

    it('handles custom validator errors gracefully', async () => {
      const customValidator = vi.fn().mockImplementation(() => {
        throw new Error('Validator crashed');
      });
      setupFileReaderMock(validJSONString);
      const onValidationError = vi.fn();
      
      render(
        <FileUpload 
          customValidator={customValidator}
          onValidationError={onValidationError}
        />
      );
      
      const file = createMockFile(validJSONString);
      const input = screen.getByRole('button').querySelector('input[type="file"]') as HTMLInputElement;
      
      fireEvent.change(input, { target: { files: [file] } });
      
      await waitFor(() => {
        expect(onValidationError).toHaveBeenCalledWith(
          expect.arrayContaining([
            expect.objectContaining({
              type: 'custom_validation_error',
              message: expect.stringContaining('Custom validation failed: Validator crashed')
            })
          ]),
          'test.json'
        );
      });
    });
  });

  describe('Successful File Processing', () => {
    it('calls onFileLoaded with correct data structure', async () => {
      setupFileReaderMock(validJSONString);
      const onFileLoaded = vi.fn();
      
      render(<FileUpload onFileLoaded={onFileLoaded} />);
      
      const file = createMockFile(validJSONString);
      const input = screen.getByRole('button').querySelector('input[type="file"]') as HTMLInputElement;
      
      fireEvent.change(input, { target: { files: [file] } });
      
      await waitFor(() => {
        expect(onFileLoaded).toHaveBeenCalledWith(
          expect.objectContaining({
            nodes: validJSONData.nodes,
            edges: validJSONData.edges,
            hierarchyChoices: validJSONData.hierarchyChoices,
            nodeAssignments: validJSONData.nodeAssignments
          }),
          'test.json'
        );
      });
    });

    it('shows success message after successful upload', async () => {
      setupFileReaderMock(validJSONString);
      const onFileLoaded = vi.fn();
      
      render(<FileUpload onFileLoaded={onFileLoaded} />);
      
      const file = createMockFile(validJSONString, 'paxos.json');
      const input = screen.getByRole('button').querySelector('input[type="file"]') as HTMLInputElement;
      
      fireEvent.change(input, { target: { files: [file] } });
      
      await waitFor(() => {
        expect(screen.getByText('Successfully loaded paxos.json')).toBeInTheDocument();
      });
    });
  });

  describe('Drag and Drop', () => {
    it('handles drag over events', () => {
      render(<FileUpload />);
      
      const uploadArea = screen.getByRole('button');
      
      fireEvent.dragOver(uploadArea);
      
      expect(uploadArea).toHaveClass('drag-over');
    });

    it('handles drag leave events', () => {
      render(<FileUpload />);
      
      const uploadArea = screen.getByRole('button');
      
      fireEvent.dragOver(uploadArea);
      expect(uploadArea).toHaveClass('drag-over');
      
      fireEvent.dragLeave(uploadArea);
      expect(uploadArea).not.toHaveClass('drag-over');
    });

    it('handles file drop', async () => {
      setupFileReaderMock(validJSONString);
      const onFileLoaded = vi.fn();
      
      render(<FileUpload onFileLoaded={onFileLoaded} />);
      
      const uploadArea = screen.getByRole('button');
      const file = createMockFile(validJSONString);
      
      const dropEvent = new Event('drop', { bubbles: true });
      Object.defineProperty(dropEvent, 'dataTransfer', {
        value: { files: [file] }
      });
      
      fireEvent(uploadArea, dropEvent);
      
      await waitFor(() => {
        expect(onFileLoaded).toHaveBeenCalled();
      });
    });
  });

  describe('Keyboard Accessibility', () => {
    it('handles Enter key to trigger file selection', () => {
      const mockClick = vi.fn();
      render(<FileUpload />);
      
      const uploadArea = screen.getByRole('button');
      const input = uploadArea.querySelector('input[type="file"]') as HTMLInputElement;
      input.click = mockClick;
      
      fireEvent.keyDown(uploadArea, { key: 'Enter' });
      
      expect(mockClick).toHaveBeenCalled();
    });

    it('handles Space key to trigger file selection', () => {
      const mockClick = vi.fn();
      render(<FileUpload />);
      
      const uploadArea = screen.getByRole('button');
      const input = uploadArea.querySelector('input[type="file"]') as HTMLInputElement;
      input.click = mockClick;
      
      fireEvent.keyDown(uploadArea, { key: ' ' });
      
      expect(mockClick).toHaveBeenCalled();
    });
  });

  describe('Error Display', () => {
    it('displays error messages in UI', async () => {
      setupFileReaderMock(invalidJSONString);
      
      render(<FileUpload />);
      
      const file = createMockFile(invalidJSONString);
      const input = screen.getByRole('button').querySelector('input[type="file"]') as HTMLInputElement;
      
      fireEvent.change(input, { target: { files: [file] } });
      
      await waitFor(() => {
        expect(screen.getByText(/Invalid JSON/)).toBeInTheDocument();
      });
    });

    it('clears previous error messages on new upload', async () => {
      setupFileReaderMock(invalidJSONString);
      
      render(<FileUpload />);
      
      const file1 = createMockFile(invalidJSONString);
      const input = screen.getByRole('button').querySelector('input[type="file"]') as HTMLInputElement;
      
      // First upload with error
      fireEvent.change(input, { target: { files: [file1] } });
      
      await waitFor(() => {
        expect(screen.getByText(/Invalid JSON/)).toBeInTheDocument();
      });
      
      // Second upload should clear error during processing
      setupFileReaderMock(validJSONString);
      const file2 = createMockFile(validJSONString);
      
      fireEvent.change(input, { target: { files: [file2] } });
      
      // Error should be cleared when processing starts
      expect(screen.queryByText(/Invalid JSON/)).not.toBeInTheDocument();
    });
  });

  describe('Debug Mode', () => {
    it('logs debug messages when debug is enabled', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      setupFileReaderMock(validJSONString);
      
      render(<FileUpload debug={true} />);
      
      const file = createMockFile(validJSONString);
      const input = screen.getByRole('button').querySelector('input[type="file"]') as HTMLInputElement;
      
      fireEvent.change(input, { target: { files: [file] } });
      
      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining('[FileUpload] Processing file'),
          expect.any(Object)
        );
      });
      
      consoleSpy.mockRestore();
    });

    it('does not log debug messages when debug is disabled', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      setupFileReaderMock(validJSONString);
      
      render(<FileUpload debug={false} />);
      
      const file = createMockFile(validJSONString);
      const input = screen.getByRole('button').querySelector('input[type="file"]') as HTMLInputElement;
      
      fireEvent.change(input, { target: { files: [file] } });
      
      await waitFor(() => {
        expect(consoleSpy).not.toHaveBeenCalledWith(
          expect.stringContaining('[FileUpload]'),
          expect.any(Object)
        );
      });
      
      consoleSpy.mockRestore();
    });
  });
});