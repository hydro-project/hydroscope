/**
 * Global Setup/Teardown - displays final status messages after ALL tests complete
 *
 * This runs after every test in the entire test suite has finished,
 * ensuring the message appears at the very end and is visible to developers.
 */

export function setup() {
  // No setup needed
}

export function teardown() {
  console.log('🧹 Global teardown starting...');

  // Check if fuzz tests were skipped
  const shouldRunFuzzTests = process.env.ENABLE_FUZZ_TESTS === 'true';
  // Check if test logs were suppressed
  const shouldOutputTestLogs = process.env.ENABLE_TEST_LOGS === 'true';

  if (shouldRunFuzzTests || shouldOutputTestLogs) {
    console.log('\n' + '='.repeat(80));
  }
  if (!shouldRunFuzzTests) {
    console.log('⏭️  COMPREHENSIVE FUZZ TESTS SKIPPED');
    console.log('   Set ENABLE_FUZZ_TESTS=true to run comprehensive stress tests');
  }
  if (!shouldOutputTestLogs) {
    console.log('👀 CONSOLE LOGS SUPPRESSED');
    console.log('   Set ENABLE_TEST_LOGS=true to output console logs from tests');
  }
  if (shouldRunFuzzTests || shouldOutputTestLogs) {
    console.log('='.repeat(80) + '\n');
  }
  console.log('🧹 Global teardown complete.');
}
