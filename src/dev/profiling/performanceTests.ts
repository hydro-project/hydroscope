/**
 * Performance Profiling Test
 * 
 * Test script to verify that the performance instrumentation is working correctly.
 * This can be run in the browser console to see performance metrics.
 */

import { PerformanceProfiler, profileStage, startProfiling, printProfilerReport } from './PerformanceProfiler';

// Simulate various performance scenarios
export function runPerformanceTests() {
  console.log('🧪 Starting performance profiling tests...');
  
  // Reset profiler for clean test
  startProfiling();
  
  // Test 1: File loading simulation
  profileStage('File Loading', () => {
    // Simulate file reading delay
    const start = Date.now();
    while (Date.now() - start < 150) {
      // Busy wait to simulate file loading
    }
    return { fileSize: 748114, fileName: 'paxos.json' };
  });
  
  // Test 2: JSON parsing simulation
  const largeObject = profileStage('JSON Parsing', () => {
    // Create a large object to simulate JSON parsing
    const nodes = Array.from({ length: 1000 }, (_, i) => ({
      id: `node_${i}`,
      label: `Node ${i}`,
      data: { timestamp: Date.now(), index: i }
    }));
    
    const edges = Array.from({ length: 1500 }, (_, i) => ({
      id: `edge_${i}`,
      source: `node_${i % 1000}`,
      target: `node_${(i + 1) % 1000}`,
      label: `Edge ${i}`
    }));
    
    return { nodes, edges };
  });
  
  // Test 3: State creation simulation
  profileStage('State Creation', () => {
    // Simulate visualization state creation
    const processedNodes = largeObject.nodes.map(node => ({
      ...node,
      processed: true,
      style: 'default'
    }));
    
    const processedEdges = largeObject.edges.map(edge => ({
      ...edge,
      processed: true,
      style: 'default'
    }));
    
    return { processedNodes, processedEdges };
  });
  
  // Test 4: Layout calculation simulation
  profileStage('Layout Calculation', () => {
    // Simulate ELK layout calculation
    const start = Date.now();
    while (Date.now() - start < 300) {
      // Busy wait to simulate layout calculation
    }
    
    // Simulate layout results
    return largeObject.nodes.map(node => ({
      ...node,
      x: Math.random() * 1000,
      y: Math.random() * 1000
    }));
  });
  
  // Test 5: Rendering simulation
  profileStage('Rendering', () => {
    // Simulate React rendering
    const start = Date.now();
    while (Date.now() - start < 200) {
      // Busy wait to simulate rendering
    }
    
    return { rendered: true, nodeCount: largeObject.nodes.length };
  });
  
  // Print the report
  console.log('📊 Performance test completed!');
  printProfilerReport();
  
  return PerformanceProfiler.getInstance().generateReport();
}

// Function to test with different file sizes
export function testPerformanceScaling() {
  console.log('📈 Testing performance scaling...');
  
  const fileSizes = [1000, 5000, 10000, 20000]; // Number of nodes
  const results: any[] = [];
  
  fileSizes.forEach(nodeCount => {
    console.log(`\n🔄 Testing with ${nodeCount} nodes...`);
    startProfiling();
    
    // Simulate file processing for different sizes
    const data = profileStage(`File Processing (${nodeCount} nodes)`, () => {
      const nodes = Array.from({ length: nodeCount }, (_, i) => ({
        id: `node_${i}`,
        label: `Node ${i}`
      }));
      
      const edges = Array.from({ length: Math.floor(nodeCount * 1.5) }, (_, i) => ({
        id: `edge_${i}`,
        source: `node_${i % nodeCount}`,
        target: `node_${(i + 1) % nodeCount}`
      }));
      
      return { nodes, edges };
    });
    
    const report = PerformanceProfiler.getInstance().generateReport();
    results.push({
      nodeCount,
      totalDuration: report.totalDuration,
      stages: report.stages,
      recommendations: report.recommendations
    });
    
    console.log(`✅ ${nodeCount} nodes processed in ${report.totalDuration.toFixed(2)}ms`);
  });
  
  // Analyze scaling
  console.log('\n📊 Scaling Analysis:');
  console.table(results.map(r => ({
    'Node Count': r.nodeCount,
    'Total Time (ms)': r.totalDuration.toFixed(2),
    'Time per Node (ms)': (r.totalDuration / r.nodeCount).toFixed(3),
    'Recommendations': r.recommendations.length
  })));
  
  return results;
}

// Browser console helpers
if (typeof window !== 'undefined') {
  (window as any).runPerformanceTests = runPerformanceTests;
  (window as any).testPerformanceScaling = testPerformanceScaling;
  (window as any).startProfiling = startProfiling;
  (window as any).printProfilerReport = printProfilerReport;
}

export { runPerformanceTests as default };
