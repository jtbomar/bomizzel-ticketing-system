import { enhancedLogger } from '../src/utils/logger';
import { QueryPerformanceMonitor } from '../src/middleware/performanceMonitoring';
import { ForbiddenError } from '../src/utils/errors';

describe('enhancedLogger', () => {
  // It was built by spreading the winston logger, which copies own properties
  // only - every level method lives on the prototype, so all of them came out
  // undefined and every call site threw.
  it.each(['error', 'warn', 'info', 'debug', 'verbose', 'log', 'child'])(
    'exposes logger.%s',
    (method) => {
      expect(typeof (enhancedLogger as unknown as Record<string, unknown>)[method]).toBe(
        'function'
      );
    }
  );

  it.each(['security', 'performance', 'database', 'api', 'business', 'auth'])(
    'exposes the %s category helper',
    (method) => {
      expect(typeof (enhancedLogger as unknown as Record<string, unknown>)[method]).toBe(
        'function'
      );
    }
  );

  it('actually logs without throwing', () => {
    expect(() => enhancedLogger.error('test error', { context: 'test' })).not.toThrow();
    expect(() => enhancedLogger.warn('test warning')).not.toThrow();
    expect(() => enhancedLogger.database('test query')).not.toThrow();
  });
});

describe('QueryPerformanceMonitor.monitorQuery', () => {
  it('returns the query result', async () => {
    const result = await QueryPerformanceMonitor.monitorQuery('ok', async () => 'value');

    expect(result).toBe('value');
  });

  it('rethrows the original error rather than one from its own logging', async () => {
    // Its catch block logged through enhancedLogger.error, which did not exist.
    // The TypeError replaced the real error, so a ForbiddenError raised by a
    // tenant isolation check surfaced to the caller as a 500.
    const thrown = new ForbiddenError('Access denied to ticket');

    await expect(
      QueryPerformanceMonitor.monitorQuery('denied', async () => {
        throw thrown;
      })
    ).rejects.toBe(thrown);
  });
});
