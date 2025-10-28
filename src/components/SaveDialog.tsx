/**
 * SaveDialog - Modal dialog for choosing export format
 *
 * A proper React component that replaces DOM manipulation,
 * preventing memory leaks and following React best practices.
 */

import React, { useState, useCallback, useEffect } from "react";
import type { CSSProperties } from "react";

export type SaveFormat = "png" | "json";

export interface SaveDialogProps {
  /** Whether the dialog is open */
  isOpen: boolean;
  /** Callback when user cancels */
  onClose: () => void;
  /** Callback when user confirms save with chosen format */
  onSave: (format: SaveFormat) => void;
  /** Default format selection */
  defaultFormat?: SaveFormat;
}

// Modal overlay style
const overlayStyle: CSSProperties = {
  position: "fixed",
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  background: "rgba(0, 0, 0, 0.5)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 10000,
};

// Dialog container style
const dialogStyle: CSSProperties = {
  background: "white",
  padding: "24px",
  borderRadius: "8px",
  boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
  minWidth: "300px",
};

// Dialog title style
const titleStyle: CSSProperties = {
  margin: "0 0 16px 0",
  fontSize: "16px",
  fontWeight: 600,
};

// Form group style
const formGroupStyle: CSSProperties = {
  marginBottom: "16px",
};

// Label style
const labelStyle: CSSProperties = {
  display: "block",
  marginBottom: "8px",
  fontSize: "14px",
};

// Select style
const selectStyle: CSSProperties = {
  width: "100%",
  padding: "8px",
  border: "1px solid #d9d9d9",
  borderRadius: "4px",
  fontSize: "14px",
};

// Button container style
const buttonContainerStyle: CSSProperties = {
  display: "flex",
  gap: "8px",
  justifyContent: "flex-end",
};

// Cancel button style
const cancelButtonStyle: CSSProperties = {
  padding: "8px 16px",
  border: "1px solid #d9d9d9",
  borderRadius: "4px",
  background: "white",
  cursor: "pointer",
  fontSize: "14px",
};

// Save button style
const saveButtonStyle: CSSProperties = {
  padding: "8px 16px",
  border: "none",
  borderRadius: "4px",
  background: "#1890ff",
  color: "white",
  cursor: "pointer",
  fontSize: "14px",
};

/**
 * SaveDialog component
 */
export const SaveDialog: React.FC<SaveDialogProps> = ({
  isOpen,
  onClose,
  onSave,
  defaultFormat = "png",
}) => {
  const [selectedFormat, setSelectedFormat] =
    useState<SaveFormat>(defaultFormat);

  // Handle escape key to close dialog
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  // Handle overlay click
  const handleOverlayClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      // Only close if clicking the overlay itself, not the dialog
      if (e.target === e.currentTarget) {
        onClose();
      }
    },
    [onClose],
  );

  // Handle save button
  const handleSave = useCallback(() => {
    onSave(selectedFormat);
  }, [selectedFormat, onSave]);

  if (!isOpen) return null;

  return (
    <div style={overlayStyle} onClick={handleOverlayClick}>
      <div style={dialogStyle}>
        <h3 style={titleStyle}>Export Visualization</h3>
        <div style={formGroupStyle}>
          <label style={labelStyle} htmlFor="format-select">
            Choose format:
          </label>
          <select
            id="format-select"
            style={selectStyle}
            value={selectedFormat}
            onChange={(e) => setSelectedFormat(e.target.value as SaveFormat)}
          >
            <option value="png">PNG (Image)</option>
            <option value="json">JSON (Data)</option>
          </select>
        </div>
        <div style={buttonContainerStyle}>
          <button style={cancelButtonStyle} onClick={onClose}>
            Cancel
          </button>
          <button style={saveButtonStyle} onClick={handleSave}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
};
