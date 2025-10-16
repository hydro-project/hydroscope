/**
 * @fileoverview Tests for PopupNode component
 */
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { PopupNode } from "../../render/PopupNode";
import type { NodeProps } from "@xyflow/react";

describe("PopupNode", () => {
  const mockOnClose = vi.fn();

  const defaultProps: NodeProps = {
    id: "popup-test-node",
    type: "popup",
    data: {
      label:
        "This is a much longer label that should be displayed in the popup",
      longLabel:
        "This is a much longer label that should be displayed in the popup",
      originalNodeType: "standard",
      onClose: mockOnClose,
    },
    xPos: 100,
    yPos: 100,
    zIndex: 1000,
    isConnectable: false,
    selected: false,
    dragging: false,
  };

  beforeEach(() => {
    mockOnClose.mockClear();
  });

  it("should render popup with long label", () => {
    render(<PopupNode {...defaultProps} />);

    expect(
      screen.getByText(
        "This is a much longer label that should be displayed in the popup",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Close popup" }),
    ).toBeInTheDocument();
  });

  it("should call onClose when close button is clicked", () => {
    render(<PopupNode {...defaultProps} />);

    const closeButton = screen.getByRole("button", { name: "Close popup" });
    fireEvent.click(closeButton);

    expect(mockOnClose).toHaveBeenCalledTimes(1);
    expect(mockOnClose).toHaveBeenCalledWith("popup-test-node");
  });

  it("should have floating shadow styling", () => {
    render(<PopupNode {...defaultProps} />);

    const popup = screen.getByText(
      "This is a much longer label that should be displayed in the popup",
    ).parentElement;

    // Check that shadow and z-index are applied
    const style = window.getComputedStyle(popup!);
    expect(style.boxShadow).toContain("rgba");
    expect(style.zIndex).toBe("1000");
  });

  it("should use node colors for styling", () => {
    render(<PopupNode {...defaultProps} />);

    const popup = screen.getByText(
      "This is a much longer label that should be displayed in the popup",
    ).parentElement;

    // Check that colors and border are applied via inline styles
    expect(popup).toBeDefined();
    expect(popup!.style.backgroundColor).toBeTruthy();
    expect(popup!.style.border).toContain("solid");
    expect(popup!.style.borderRadius).toBe("12px");
  });

  it("should display fallback label when longLabel is not provided", () => {
    const propsWithoutLongLabel = {
      ...defaultProps,
      data: {
        ...defaultProps.data,
        longLabel: undefined,
        label: "Fallback Label",
      },
    };

    render(<PopupNode {...propsWithoutLongLabel} />);

    expect(screen.getByText("Fallback Label")).toBeInTheDocument();
  });

  it("should use original node type for color generation", () => {
    const propsWithDifferentType = {
      ...defaultProps,
      data: {
        ...defaultProps.data,
        originalNodeType: "service",
      },
    };

    render(<PopupNode {...propsWithDifferentType} />);

    // The component should render without errors and use the service type for colors
    expect(
      screen.getByText(
        "This is a much longer label that should be displayed in the popup",
      ),
    ).toBeInTheDocument();
  });

  it("should stop propagation when close button is clicked", () => {
    const mockParentClick = vi.fn();

    render(
      <div onClick={mockParentClick}>
        <PopupNode {...defaultProps} />
      </div>,
    );

    const closeButton = screen.getByRole("button", { name: "Close popup" });
    fireEvent.click(closeButton);

    // Parent click should not be called due to stopPropagation
    expect(mockParentClick).not.toHaveBeenCalled();
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });
});
