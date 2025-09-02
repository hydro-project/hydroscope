/**
 * Paxos.json Performance Analysis Utility
 *
 * Specific analysis tools for the paxos.json file that's experiencing slowness.
 * Provides detailed breakdowns and recommendations.
 */

import { PerformanceProfiler } from './PerformanceProfiler';

export interface PaxosAnalysisResult {
  fileStats: {
    size: number;
    nodeCount: number;
    edgeCount: number;
    avgNodeSize: number;
    avgEdgeSize: number;
  };
  performanceMetrics: {
    loadTime: number;
    parseTime: number;
    renderTime: number;
    totalTime: number;
  };
  bottlenecks: string[];
  optimizationSuggestions: string[];
}

export class PaxosPerformanceAnalyzer {
  private profiler = PerformanceProfiler.getInstance();

  async analyzePaxosFile(fileData: any): Promise<PaxosAnalysisResult> {
    console.log('🔍 Starting Paxos.json performance analysis...');

    this.profiler.reset();

    // Analyze file structure
    const fileStats = PerformanceProfiler.profile('File Structure Analysis', () => {
      const jsonStr = JSON.stringify(fileData);
      const size = new Blob([jsonStr]).size;
      const nodeCount = fileData.nodes?.length || 0;
      const edgeCount = fileData.edges?.length || 0;

      const avgNodeSize = nodeCount > 0 ? size / nodeCount : 0;
      const avgEdgeSize = edgeCount > 0 ? JSON.stringify(fileData.edges).length / edgeCount : 0;

      return {
        size,
        nodeCount,
        edgeCount,
        avgNodeSize,
        avgEdgeSize,
      };
    });

    // Analyze node complexity
    const nodeComplexity = PerformanceProfiler.profile('Node Complexity Analysis', () => {
      if (!fileData.nodes) return { complexity: 'low', avgDepth: 0 };

      let totalDepth = 0;
      let maxDepth = 0;

      fileData.nodes.forEach((node: any) => {
        const depth = this.calculateObjectDepth(node);
        totalDepth += depth;
        maxDepth = Math.max(maxDepth, depth);
      });

      const avgDepth = totalDepth / fileData.nodes.length;
      const complexity = avgDepth > 10 ? 'high' : avgDepth > 5 ? 'medium' : 'low';

      return { complexity, avgDepth, maxDepth };
    });

    // Analyze edge complexity
    const edgeComplexity = PerformanceProfiler.profile('Edge Complexity Analysis', () => {
      if (!fileData.edges) return { complexity: 'low', avgProperties: 0 };

      let totalProperties = 0;

      fileData.edges.forEach((edge: any) => {
        totalProperties += Object.keys(edge).length;
      });

      const avgProperties = totalProperties / fileData.edges.length;
      const complexity = avgProperties > 10 ? 'high' : avgProperties > 5 ? 'medium' : 'low';

      return { complexity, avgProperties };
    });

    // Analyze hierarchies
    const hierarchyComplexity = PerformanceProfiler.profile('Hierarchy Analysis', () => {
      const hasHierarchies = !!(fileData.hierarchyChoices && fileData.hierarchyChoices.length > 0);
      const hierarchyCount = fileData.hierarchyChoices?.length || 0;

      let maxHierarchyDepth = 0;
      if (hasHierarchies) {
        fileData.hierarchyChoices.forEach((hierarchy: any) => {
          const depth = this.calculateHierarchyDepth(hierarchy);
          maxHierarchyDepth = Math.max(maxHierarchyDepth, depth);
        });
      }

      return { hasHierarchies, hierarchyCount, maxHierarchyDepth };
    });

    // Generate analysis report
    const report = this.profiler.generateReport();

    // Identify bottlenecks
    const bottlenecks = this.identifyBottlenecks(
      fileStats,
      nodeComplexity,
      edgeComplexity,
      hierarchyComplexity,
      report
    );

    // Generate optimization suggestions
    const optimizationSuggestions = this.generateOptimizationSuggestions(
      fileStats,
      nodeComplexity,
      edgeComplexity,
      hierarchyComplexity
    );

    const result: PaxosAnalysisResult = {
      fileStats,
      performanceMetrics: {
        loadTime: report.stages['File Structure Analysis']?.duration || 0,
        parseTime: report.stages['Node Complexity Analysis']?.duration || 0,
        renderTime: report.stages['Edge Complexity Analysis']?.duration || 0,
        totalTime: report.totalDuration,
      },
      bottlenecks,
      optimizationSuggestions,
    };

    this.printPaxosAnalysisReport(result, nodeComplexity, edgeComplexity, hierarchyComplexity);

    return result;
  }

  private calculateObjectDepth(obj: any, visited = new Set()): number {
    if (obj === null || typeof obj !== 'object' || visited.has(obj)) {
      return 0;
    }

    visited.add(obj);

    let maxDepth = 0;
    for (const value of Object.values(obj)) {
      if (typeof value === 'object' && value !== null) {
        maxDepth = Math.max(maxDepth, this.calculateObjectDepth(value, visited));
      }
    }

    visited.delete(obj);
    return maxDepth + 1;
  }

  private calculateHierarchyDepth(hierarchy: any): number {
    if (!hierarchy.children || hierarchy.children.length === 0) {
      return 1;
    }

    let maxChildDepth = 0;
    hierarchy.children.forEach((child: any) => {
      maxChildDepth = Math.max(maxChildDepth, this.calculateHierarchyDepth(child));
    });

    return maxChildDepth + 1;
  }

  private identifyBottlenecks(
    fileStats: any,
    nodeComplexity: any,
    edgeComplexity: any,
    hierarchyComplexity: any,
    report: any
  ): string[] {
    const bottlenecks: string[] = [];

    // File size bottlenecks
    if (fileStats.size > 1024 * 1024) {
      // 1MB
      bottlenecks.push(`Large file size: ${(fileStats.size / (1024 * 1024)).toFixed(1)}MB`);
    }

    // Node complexity bottlenecks
    if (nodeComplexity.avgDepth > 10) {
      bottlenecks.push(`High node complexity: avg depth ${nodeComplexity.avgDepth.toFixed(1)}`);
    }

    // Edge complexity bottlenecks
    if (edgeComplexity.avgProperties > 8) {
      bottlenecks.push(
        `Complex edges: avg ${edgeComplexity.avgProperties.toFixed(1)} properties per edge`
      );
    }

    // Hierarchy bottlenecks
    if (hierarchyComplexity.maxHierarchyDepth > 5) {
      bottlenecks.push(`Deep hierarchies: max depth ${hierarchyComplexity.maxHierarchyDepth}`);
    }

    // Performance bottlenecks from timing
    Object.entries(report.stages).forEach(([stage, metrics]: [string, any]) => {
      if (metrics.duration > 1000) {
        // 1 second
        bottlenecks.push(`Slow ${stage}: ${metrics.duration.toFixed(0)}ms`);
      }
    });

    return bottlenecks;
  }

  private generateOptimizationSuggestions(
    fileStats: any,
    nodeComplexity: any,
    edgeComplexity: any,
    hierarchyComplexity: any
  ): string[] {
    const suggestions: string[] = [];

    // File size optimizations
    if (fileStats.size > 500 * 1024) {
      // 500KB
      suggestions.push('Consider data compression or removing unnecessary fields');
    }

    // Node optimizations
    if (nodeComplexity.avgDepth > 8) {
      suggestions.push('Flatten node data structure to reduce parsing complexity');
    }

    if (fileStats.avgNodeSize > 1000) {
      // 1KB average node size
      suggestions.push('Reduce node data payload size by moving large data to separate fields');
    }

    // Edge optimizations
    if (edgeComplexity.avgProperties > 6) {
      suggestions.push('Simplify edge properties to essential data only');
    }

    // Hierarchy optimizations
    if (hierarchyComplexity.maxHierarchyDepth > 4) {
      suggestions.push('Consider flattening deep hierarchies or using lazy loading');
    }

    // Performance optimizations
    if (fileStats.nodeCount > 1000) {
      suggestions.push('Consider implementing progressive rendering for large node counts');
    }

    if (fileStats.edgeCount > 1000) {
      suggestions.push('Consider edge clustering or virtualization for large edge counts');
    }

    return suggestions;
  }

  private printPaxosAnalysisReport(
    result: PaxosAnalysisResult,
    nodeComplexity: any,
    edgeComplexity: any,
    hierarchyComplexity: any
  ): void {
    console.group('📊 Paxos.json Performance Analysis Report');

    console.group('📁 File Statistics');
    console.log(`File size: ${(result.fileStats.size / 1024).toFixed(1)}KB`);
    console.log(`Nodes: ${result.fileStats.nodeCount}`);
    console.log(`Edges: ${result.fileStats.edgeCount}`);
    console.log(`Avg node size: ${result.fileStats.avgNodeSize.toFixed(0)} bytes`);
    console.log(`Avg edge size: ${result.fileStats.avgEdgeSize.toFixed(0)} bytes`);
    console.groupEnd();

    console.group('🧬 Complexity Analysis');
    console.log(
      `Node complexity: ${nodeComplexity.complexity} (avg depth: ${nodeComplexity.avgDepth.toFixed(1)})`
    );
    console.log(
      `Edge complexity: ${edgeComplexity.complexity} (avg properties: ${edgeComplexity.avgProperties.toFixed(1)})`
    );
    console.log(
      `Hierarchies: ${hierarchyComplexity.hierarchyCount} (max depth: ${hierarchyComplexity.maxHierarchyDepth})`
    );
    console.groupEnd();

    if (result.bottlenecks.length > 0) {
      console.group('🚨 Identified Bottlenecks');
      result.bottlenecks.forEach(bottleneck => console.log(`• ${bottleneck}`));
      console.groupEnd();
    }

    if (result.optimizationSuggestions.length > 0) {
      console.group('💡 Optimization Suggestions');
      result.optimizationSuggestions.forEach(suggestion => console.log(`• ${suggestion}`));
      console.groupEnd();
    }

    console.groupEnd();
  }

  // Static method for easy access
  static async analyzePaxosFile(fileData: any): Promise<PaxosAnalysisResult> {
    const analyzer = new PaxosPerformanceAnalyzer();
    return analyzer.analyzePaxosFile(fileData);
  }
}

// Browser console helper
if (typeof window !== 'undefined') {
  (window as any).PaxosPerformanceAnalyzer = PaxosPerformanceAnalyzer;
}

export default PaxosPerformanceAnalyzer;
