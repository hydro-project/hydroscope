/**
 * Spinner - Consistent loading spinner component used across Hydroscope
 */
import React from "react";

export interface SpinnerProps {
  size?: number; // Size in pixels, default 40
  borderWidth?: number; // Border width in pixels, default 4
  color?: string; // Spinner color, default #3b82f6 (blue)
  backgroundColor?: string; // Background color, default #f3f3f3 (light gray)
}

export const Spinner: React.FC<SpinnerProps> = ({
  size = 40,
  borderWidth = 4,
  color = "#3b82f6",
  backgroundColor = "#f3f3f3",
}) => {
  return (
    <>
      <div
        style={{
          width: size,
          height: size,
          border: `${borderWidth}px solid ${backgroundColor}`,
          borderTop: `${borderWidth}px solid ${color}`,
          borderRadius: "50%",
          animation: "hydroscope-spin 1s linear infinite",
        }}
      />
      <style>
        {`
          @keyframes hydroscope-spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}
      </style>
    </>
  );
};
