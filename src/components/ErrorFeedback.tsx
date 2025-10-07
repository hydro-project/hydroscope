/**
 * ErrorFeedback - User feedback component for error handling and recovery
 * Displays error messages, warnings, and retry options with accessibility support
 */

import React, { useState, useEffect, useCallback } from "react";
import { Alert, Button, Space, Typography } from "antd";
import {
  ExclamationCircleOutlined,
  ReloadOutlined,
  CloseOutlined,
} from "@ant-design/icons";
import type { UserFeedbackOptions } from "../core/ErrorHandler.js";

const { Text } = Typography;

export interface ErrorFeedbackProps {
  feedback: UserFeedbackOptions | null;
  onDismiss?: () => void;
  onRetry?: () => void;
  className?: string;
  style?: React.CSSProperties;
}

export const ErrorFeedback: React.FC<ErrorFeedbackProps> = ({
  feedback,
  onDismiss,
  onRetry,
  className,
  style,
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);

  // Show/hide feedback based on prop changes
  useEffect(() => {
    if (feedback) {
      setIsVisible(true);

      // Auto-dismiss after duration if specified
      if (feedback.duration && feedback.duration > 0) {
        const timer = setTimeout(() => {
          handleDismiss();
        }, feedback.duration);

        return () => clearTimeout(timer);
      }
    } else {
      setIsVisible(false);
    }
  }, [feedback]);

  const handleDismiss = useCallback(() => {
    setIsVisible(false);
    onDismiss?.();
  }, [onDismiss]);

  const handleRetry = useCallback(async () => {
    if (!feedback?.retryAction) return;

    setIsRetrying(true);
    try {
      await feedback.retryAction();
      // Success - dismiss the feedback
      handleDismiss();
    } catch (error) {
      console.error("[ErrorFeedback] Retry failed:", error);
      // Keep the feedback visible on retry failure
    } finally {
      setIsRetrying(false);
    }
  }, [feedback, handleDismiss]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === "Escape" && feedback?.dismissible) {
        handleDismiss();
      } else if (event.key === "Enter" && feedback?.retryAction) {
        handleRetry();
      }
    },
    [feedback, handleDismiss, handleRetry],
  );

  if (!feedback || !isVisible) {
    return null;
  }

  const alertType =
    feedback.type === "error"
      ? "error"
      : feedback.type === "warning"
        ? "warning"
        : "info";

  const icon =
    feedback.type === "error" ? <ExclamationCircleOutlined /> : undefined;

  const action = (
    <Space>
      {feedback.retryAction && (
        <Button
          type="primary"
          size="small"
          icon={<ReloadOutlined />}
          loading={isRetrying}
          onClick={handleRetry}
          aria-label="Retry operation"
        >
          Retry
        </Button>
      )}
      {feedback.dismissible && (
        <Button
          type="text"
          size="small"
          icon={<CloseOutlined />}
          onClick={handleDismiss}
          aria-label="Dismiss notification"
        />
      )}
    </Space>
  );

  return (
    <div
      className={className}
      style={{
        position: "fixed",
        top: 16,
        right: 16,
        zIndex: 1000,
        maxWidth: 400,
        ...style,
      }}
      onKeyDown={handleKeyDown}
      tabIndex={-1}
      role="alert"
      aria-live="polite"
      aria-atomic="true"
    >
      <Alert
        type={alertType}
        message={
          <Text strong>
            {feedback.type === "error"
              ? "Error"
              : feedback.type === "warning"
                ? "Warning"
                : "Information"}
          </Text>
        }
        description={feedback.message}
        icon={icon}
        action={action}
        closable={false} // We handle closing with our custom button
        showIcon
        style={{
          boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
          border: `1px solid ${
            feedback.type === "error"
              ? "#ff4d4f"
              : feedback.type === "warning"
                ? "#faad14"
                : "#1890ff"
          }`,
        }}
      />
    </div>
  );
};

/**
 * Hook for managing error feedback state
 */
export const useErrorFeedback = () => {
  const [feedback, setFeedback] = useState<UserFeedbackOptions | null>(null);

  const showFeedback = useCallback((options: UserFeedbackOptions) => {
    setFeedback(options);
  }, []);

  const dismissFeedback = useCallback(() => {
    setFeedback(null);
  }, []);

  const retryLastOperation = useCallback(() => {
    if (feedback?.retryAction) {
      return feedback.retryAction();
    }
  }, [feedback]);

  return {
    feedback,
    showFeedback,
    dismissFeedback,
    retryLastOperation,
  };
};

export default ErrorFeedback;
