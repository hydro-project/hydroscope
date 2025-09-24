/**
 * Test setup file for React component tests
 */

import '@testing-library/jest-dom';

// Extend expect with jest-dom matchers
declare global {
  namespace Vi {
    interface JestAssertion<T = any> extends jest.Matchers<void, T> {}
  }
}