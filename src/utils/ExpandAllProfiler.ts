/**
 * ExpandAll Performance Profiler
 * 
 * Provides granular profiling for expandAll operations to identify
 * specific bottlenecks in the container expansion process.
 */

interface ExpandAllProfile {
  totalTime: number;
  stages: {
    containerDiscovery: number;
    expansionLoop: number;
    individualExpansions: Array<{
      containerId: string;
      time: number;
      childCount: number;
      leafNodeCount: number;
    }>;
    validation: number;
    layoutTrigger: number;
  };
  containerStats: {
    totalContainers: number;
    collapsedContainers: number;
    averageChildCount: number;
    maxChildCount: number;
    totalLeafNodes: number;
  };
  memoryUsage?: {
    start: number;
    end: number;
    delta: number;
  };
}

export class ExpandAllProfiler {
  private static instance: ExpandAllProfiler | null = null;
  private startTime: number = 0;
  private stageStartTime: number = 0;
  private currentProfile: Partial<ExpandAllProfile> = {};
  private isActive: boolean = false;

  static getInstance(): ExpandAllProfiler {
    if (!ExpandAllProfiler.instance) {
      ExpandAllProfiler.instance = new ExpandAllProfiler();
    }
    return ExpandAllProfiler.instance;
  }

  startProfiling(): void {
    this.isActive = true;
    this.startTime = performance.now();
    this.currentProfile = {
      stages: {
        containerDiscovery: 0,
        expansionLoop: 0,
        individualExpansions: [],
        validation: 0,
        layoutTrigger: 0,
      },
      containerStats: {
        totalContainers: 0,
        collapsedContainers: 0,
        averageChildCount: 0,
        maxChildCount: 0,
        totalLeafNodes: 0,
      },
    };

    // Capture initial memory if available
    if (typeof performance !== 'undefined' && (performance as any).memory) {
      const memory = (performance as any).memory;
      this.currentProfile.memoryUsage = {
        start: memory.usedJSHeapSize || 0,
        end: 0,
        delta: 0,
      };
    }

    console.log('[ExpandAllProfiler] Started profiling expandAll operation');
  }

  startStage(stageName: keyof ExpandAllProfile['stages']): void {
    if (!this.isActive) return;
    this.stageStartTime = performance.now();
    console.log(`[ExpandAllProfiler] Starting stage: ${stageName}`);
  }

  endStage(stageName: keyof ExpandAllProfile['stages']): void {
    if (!this.isActive || !this.currentProfile.stages) return;
    
    const stageTime = performance.now() - this.stageStartTime;
    
    if (stageName === 'individualExpansions') {
      // This stage tracks individual expansions separately
      return;
    }
    
    (this.currentProfile.stages as any)[stageName] = stageTime;
    console.log(`[ExpandAllProfiler] Completed stage: ${stageName} (${stageTime.toFixed(2)}ms)`);
  }

  profileContainerExpansion(
    containerId: string, 
    childCount: number, 
    leafNodeCount: number, 
    expansionTime: number
  ): void {
    if (!this.isActive || !this.currentProfile.stages) return;

    this.currentProfile.stages.individualExpansions.push({
      containerId,
      time: expansionTime,
      childCount,
      leafNodeCount,
    });

    console.log(
      `[ExpandAllProfiler] Expanded container ${containerId}: ${expansionTime.toFixed(2)}ms ` +
      `(${childCount} children, ${leafNodeCount} leaf nodes)`
    );
  }

  setContainerStats(stats: ExpandAllProfile['containerStats']): void {
    if (!this.isActive) return;
    this.currentProfile.containerStats = stats;
  }

  endProfiling(): ExpandAllProfile {
    if (!this.isActive) {
      throw new Error('ExpandAllProfiler: Cannot end profiling - profiler not active');
    }

    const totalTime = performance.now() - this.startTime;
    
    // Capture final memory if available
    if (this.currentProfile.memoryUsage && typeof performance !== 'undefined' && (performance as any).memory) {
      const memory = (performance as any).memory;
      this.currentProfile.memoryUsage.end = memory.usedJSHeapSize || 0;
      this.currentProfile.memoryUsage.delta = 
        this.currentProfile.memoryUsage.end - this.currentProfile.memoryUsage.start;
    }

    const profile: ExpandAllProfile = {
      totalTime,
      stages: this.currentProfile.stages || {
        containerDiscovery: 0,
        expansionLoop: 0,
        individualExpansions: [],
        validation: 0,
        layoutTrigger: 0,
      },
      containerStats: this.currentProfile.containerStats || {
        totalContainers: 0,
        collapsedContainers: 0,
        averageChildCount: 0,
        maxChildCount: 0,
        totalLeafNodes: 0,
      },
      memoryUsage: this.currentProfile.memoryUsage,
    };

    this.isActive = false;
    this.logProfile(profile);
    return profile;
  }

  private logProfile(profile: ExpandAllProfile): void {
    console.group('🔍 ExpandAll Performance Profile');
    
    console.log(`⏱️  Total Time: ${profile.totalTime.toFixed(2)}ms`);
    
    console.group('📊 Stage Breakdown:');
    console.log(`Container Discovery: ${profile.stages.containerDiscovery.toFixed(2)}ms`);
    console.log(`Expansion Loop: ${profile.stages.expansionLoop.toFixed(2)}ms`);
    console.log(`Validation: ${profile.stages.validation.toFixed(2)}ms`);
    console.log(`Layout Trigger: ${profile.stages.layoutTrigger.toFixed(2)}ms`);
    console.groupEnd();

    console.group('🏗️ Container Statistics:');
    console.log(`Total Containers: ${profile.containerStats.totalContainers}`);
    console.log(`Collapsed Containers: ${profile.containerStats.collapsedContainers}`);
    console.log(`Average Child Count: ${profile.containerStats.averageChildCount.toFixed(1)}`);
    console.log(`Max Child Count: ${profile.containerStats.maxChildCount}`);
    console.log(`Total Leaf Nodes: ${profile.containerStats.totalLeafNodes}`);
    console.groupEnd();

    if (profile.stages.individualExpansions.length > 0) {
      console.group('🔄 Individual Container Expansions:');
      
      // Sort by time (slowest first)
      const sortedExpansions = [...profile.stages.individualExpansions]
        .sort((a, b) => b.time - a.time);
      
      // Show top 10 slowest expansions
      const topSlowest = sortedExpansions.slice(0, 10);
      topSlowest.forEach((expansion, index) => {
        console.log(
          `${index + 1}. ${expansion.containerId}: ${expansion.time.toFixed(2)}ms ` +
          `(${expansion.childCount} children, ${expansion.leafNodeCount} leaves)`
        );
      });
      
      if (sortedExpansions.length > 10) {
        console.log(`... and ${sortedExpansions.length - 10} more containers`);
      }

      // Calculate expansion statistics
      const totalExpansionTime = profile.stages.individualExpansions
        .reduce((sum, exp) => sum + exp.time, 0);
      const avgExpansionTime = totalExpansionTime / profile.stages.individualExpansions.length;
      
      console.log(`\nExpansion Stats:`);
      console.log(`  Total Expansion Time: ${totalExpansionTime.toFixed(2)}ms`);
      console.log(`  Average per Container: ${avgExpansionTime.toFixed(2)}ms`);
      console.log(`  Slowest Container: ${sortedExpansions[0]?.time.toFixed(2)}ms`);
      
      console.groupEnd();
    }

    if (profile.memoryUsage) {
      console.group('💾 Memory Usage:');
      console.log(`Start: ${(profile.memoryUsage.start / 1024 / 1024).toFixed(2)} MB`);
      console.log(`End: ${(profile.memoryUsage.end / 1024 / 1024).toFixed(2)} MB`);
      console.log(`Delta: ${(profile.memoryUsage.delta / 1024 / 1024).toFixed(2)} MB`);
      console.groupEnd();
    }

    console.group('🎯 Performance Insights:');
    
    // Identify potential bottlenecks
    const stagePercentages = {
      discovery: (profile.stages.containerDiscovery / profile.totalTime) * 100,
      expansion: (profile.stages.expansionLoop / profile.totalTime) * 100,
      validation: (profile.stages.validation / profile.totalTime) * 100,
      layout: (profile.stages.layoutTrigger / profile.totalTime) * 100,
    };

    Object.entries(stagePercentages).forEach(([stage, percentage]) => {
      if (percentage > 20) {
        console.warn(`🚨 ${stage} takes ${percentage.toFixed(1)}% of total time - potential bottleneck`);
      }
    });

    // Check for slow individual expansions
    if (profile.stages.individualExpansions.length > 0) {
      const slowExpansions = profile.stages.individualExpansions.filter(exp => exp.time > 50);
      if (slowExpansions.length > 0) {
        console.warn(`🐌 ${slowExpansions.length} containers took >50ms to expand`);
      }
    }

    console.groupEnd();
    console.groupEnd();
  }

  isProfileActive(): boolean {
    return this.isActive;
  }
}
