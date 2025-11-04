#!/usr/bin/env ts-node

import { execSync } from 'child_process';
import path from 'path';

interface TestSuite {
  name: string;
  pattern: string;
  timeout?: number;
}

const testSuites: TestSuite[] = [
  {
    name: 'Unit Tests - Services',
    pattern: 'tests/**/*Service.test.ts',
  },
  {
    name: 'Unit Tests - Models',
    pattern: 'tests/**/*Model.test.ts',
  },
  {
    name: 'Integration Tests - API Endpoints',
    pattern: 'tests/**/*.test.ts --testPathIgnorePatterns=Service Performance Security',
  },
  {
    name: 'Integration Tests - Workflows',
    pattern: 'tests/integration/**/*.test.ts',
    timeout: 30000,
  },
  {
    name: 'Security Tests',
    pattern: 'tests/security/**/*.test.ts',
    timeout: 20000,
  },
  {
    name: 'Performance Tests',
    pattern: 'tests/performance/**/*.test.ts',
    timeout: 60000,
  },
];

async function runTestSuite(suite: TestSuite): Promise<boolean> {
  console.log(`\n🧪 Running ${suite.name}...`);
  console.log('='.repeat(50));

  try {
    const command = `npx jest ${suite.pattern} --verbose --coverage=false${
      suite.timeout ? ` --testTimeout=${suite.timeout}` : ''
    }`;

    console.log(`Command: ${command}`);
    execSync(command, {
      stdio: 'inherit',
      cwd: path.resolve(__dirname, '..'),
    });

    console.log(`✅ ${suite.name} completed successfully`);
    return true;
  } catch (error) {
    console.error(`❌ ${suite.name} failed`);
    return false;
  }
}

async function runCoverageReport(): Promise<void> {
  console.log('\n📊 Generating coverage report...');
  console.log('='.repeat(50));

  try {
    execSync('npx jest --coverage --coverageReporters=text --coverageReporters=html', {
      stdio: 'inherit',
      cwd: path.resolve(__dirname, '..'),
    });
    console.log('✅ Coverage report generated');
  } catch (error) {
    console.error('❌ Coverage report generation failed');
  }
}

async function main(): Promise<void> {
  console.log('🚀 Starting comprehensive test suite execution');
  console.log('='.repeat(50));

  const results: { suite: string; passed: boolean }[] = [];
  let totalPassed = 0;

  // Run each test suite
  for (const suite of testSuites) {
    const passed = await runTestSuite(suite);
    results.push({ suite: suite.name, passed });
    if (passed) totalPassed++;
  }

  // Generate coverage report
  await runCoverageReport();

  // Print summary
  console.log('\n📋 Test Execution Summary');
  console.log('='.repeat(50));

  results.forEach(({ suite, passed }) => {
    console.log(`${passed ? '✅' : '❌'} ${suite}`);
  });

  console.log(`\n📊 Overall Results: ${totalPassed}/${results.length} test suites passed`);

  if (totalPassed === results.length) {
    console.log('🎉 All test suites passed successfully!');
    process.exit(0);
  } else {
    console.log('⚠️  Some test suites failed. Please review the output above.');
    process.exit(1);
  }
}

// Handle script execution
if (require.main === module) {
  main().catch((error) => {
    console.error('❌ Test execution failed:', error);
    process.exit(1);
  });
}
