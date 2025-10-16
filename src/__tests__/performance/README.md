# Performance Tests

This directory contains performance and benchmark tests that are excluded from the regular test suite to keep CI fast.

## Running Performance Tests

```bash
# Run all performance tests
npm run test:performance

# Run specific performance test
npm run test:performance -- performance.benchmark.test.ts
```

## Test Categories

- **`performance.benchmark.test.ts`** - Core performance benchmarks
- **`performance.bridge-stateless.test.ts`** - Bridge performance regression tests
- **`performance.core-operations.test.ts`** - Core operation performance tests
- **`performance.optimization.test.ts`** - Optimization validation tests
- **`performance.regression.test.ts`** - Performance regression detection
- **`performance.report.test.ts`** - Performance reporting tests
- **`performance.stateless-bridges.test.ts`** - Stateless bridge performance tests
- **`paxos-flipped-performance-stability.test.ts`** - Paxos-specific performance tests

## Notes

- These tests may take longer to run (up to 30 seconds per test)
- They are designed to measure performance characteristics and detect regressions
- Results may vary based on system performance and load
- Consider running these tests in isolation for consistent results