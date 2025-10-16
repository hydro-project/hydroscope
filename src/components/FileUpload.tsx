/**
 * FileUpload - React component for uploading and validating JSON files
 * Supports drag-and-drop and file selection with comprehensive validation
 */
import React, { useCallback, useState, useRef, useEffect } from "react";
import { hscopeLogger } from "../utils/logger.js";
import type {
  HydroscopeData,
  ParseError,
  ValidationResult,
} from "../types/core.js";
export interface FileUploadProps {
  /** Callback when file is successfully parsed */
  onFileLoaded?: (data: HydroscopeData, filename: string) => void;
  /** Callback when parsing fails */
  onParseError?: (error: ParseError, filename: string) => void;
  /** Callback when validation fails */
  onValidationError?: (errors: ValidationResult[], filename: string) => void;
  /** Accept only specific file types */
  acceptedTypes?: string[];
  /** Maximum file size in bytes */
  maxFileSize?: number;
  /** Enable debug logging */
  debug?: boolean;
  /** Custom validation function */
  customValidator?: (data: any) => ValidationResult[];
  /** Show detailed error messages */
  showDetailedErrors?: boolean;
  /** Generated file path to display for copying */
  generatedFilePath?: string;
}
export interface FileUploadState {
  isDragOver: boolean;
  isProcessing: boolean;
  lastError: string | null;
  lastSuccess: string | null;
  uploadProgress: number;
}
export const FileUpload: React.FC<FileUploadProps> = ({
  onFileLoaded,
  onParseError,
  onValidationError,
  acceptedTypes = [".json"],
  maxFileSize = 50 * 1024 * 1024, // 50MB default
  debug = false,
  customValidator,
  showDetailedErrors: _showDetailedErrors = false,
  generatedFilePath,
}) => {
  const [state, setState] = useState<FileUploadState>({
    isDragOver: false,
    isProcessing: false,
    lastError: null,
    lastSuccess: null,
    uploadProgress: 0,
  });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mountedRef = useRef(true);
  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);
  const safeSetState = useCallback(
    (updater: React.SetStateAction<FileUploadState>) => {
      if (mountedRef.current) {
        setState(updater);
      }
    },
    [],
  );
  // Debug logging helper
  const debugLog = useCallback(
    (message: string, data?: any) => {
      if (debug) {
        hscopeLogger.log("debug", `[FileUpload] ${message}`, data);
      }
    },
    [debug],
  );
  // Validate file before processing
  const validateFile = useCallback(
    (file: File): ValidationResult[] => {
      const errors: ValidationResult[] = [];
      // Check file type
      const fileExtension = "." + file.name.split(".").pop()?.toLowerCase();
      if (!acceptedTypes.includes(fileExtension)) {
        errors.push({
          type: "file_type",
          message: `Invalid file type. Expected: ${acceptedTypes.join(", ")}`,
          severity: "error",
          context: { filename: file.name, extension: fileExtension },
        });
      }
      // Check file size
      if (file.size > maxFileSize) {
        errors.push({
          type: "file_size",
          message: `File too large. Maximum size: ${Math.round(maxFileSize / 1024 / 1024)}MB`,
          severity: "error",
          context: {
            filename: file.name,
            size: file.size,
            maxSize: maxFileSize,
          },
        });
      }
      // Check if file is empty
      if (file.size === 0) {
        errors.push({
          type: "file_empty",
          message: "File is empty",
          severity: "error",
          context: { filename: file.name },
        });
      }
      return errors;
    },
    [acceptedTypes, maxFileSize],
  );
  // Validate JSON structure
  const validateJSONStructure = useCallback(
    (data: any, filename: string): ValidationResult[] => {
      const errors: ValidationResult[] = [];
      // Check if it's an object
      if (typeof data !== "object" || data === null || Array.isArray(data)) {
        errors.push({
          type: "json_structure",
          message: "JSON must be an object",
          severity: "error",
          context: { filename, dataType: typeof data },
        });
        return errors;
      }
      // Check required top-level properties
      const requiredProps = ["nodes", "edges"];
      for (const prop of requiredProps) {
        if (!(prop in data)) {
          errors.push({
            type: "missing_property",
            message: `Missing required property: ${prop}`,
            severity: "error",
            context: { filename, property: prop },
          });
        }
      }
      // Validate nodes array
      if ("nodes" in data) {
        if (!Array.isArray(data.nodes)) {
          errors.push({
            type: "invalid_property_type",
            message: "nodes must be an array",
            severity: "error",
            context: {
              filename,
              property: "nodes",
              expectedType: "array",
              actualType: typeof data.nodes,
            },
          });
        } else {
          // Validate node structure
          data.nodes.forEach((node: any, index: number) => {
            if (typeof node !== "object" || node === null) {
              errors.push({
                type: "invalid_node",
                message: `Node at index ${index} must be an object`,
                severity: "error",
                context: { filename, nodeIndex: index },
              });
              return;
            }
            // Check required node properties
            const requiredNodeProps = ["id"];
            for (const prop of requiredNodeProps) {
              if (!(prop in node)) {
                errors.push({
                  type: "missing_node_property",
                  message: `Node at index ${index} missing required property: ${prop}`,
                  severity: "error",
                  context: { filename, nodeIndex: index, property: prop },
                });
              }
            }
            // Validate node ID is string
            if ("id" in node && typeof node.id !== "string") {
              errors.push({
                type: "invalid_node_property",
                message: `Node at index ${index} has invalid id type`,
                severity: "error",
                context: {
                  filename,
                  nodeIndex: index,
                  property: "id",
                  expectedType: "string",
                  actualType: typeof node.id,
                },
              });
            }
          });
        }
      }
      // Validate edges array
      if ("edges" in data) {
        if (!Array.isArray(data.edges)) {
          errors.push({
            type: "invalid_property_type",
            message: "edges must be an array",
            severity: "error",
            context: {
              filename,
              property: "edges",
              expectedType: "array",
              actualType: typeof data.edges,
            },
          });
        } else {
          // Validate edge structure
          data.edges.forEach((edge: any, index: number) => {
            if (typeof edge !== "object" || edge === null) {
              errors.push({
                type: "invalid_edge",
                message: `Edge at index ${index} must be an object`,
                severity: "error",
                context: { filename, edgeIndex: index },
              });
              return;
            }
            // Check required edge properties
            const requiredEdgeProps = ["id", "source", "target"];
            for (const prop of requiredEdgeProps) {
              if (!(prop in edge)) {
                errors.push({
                  type: "missing_edge_property",
                  message: `Edge at index ${index} missing required property: ${prop}`,
                  severity: "error",
                  context: { filename, edgeIndex: index, property: prop },
                });
              }
            }
          });
        }
      }
      // Validate hierarchyChoices if present
      if ("hierarchyChoices" in data) {
        if (!Array.isArray(data.hierarchyChoices)) {
          errors.push({
            type: "invalid_property_type",
            message: "hierarchyChoices must be an array",
            severity: "error",
            context: {
              filename,
              property: "hierarchyChoices",
              expectedType: "array",
              actualType: typeof data.hierarchyChoices,
            },
          });
        } else {
          data.hierarchyChoices.forEach((choice: any, index: number) => {
            if (typeof choice !== "object" || choice === null) {
              errors.push({
                type: "invalid_hierarchy_choice",
                message: `HierarchyChoice at index ${index} must be an object`,
                severity: "error",
                context: { filename, choiceIndex: index },
              });
              return;
            }
            // Check required hierarchy choice properties
            const requiredChoiceProps = ["id", "name"];
            for (const prop of requiredChoiceProps) {
              if (!(prop in choice)) {
                errors.push({
                  type: "missing_hierarchy_choice_property",
                  message: `HierarchyChoice at index ${index} missing required property: ${prop}`,
                  severity: "error",
                  context: { filename, choiceIndex: index, property: prop },
                });
              }
            }
          });
        }
      }
      // Run custom validation if provided
      if (customValidator) {
        try {
          const customErrors = customValidator(data);
          errors.push(...customErrors);
        } catch (error) {
          errors.push({
            type: "custom_validation_error",
            message: `Custom validation failed: ${error instanceof Error ? error.message : "Unknown error"}`,
            severity: "error",
            context: {
              filename,
              error: error instanceof Error ? error.message : String(error),
            },
          });
        }
      }
      return errors;
    },
    [customValidator],
  );
  // Process uploaded file
  const processFile = useCallback(
    async (file: File) => {
      debugLog("Processing file", {
        name: file.name,
        size: file.size,
        type: file.type,
      });
      safeSetState((prev) => ({
        ...prev,
        isProcessing: true,
        lastError: null,
        lastSuccess: null,
        uploadProgress: 0,
      }));
      try {
        // Validate file
        const fileErrors = validateFile(file);
        if (fileErrors.length > 0) {
          debugLog("File validation failed", fileErrors);
          if (onValidationError) {
            onValidationError(fileErrors, file.name);
          }
          safeSetState((prev) => ({
            ...prev,
            isProcessing: false,
            lastError: fileErrors.map((e) => e.message).join(", "),
          }));
          return;
        }
        // Update progress
        safeSetState((prev) => ({ ...prev, uploadProgress: 25 }));
        // Read file content
        const fileContent = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (e) => {
            if (e.target?.result) {
              resolve(e.target.result as string);
            } else {
              reject(new Error("Failed to read file"));
            }
          };
          reader.onerror = () => reject(new Error("File reading failed"));
          reader.readAsText(file);
        });
        // Update progress
        safeSetState((prev) => ({ ...prev, uploadProgress: 50 }));
        // Parse JSON
        let parsedData: any;
        try {
          parsedData = JSON.parse(fileContent);
        } catch (parseError) {
          const error: ParseError = {
            type: "json_parse",
            message: `Invalid JSON: ${parseError instanceof Error ? parseError.message : "Unknown parsing error"}`,
            line: undefined,
            column: undefined,
            context: { filename: file.name },
          };
          debugLog("JSON parsing failed", error);
          if (onParseError) {
            onParseError(error, file.name);
          }
          safeSetState((prev) => ({
            ...prev,
            isProcessing: false,
            lastError: error.message,
          }));
          return;
        }
        // Update progress
        safeSetState((prev) => ({ ...prev, uploadProgress: 75 }));
        // Validate JSON structure
        const structureErrors = validateJSONStructure(parsedData, file.name);
        if (structureErrors.length > 0) {
          debugLog("JSON structure validation failed", structureErrors);
          if (onValidationError) {
            onValidationError(structureErrors, file.name);
          }
          safeSetState((prev) => ({
            ...prev,
            isProcessing: false,
            lastError: structureErrors.map((e) => e.message).join(", "),
          }));
          return;
        }
        // Update progress
        safeSetState((prev) => ({ ...prev, uploadProgress: 100 }));
        // Success - convert to HydroscopeData format
        const hydroscopeData: HydroscopeData = {
          nodes: parsedData.nodes || [],
          edges: parsedData.edges || [],
          hierarchyChoices: parsedData.hierarchyChoices || [],
          nodeAssignments: parsedData.nodeAssignments || {},
          nodeTypeConfig: parsedData.nodeTypeConfig,
          edgeStyleConfig: parsedData.edgeStyleConfig,
          legend: parsedData.legend,
          styles: parsedData.styles,
        };
        debugLog("File processed successfully", {
          nodeCount: hydroscopeData.nodes.length,
          edgeCount: hydroscopeData.edges.length,
          hierarchyChoicesCount: hydroscopeData.hierarchyChoices.length,
        });
        if (onFileLoaded) {
          onFileLoaded(hydroscopeData, file.name);
        }
        safeSetState((prev) => ({
          ...prev,
          isProcessing: false,
          lastSuccess: `Successfully loaded ${file.name}`,
          uploadProgress: 0,
        }));
      } catch (error) {
        const parseError: ParseError = {
          type: "processing_error",
          message: `File processing failed: ${error instanceof Error ? error.message : "Unknown error"}`,
          context: { filename: file.name },
        };
        debugLog("File processing failed", parseError);
        if (onParseError) {
          onParseError(parseError, file.name);
        }
        safeSetState((prev) => ({
          ...prev,
          isProcessing: false,
          lastError: parseError.message,
          uploadProgress: 0,
        }));
      }
    },
    [
      debugLog,
      validateFile,
      validateJSONStructure,
      onFileLoaded,
      onParseError,
      onValidationError,
      safeSetState,
    ],
  );
  // Handle file selection
  const handleFileSelect = useCallback(
    (files: FileList | null) => {
      if (!files || files.length === 0) return;
      const file = files[0];
      processFile(file);
    },
    [processFile],
  );
  // Handle drag events
  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      safeSetState((prev) => ({ ...prev, isDragOver: true }));
    },
    [safeSetState],
  );
  const handleDragLeave = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      safeSetState((prev) => ({ ...prev, isDragOver: false }));
    },
    [safeSetState],
  );
  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      safeSetState((prev) => ({ ...prev, isDragOver: false }));
      const files = e.dataTransfer.files;
      handleFileSelect(files);
    },
    [handleFileSelect, safeSetState],
  );
  // Handle click to open file dialog
  const handleClick = useCallback(() => {
    if (state.isProcessing) return;
    fileInputRef.current?.click();
  }, [state.isProcessing]);
  // Handle input change
  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      handleFileSelect(e.target.files);
    },
    [handleFileSelect],
  );
  return (
    <div className="hydroscope-file-upload">
      <div
        className={`upload-area ${state.isDragOver ? "drag-over" : ""} ${state.isProcessing ? "processing" : ""}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleClick}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handleClick();
          }
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={acceptedTypes.join(",")}
          onChange={handleInputChange}
          data-testid="file-input"
          style={{ display: "none" }}
          disabled={state.isProcessing}
        />

        <div className="upload-content">
          {state.isProcessing ? (
            <div className="processing-state">
              <div className="spinner" />
              <p>Processing file...</p>
              {state.uploadProgress > 0 && (
                <div className="progress-bar">
                  <div
                    className="progress-fill"
                    style={{ width: `${state.uploadProgress}%` }}
                  />
                </div>
              )}
            </div>
          ) : (
            <div className="idle-state">
              <div className="upload-icon">📁</div>
              <p className="primary-text">
                Drop a JSON file here or click to select
              </p>
              <p className="secondary-text">
                Supported formats: {acceptedTypes.join(", ")} • Max size:{" "}
                {Math.round(maxFileSize / 1024 / 1024)}MB
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Status messages */}
      {state.lastError && (
        <div className="status-message error" data-testid="status">
          <span className="status-icon">❌</span>
          <span className="status-text">{state.lastError}</span>
        </div>
      )}

      {state.lastSuccess && (
        <div className="status-message success" data-testid="status">
          <span className="status-icon">✅</span>
          <span className="status-text">{state.lastSuccess}</span>
        </div>
      )}

      {/* Generated file path display */}
      {generatedFilePath && (
        <div className="file-path-display">
          <p className="file-path-label">📄 Generated file ready to load:</p>
          <div className="file-path-container">
            <code className="file-path-code">{generatedFilePath}</code>
            <button
              className="copy-button"
              onClick={(e) => {
                e.stopPropagation();
                navigator.clipboard
                  .writeText(generatedFilePath)
                  .then(() => {
                    const btn = e.target as HTMLButtonElement;
                    const originalText = btn.textContent;
                    btn.textContent = "✓";
                    btn.style.background = "#4caf50";
                    setTimeout(() => {
                      btn.textContent = originalText;
                      btn.style.background = "#007acc";
                    }, 1000);
                  })
                  .catch((err) => {
                    console.error("Failed to copy to clipboard:", err);
                    alert("Failed to copy to clipboard");
                  });
              }}
              title="Copy path to clipboard"
            >
              ⧉
            </button>
          </div>
          <p className="file-path-hint">
            💡 Drag and drop this file here, or click to browse for it
          </p>
        </div>
      )}

      <style>{`
        .hydroscope-file-upload {
          width: 100%;
          max-width: 600px;
          margin: 0 auto;
        }

        .upload-area {
          border: 2px dashed #cbd5e0;
          border-radius: 8px;
          padding: 2rem;
          text-align: center;
          cursor: pointer;
          transition: all 0.2s ease;
          background: #f7fafc;
          min-height: 200px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .upload-area:hover {
          border-color: #4299e1;
          background: #ebf8ff;
        }

        .upload-area.drag-over {
          border-color: #3182ce;
          background: #bee3f8;
          transform: scale(1.02);
        }

        .upload-area.processing {
          cursor: not-allowed;
          opacity: 0.7;
        }

        .upload-content {
          width: 100%;
        }

        .idle-state .upload-icon {
          font-size: 3rem;
          margin-bottom: 1rem;
        }

        .idle-state .primary-text {
          font-size: 1.125rem;
          font-weight: 600;
          color: #2d3748;
          margin-bottom: 0.5rem;
        }

        .idle-state .secondary-text {
          font-size: 0.875rem;
          color: #718096;
        }

        .processing-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1rem;
        }

        .spinner {
          width: 2rem;
          height: 2rem;
          border: 3px solid #e2e8f0;
          border-top: 3px solid #4299e1;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        .progress-bar {
          width: 200px;
          height: 4px;
          background: #e2e8f0;
          border-radius: 2px;
          overflow: hidden;
        }

        .progress-fill {
          height: 100%;
          background: #4299e1;
          transition: width 0.3s ease;
        }

        .status-message {
          margin-top: 1rem;
          padding: 0.75rem 1rem;
          border-radius: 6px;
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.875rem;
        }

        .status-message.error {
          background: #fed7d7;
          color: #c53030;
          border: 1px solid #feb2b2;
        }

        .status-message.success {
          background: #c6f6d5;
          color: #22543d;
          border: 1px solid #9ae6b4;
        }

        .status-icon {
          flex-shrink: 0;
        }

        .status-text {
          flex: 1;
        }

        .file-path-display {
          margin-top: 1.5rem;
          padding: 1rem;
          border: 1px solid #e2e8f0;
          border-radius: 6px;
          background: #f7fafc;
        }

        .file-path-label {
          margin: 0 0 0.75rem 0;
          font-weight: 600;
          color: #2d3748;
          font-size: 0.875rem;
        }

        .file-path-container {
          position: relative;
          margin-bottom: 0.75rem;
        }

        .file-path-code {
          display: block;
          background: #e8f5e8;
          padding: 0.75rem 3rem 0.75rem 0.75rem;
          border-radius: 4px;
          font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
          color: #2e7d32;
          font-size: 0.8125rem;
          word-break: break-all;
          border: 1px solid #c8e6c9;
        }

        .copy-button {
          position: absolute;
          top: 50%;
          right: 0.5rem;
          transform: translateY(-50%);
          background: #007acc;
          color: white;
          border: none;
          border-radius: 4px;
          padding: 0.25rem 0.5rem;
          font-size: 0.75rem;
          cursor: pointer;
          transition: background 0.2s ease;
        }

        .copy-button:hover {
          background: #005999;
        }

        .file-path-hint {
          margin: 0;
          font-size: 0.75rem;
          color: #718096;
          font-style: italic;
        }
      `}</style>
    </div>
  );
};
export default FileUpload;
