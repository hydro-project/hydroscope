/**
 * Test setup file for React component tests
 */

import "@testing-library/jest-dom";

// Extend expect with jest-dom matchers
declare global {
  interface CustomMatchers<R = unknown> {
    toBeInTheDocument(): R;
    toHaveClass(className: string): R;
    toHaveTextContent(text: string): R;
  }
}
