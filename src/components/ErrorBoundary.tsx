/**
 * Error Boundary Component for Hydroscope
 *
 * Provides comprehensive error handling and recovery for the Hydroscope component
 * and its child components (InfoPanel, StyleTuner, etc.)
 */

import React, { Component, ErrorInfo, ReactNode } from "react";

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  errorId: string;
}

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: (
    error: Error,
    errorInfo: ErrorInfo,
    retry: () => void,
    reset: () => void,
  ) => ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  isolateErrors?: boolean; // Whether to isolate errors to prevent cascading failures
}

/**
 * Default error fallback component
 */
const DefaultErrorFallback: React.FC<{
  error: Error;
  errorInfo: ErrorInfo;
  onRetry: () => void;
  onReset: () => void;
}> = ({ error, errorInfo, onRetry, onReset }) => (
  <div
    style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      height: "100%",
      padding: "20px",
      backgroundColor: "#f8f9fa",
      border: "1px solid #e9ecef",
      borderRadius: "8px",
      textAlign: "center",
      maxWidth: "600px",
      margin: "0 auto",
    }}
  >
    <div
      style={{
        fontSize: "48px",
        marginBottom: "16px",
        color: "#dc3545",
      }}
    >
      ⚠️
    </div>
    <h3
      style={{
        margin: "0 0 8px 0",
        color: "#495057",
        fontSize: "18px",
        fontWeight: "600",
      }}
    >
      Something went wrong
    </h3>
    <p
      style={{
        margin: "0 0 16px 0",
        color: "#6c757d",
        fontSize: "14px",
        maxWidth: "400px",
        lineHeight: "1.4",
      }}
    >
      {error.message ||
        "An unexpected error occurred while rendering the visualization."}
    </p>

    {/* Show error details in development */}
    {process.env.NODE_ENV === "development" && (
      <details
        style={{
          marginBottom: "16px",
          padding: "8px",
          backgroundColor: "#f1f3f4",
          borderRadius: "4px",
          fontSize: "12px",
          fontFamily: "monospace",
          maxWidth: "500px",
          overflow: "auto",
        }}
      >
        <summary style={{ cursor: "pointer", marginBottom: "8px" }}>
          Error Details (Development)
        </summary>
        <pre style={{ margin: 0, whiteSpace: "pre-wrap" }}>
          {error.stack}
          {errorInfo.componentStack && (
            <>
              {"\n\nComponent Stack:"}
              {errorInfo.componentStack}
            </>
          )}
        </pre>
      </details>
    )}

    <div
      style={{
        display: "flex",
        gap: "8px",
        flexWrap: "wrap",
        justifyContent: "center",
      }}
    >
      <button
        onClick={onRetry}
        style={{
          padding: "8px 16px",
          backgroundColor: "#007bff",
          color: "white",
          border: "none",
          borderRadius: "4px",
          cursor: "pointer",
          fontSize: "14px",
          fontWeight: "500",
        }}
      >
        Try Again
      </button>
      <button
        onClick={onReset}
        style={{
          padding: "8px 16px",
          backgroundColor: "#6c757d",
          color: "white",
          border: "none",
          borderRadius: "4px",
          cursor: "pointer",
          fontSize: "14px",
          fontWeight: "500",
        }}
      >
        Reset Component
      </button>
    </div>
  </div>
);

/**
 * Error Boundary Class Component
 *
 * Catches JavaScript errors anywhere in the child component tree,
 * logs those errors, and displays a fallback UI.
 */
export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  private retryTimeoutId: NodeJS.Timeout | null = null;

  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: "",
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    // Update state so the next render will show the fallback UI
    return {
      hasError: true,
      error,
      errorId: `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log error details
    console.error("ErrorBoundary caught an error:", error);
    console.error("Error info:", errorInfo);

    // Update state with error info
    this.setState({
      errorInfo,
    });

    // Call custom error handler if provided
    if (this.props.onError) {
      try {
        this.props.onError(error, errorInfo);
      } catch (handlerError) {
        console.error("Error in custom error handler:", handlerError);
      }
    }

    // Report to error tracking service in production
    if (process.env.NODE_ENV === "production") {
      // This would typically integrate with services like Sentry, LogRocket, etc.
      this.reportError(error, errorInfo);
    }
  }

  componentWillUnmount() {
    // Clean up any pending retry timeouts
    if (this.retryTimeoutId) {
      clearTimeout(this.retryTimeoutId);
    }
  }

  private reportError = (error: Error, errorInfo: ErrorInfo) => {
    // In a real application, you would send this to your error tracking service
    const errorReport = {
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href,
      errorId: this.state.errorId,
    };

    // Example: Send to error tracking service
    // errorTrackingService.captureException(error, { extra: errorReport });

    console.warn(
      "Error report (would be sent to tracking service):",
      errorReport,
    );
  };

  private handleRetry = () => {
    // Clear any existing retry timeout
    if (this.retryTimeoutId) {
      clearTimeout(this.retryTimeoutId);
    }

    // Reset error state after a brief delay to allow for cleanup
    this.retryTimeoutId = setTimeout(() => {
      this.setState({
        hasError: false,
        error: null,
        errorInfo: null,
        errorId: "",
      });
    }, 100);
  };

  private handleReset = () => {
    // Immediately reset the error state
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: "",
    });

    // Force a complete re-render by updating the key
    // This is handled by the parent component if needed
  };

  render() {
    if (this.state.hasError && this.state.error && this.state.errorInfo) {
      // Render custom fallback UI if provided
      if (this.props.fallback) {
        try {
          return this.props.fallback(
            this.state.error,
            this.state.errorInfo,
            this.handleRetry,
            this.handleReset,
          );
        } catch (fallbackError) {
          console.error("Error in custom fallback component:", fallbackError);
          // Fall through to default fallback
        }
      }

      // Render default fallback UI
      return (
        <DefaultErrorFallback
          error={this.state.error}
          errorInfo={this.state.errorInfo}
          onRetry={this.handleRetry}
          onReset={this.handleReset}
        />
      );
    }

    // No error, render children normally
    return this.props.children;
  }
}

/**
 * Higher-order component for wrapping components with error boundaries
 */
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Omit<ErrorBoundaryProps, "children">,
) {
  const WrappedComponent = React.forwardRef<any, P>((props, ref) => (
    <ErrorBoundary {...errorBoundaryProps}>
      <Component {...(props as any)} ref={ref} />
    </ErrorBoundary>
  ));

  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`;

  return WrappedComponent;
}

/**
 * Hook for handling errors in functional components
 */
export function useErrorHandler() {
  const [error, setError] = React.useState<Error | null>(null);

  const resetError = React.useCallback(() => {
    setError(null);
  }, []);

  const captureError = React.useCallback((error: Error) => {
    console.error("useErrorHandler caught error:", error);
    setError(error);
  }, []);

  // Throw error to be caught by error boundary
  if (error) {
    throw error;
  }

  return { captureError, resetError };
}

export default ErrorBoundary;
