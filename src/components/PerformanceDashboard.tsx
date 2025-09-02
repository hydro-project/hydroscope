/**
 * Performance Dashboard Component
 *
 * Real-time performance monitoring dashboard for Hydroscope.
 * Shows timing breakdowns, memory usage, and performance recommendations.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Card, Button, Progress, Alert, Descriptions, Statistic, Space, Collapse } from 'antd';
import {
  ClockCircleOutlined,
  DashboardOutlined,
  WarningOutlined,
  CheckCircleOutlined,
  ReloadOutlined,
  BugOutlined,
} from '@ant-design/icons';
import { PerformanceProfiler, type ProfilerReport } from '../utils/PerformanceProfiler';

interface PerformanceDashboardProps {
  visible?: boolean;
  onClose?: () => void;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

const { Panel } = Collapse;

export const PerformanceDashboard: React.FC<PerformanceDashboardProps> = ({
  visible = false,
  onClose,
  autoRefresh = true,
  refreshInterval = 2000,
}) => {
  const [report, setReport] = useState<ProfilerReport | null>(null);
  const [loading, setLoading] = useState(false);

  const refreshReport = useCallback(() => {
    setLoading(true);
    try {
      const profiler = PerformanceProfiler.getInstance();
      const newReport = profiler.generateReport();
      setReport(newReport);
    } catch (error) {
      console.error('Failed to generate performance report:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Auto-refresh effect
  useEffect(() => {
    if (!visible || !autoRefresh) return;

    refreshReport(); // Initial load

    const interval = setInterval(refreshReport, refreshInterval);
    return () => clearInterval(interval);
  }, [visible, autoRefresh, refreshInterval, refreshReport]);

  // Manual refresh
  const handleRefresh = useCallback(() => {
    refreshReport();
  }, [refreshReport]);

  if (!visible) return null;

  const formatDuration = (ms: number): string => {
    if (ms < 1000) return `${ms.toFixed(0)}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  const formatMemory = (bytes: number): string => {
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(1)}MB`;
  };

  const getPerformanceColor = (
    duration: number,
    thresholds: { warning: number; error: number }
  ) => {
    if (duration > thresholds.error) return '#ff4d4f';
    if (duration > thresholds.warning) return '#faad14';
    return '#52c41a';
  };

  const renderStageBreakdown = () => {
    if (!report || Object.keys(report.stages).length === 0) {
      return (
        <Alert
          message="No performance data available"
          description="Load a file to see performance metrics"
          type="info"
          showIcon
        />
      );
    }

    const sortedStages = Object.entries(report.stages).sort(
      ([, a], [, b]) => b.duration - a.duration
    );

    return (
      <Space direction="vertical" style={{ width: '100%' }}>
        {sortedStages.map(([stageName, metrics]) => {
          const percentage = (metrics.duration / report.totalDuration) * 100;
          const thresholds = {
            'File Loading': { warning: 1000, error: 3000 },
            'JSON Parsing': { warning: 2000, error: 5000 },
            'State Creation': { warning: 3000, error: 7000 },
            'Layout Calculation': { warning: 3000, error: 10000 },
            Rendering: { warning: 2000, error: 8000 },
          };

          const stageThresholds = thresholds[stageName as keyof typeof thresholds] || {
            warning: 1000,
            error: 3000,
          };
          const color = getPerformanceColor(metrics.duration, stageThresholds);

          return (
            <Card key={stageName} size="small">
              <Statistic
                title={stageName}
                value={formatDuration(metrics.duration)}
                suffix={`(${percentage.toFixed(1)}%)`}
                valueStyle={{ color }}
                prefix={<ClockCircleOutlined />}
              />
              {metrics.metadata && (
                <Descriptions size="small" column={2} style={{ marginTop: 8 }}>
                  {Object.entries(metrics.metadata).map(([key, value]) => (
                    <Descriptions.Item key={key} label={key}>
                      {String(value)}
                    </Descriptions.Item>
                  ))}
                </Descriptions>
              )}
              <Progress
                percent={percentage}
                strokeColor={color}
                showInfo={false}
                size="small"
                style={{ marginTop: 8 }}
              />
            </Card>
          );
        })}
      </Space>
    );
  };

  const renderRecommendations = () => {
    if (!report || report.recommendations.length === 0) {
      return (
        <Alert
          message="No performance issues detected"
          type="success"
          icon={<CheckCircleOutlined />}
          showIcon
        />
      );
    }

    return (
      <Space direction="vertical" style={{ width: '100%' }}>
        {report.recommendations.map((rec, index) => (
          <Alert key={index} message={rec} type="warning" icon={<WarningOutlined />} showIcon />
        ))}
      </Space>
    );
  };

  const renderMemoryUsage = () => {
    if (!report || !report.memoryPeak) {
      return <Alert message="Memory tracking not available" type="info" showIcon />;
    }

    const memoryMB = report.memoryPeak / (1024 * 1024);
    const isHighMemory = memoryMB > 500; // 500MB threshold

    return (
      <Statistic
        title="Peak Memory Usage"
        value={formatMemory(report.memoryPeak)}
        valueStyle={{ color: isHighMemory ? '#ff4d4f' : '#52c41a' }}
        prefix={<DashboardOutlined />}
      />
    );
  };

  return (
    <Card
      title="Performance Dashboard"
      extra={
        <Space>
          <Button icon={<ReloadOutlined />} onClick={handleRefresh} loading={loading} size="small">
            Refresh
          </Button>
          {onClose && (
            <Button onClick={onClose} size="small">
              Close
            </Button>
          )}
        </Space>
      }
      style={{
        position: 'fixed',
        top: 20,
        right: 20,
        width: 400,
        maxHeight: '80vh',
        overflow: 'auto',
        zIndex: 1000,
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
      }}
    >
      {report && (
        <Space direction="vertical" style={{ width: '100%', marginBottom: 16 }}>
          <Statistic
            title="Total Duration"
            value={formatDuration(report.totalDuration)}
            valueStyle={{
              color: getPerformanceColor(report.totalDuration, { warning: 5000, error: 15000 }),
            }}
            prefix={<ClockCircleOutlined />}
          />
          {renderMemoryUsage()}
        </Space>
      )}

      <Collapse defaultActiveKey={['stages', 'recommendations']}>
        <Panel header="Stage Breakdown" key="stages">
          {renderStageBreakdown()}
        </Panel>

        <Panel header="Recommendations" key="recommendations">
          {renderRecommendations()}
        </Panel>

        <Panel header="Configuration" key="config">
          <Space direction="vertical" style={{ width: '100%' }}>
            <label>
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={e => {
                  // This would need to be passed up to parent component
                  console.log('Auto-refresh toggled:', e.target.checked);
                }}
              />{' '}
              Auto-refresh
            </label>

            <Alert
              message="Performance Tips"
              description={
                <ul style={{ margin: 0, paddingLeft: 20 }}>
                  <li>Files over 1MB will trigger detailed profiling</li>
                  <li>Check browser dev tools for additional memory insights</li>
                  <li>Consider data optimization for files with {'>'}10k nodes</li>
                </ul>
              }
              type="info"
              showIcon
            />
          </Space>
        </Panel>
      </Collapse>
    </Card>
  );
};

export default PerformanceDashboard;
