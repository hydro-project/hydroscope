#!/usr/bin/env node

/**
 * Performance Test Runner
 * Runs performance tests and generates reports
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PERFORMANCE_TESTS = [
  'src/__tests__/performance.benchmark.test.ts',
  'src/__tests__/performance.regression.test.ts',
];

const OUTPUT_DIR = path.join(process.cwd(), 'performance-reports');

function ensureOutputDir() {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }
}

function runPerformanceTest(testFile) {
  console.log(`\n🚀 Running performance test: ${testFile}`);
  
  try {
    const result = execSync(
      `npm test -- --run ${testFile} --reporter=verbose`,
      { 
        encoding: 'utf8',
        stdio: 'pipe'
      }
    );
    
    console.log('✅ Test passed');
    return { success: true, output: result };
  } catch (error) {
    console.log('❌ Test failed');
    return { success: false, output: error.stdout || error.message };
  }
}

function generateReport(results) {
  const timestamp = new Date().toISOString();
  const reportPath = path.join(OUTPUT_DIR, `performance-report-${Date.now()}.md`);
  
  let report = `# Performance Test Report\n\n`;
  report += `**Generated:** ${timestamp}\n\n`;
  
  results.forEach(({ testFile, result }) => {
    report += `## ${testFile}\n\n`;
    report += `**Status:** ${result.success ? '✅ PASSED' : '❌ FAILED'}\n\n`;
    report += `### Output\n\n`;
    report += '```\n';
    report += result.output;
    report += '\n```\n\n';
  });
  
  fs.writeFileSync(reportPath, report);
  console.log(`\n📊 Performance report generated: ${reportPath}`);
  
  return reportPath;
}

function main() {
  console.log('🔍 Hydroscope Performance Test Suite');
  console.log('=====================================');
  
  ensureOutputDir();
  
  const results = [];
  let allPassed = true;
  
  for (const testFile of PERFORMANCE_TESTS) {
    const result = runPerformanceTest(testFile);
    results.push({ testFile, result });
    
    if (!result.success) {
      allPassed = false;
    }
  }
  
  const reportPath = generateReport(results);
  
  console.log('\n📈 Performance Test Summary');
  console.log('===========================');
  
  results.forEach(({ testFile, result }) => {
    const status = result.success ? '✅' : '❌';
    console.log(`${status} ${testFile}`);
  });
  
  if (allPassed) {
    console.log('\n🎉 All performance tests passed!');
    process.exit(0);
  } else {
    console.log('\n⚠️  Some performance tests failed. Check the report for details.');
    process.exit(1);
  }
}

main();