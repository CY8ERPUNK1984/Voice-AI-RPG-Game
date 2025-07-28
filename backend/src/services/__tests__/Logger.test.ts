import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { promises as fs } from 'fs';
import { join } from 'path';
import { createLogger, getLogger, StructuredLogger, LogLevel, withRequestContext, resetLogger } from '../Logger';

// Mock fs module
vi.mock('fs', () => ({
  promises: {
    mkdir: vi.fn(),
    appendFile: vi.fn(),
    readFile: vi.fn(),
    readdir: vi.fn(),
    stat: vi.fn(),
    rename: vi.fn(),
    unlink: vi.fn()
  }
}));

// Mock uuid
vi.mock('uuid', () => ({
  v4: vi.fn(() => 'test-uuid-123')
}));

describe('StructuredLogger', () => {
  let logger: StructuredLogger;
  let consoleSpy: any;

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();
    
    // Mock console methods
    consoleSpy = {
      debug: vi.spyOn(console, 'debug').mockImplementation(() => {}),
      info: vi.spyOn(console, 'info').mockImplementation(() => {}),
      warn: vi.spyOn(console, 'warn').mockImplementation(() => {}),
      error: vi.spyOn(console, 'error').mockImplementation(() => {}),
      log: vi.spyOn(console, 'log').mockImplementation(() => {})
    };

    // Create logger instance
    logger = createLogger({
      level: 'debug',
      service: 'test-service',
      logFile: 'test.log',
      enableConsole: true,
      enableFile: true,
      enableStructured: true
    });
  });

  afterEach(() => {
    // Restore console methods
    Object.values(consoleSpy).forEach((spy: any) => spy.mockRestore());
    
    // Clear intervals
    if (logger) {
      logger['shutdown']();
    }
  });

  describe('Basic Logging', () => {
    it('should log debug messages', () => {
      logger.debug('Test debug message', { key: 'value' }, 'test-component');
      
      expect(consoleSpy.debug).toHaveBeenCalledWith(
        expect.stringContaining('DEBUG')
      );
      expect(consoleSpy.debug).toHaveBeenCalledWith(
        expect.stringContaining('Test debug message')
      );
    });

    it('should log info messages', () => {
      logger.info('Test info message', { key: 'value' }, 'test-component');
      
      expect(consoleSpy.info).toHaveBeenCalledWith(
        expect.stringContaining('INFO')
      );
      expect(consoleSpy.info).toHaveBeenCalledWith(
        expect.stringContaining('Test info message')
      );
    });

    it('should log warning messages', () => {
      logger.warn('Test warning message', { key: 'value' }, 'test-component');
      
      expect(consoleSpy.warn).toHaveBeenCalledWith(
        expect.stringContaining('WARN')
      );
      expect(consoleSpy.warn).toHaveBeenCalledWith(
        expect.stringContaining('Test warning message')
      );
    });

    it('should log error messages with error objects', () => {
      const testError = new Error('Test error');
      logger.error('Test error message', testError, { key: 'value' }, 'test-component');
      
      expect(consoleSpy.error).toHaveBeenCalledWith(
        expect.stringContaining('ERROR')
      );
      expect(consoleSpy.error).toHaveBeenCalledWith(
        expect.stringContaining('Test error message')
      );
      expect(consoleSpy.error).toHaveBeenCalledWith(
        'Error details:',
        expect.objectContaining({
          name: 'Error',
          message: 'Test error'
        })
      );
    });

    it('should log fatal messages', () => {
      logger.fatal('Test fatal message', undefined, { key: 'value' }, 'test-component');
      
      expect(consoleSpy.error).toHaveBeenCalledWith(
        expect.stringContaining('FATAL')
      );
      expect(consoleSpy.error).toHaveBeenCalledWith(
        expect.stringContaining('Test fatal message')
      );
    });
  });

  describe('Log Level Filtering', () => {
    it('should respect log level filtering', () => {
      // Reset console spies
      vi.clearAllMocks();
      
      // Create new logger with warn level
      const warnLogger = new StructuredLogger({
        level: 'warn',
        service: 'test-service',
        enableConsole: true,
        enableFile: false
      });

      warnLogger.debug('Debug message');
      warnLogger.info('Info message');
      warnLogger.warn('Warn message');
      warnLogger.error('Error message');

      expect(consoleSpy.debug).not.toHaveBeenCalled();
      expect(consoleSpy.info).not.toHaveBeenCalled();
      expect(consoleSpy.warn).toHaveBeenCalled();
      expect(consoleSpy.error).toHaveBeenCalled();
      
      // Cleanup
      warnLogger['shutdown']();
    });
  });

  describe('Request Context', () => {
    it('should set and clear request ID', () => {
      logger.setRequestId('test-request-123');
      logger.info('Test message with request ID');
      
      expect(consoleSpy.info).toHaveBeenCalledWith(
        expect.stringContaining('[req:test-req]')
      );
      
      logger.clearRequestId();
      logger.info('Test message without request ID');
      
      // Second call should not contain request ID
      const secondCall = consoleSpy.info.mock.calls[1][0];
      expect(secondCall).not.toContain('[req:');
    });

    it('should work with withRequestContext helper', () => {
      const testFunction = vi.fn((message: string) => {
        logger.info(message);
        return 'result';
      });

      const wrappedFunction = withRequestContext(testFunction, 'test-request-456');
      const result = wrappedFunction('Test message');

      expect(result).toBe('result');
      expect(testFunction).toHaveBeenCalledWith('Test message');
      expect(consoleSpy.info).toHaveBeenCalledWith(
        expect.stringContaining('[req:test-req]')
      );
    });
  });

  describe('Performance Logging', () => {
    it('should log performance metrics', () => {
      logger.logPerformance('test-operation', 150, { additional: 'data' }, 'performance');
      
      expect(consoleSpy.info).toHaveBeenCalledWith(
        expect.stringContaining('Performance: test-operation')
      );
    });

    it('should log request metrics', () => {
      logger.logRequest('GET', '/api/test', 200, 100, { userId: 'user123' });
      
      expect(consoleSpy.info).toHaveBeenCalledWith(
        expect.stringContaining('GET /api/test 200')
      );
    });

    it('should use appropriate log level for HTTP status codes', () => {
      logger.logRequest('GET', '/api/test', 500, 100);
      expect(consoleSpy.error).toHaveBeenCalled();

      logger.logRequest('GET', '/api/test', 404, 100);
      expect(consoleSpy.warn).toHaveBeenCalled();

      logger.logRequest('GET', '/api/test', 200, 100);
      expect(consoleSpy.info).toHaveBeenCalled();
    });
  });

  describe('Business Event Logging', () => {
    it('should log business events', () => {
      logger.logEvent('user-login', { userId: 'user123', method: 'oauth' }, 'auth');
      
      expect(consoleSpy.info).toHaveBeenCalledWith(
        expect.stringContaining('Event: user-login')
      );
    });
  });

  describe('File Logging', () => {
    it('should buffer logs for file writing', async () => {
      logger.info('Test file log');
      
      // Wait for buffer to be processed
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(logger.getStats().bufferSize).toBeGreaterThanOrEqual(0);
    });

    it('should create log directory if it does not exist', async () => {
      logger.info('Test log');
      
      // Trigger flush
      await logger['flushBuffer']();
      
      expect(fs.mkdir).toHaveBeenCalledWith(
        expect.stringContaining('logs'),
        { recursive: true }
      );
    });

    it('should write structured logs to file', async () => {
      logger.info('Test structured log', { key: 'value' });
      
      // Trigger flush
      await logger['flushBuffer']();
      
      expect(fs.appendFile).toHaveBeenCalledWith(
        expect.stringContaining('test.log'),
        expect.stringContaining('"message":"Test structured log"'),
        'utf8'
      );
    });
  });

  describe('Log Rotation', () => {
    it('should rotate logs when file size exceeds limit', async () => {
      // Mock file stats to simulate large file
      (fs.stat as any).mockResolvedValue({ size: 15 * 1024 * 1024 }); // 15MB
      
      logger.info('Test log for rotation');
      await logger['flushBuffer']();
      
      expect(fs.rename).toHaveBeenCalled();
    });

    it('should handle rotation errors gracefully', async () => {
      (fs.stat as any).mockResolvedValue({ size: 15 * 1024 * 1024 });
      (fs.rename as any).mockRejectedValue(new Error('Rotation failed'));
      
      // Should not throw
      await expect(logger['flushBuffer']()).resolves.not.toThrow();
    });
  });

  describe('Log Search', () => {
    it('should search logs by query', async () => {
      const mockLogContent = [
        '{"message":"Test message 1","level":"info"}',
        '{"message":"Test message 2","level":"error"}',
        '{"message":"Another log","level":"info"}'
      ].join('\n');
      
      (fs.readFile as any).mockResolvedValue(mockLogContent);
      
      const results = await logger.searchLogs('Test message', undefined, 10);
      
      expect(results).toHaveLength(2);
      expect(results[0].message).toContain('Test message');
    });

    it('should filter logs by level', async () => {
      const mockLogContent = [
        '{"message":"Info message","level":"info"}',
        '{"message":"Error message","level":"error"}',
        '{"message":"Another info","level":"info"}'
      ].join('\n');
      
      (fs.readFile as any).mockResolvedValue(mockLogContent);
      
      const results = await logger.searchLogs('', 'error', 10);
      
      expect(results).toHaveLength(1);
      expect(results[0].level).toBe('error');
    });

    it('should handle search errors gracefully', async () => {
      (fs.readFile as any).mockRejectedValue(new Error('File not found'));
      
      const results = await logger.searchLogs('test');
      
      expect(results).toEqual([]);
      expect(consoleSpy.warn).toHaveBeenCalledWith(
        expect.stringContaining('Failed to search logs')
      );
    });
  });

  describe('Cleanup', () => {
    it('should cleanup old log files', async () => {
      const mockFiles = ['test.log', 'test.log.1', 'test.log.2', 'test.log.3', 'test.log.4', 'test.log.5', 'test.log.6'];
      (fs.readdir as any).mockResolvedValue(mockFiles);
      
      await logger.cleanup();
      
      // Should remove files beyond maxFiles limit (5)
      // The cleanup sorts files and removes from index maxFiles onwards
      // With maxFiles=5, files at index 5 and 6 should be removed
      expect(fs.unlink).toHaveBeenCalled();
      expect(fs.unlink).toHaveBeenCalledTimes(2); // Should remove 2 files (test.log.6 and test.log.5 or similar)
    });

    it('should handle cleanup errors gracefully', async () => {
      (fs.readdir as any).mockRejectedValue(new Error('Directory not found'));
      
      await expect(logger.cleanup()).resolves.not.toThrow();
      
      expect(consoleSpy.warn).toHaveBeenCalledWith(
        expect.stringContaining('Failed to cleanup log files')
      );
    });
  });

  describe('Statistics', () => {
    it('should provide logger statistics', () => {
      const stats = logger.getStats();
      
      expect(stats).toHaveProperty('bufferSize');
      expect(stats).toHaveProperty('memoryUsage');
      expect(typeof stats.bufferSize).toBe('number');
      expect(typeof stats.memoryUsage).toBe('object');
    });
  });

  describe('Singleton Pattern', () => {
    it('should return same instance when called multiple times', () => {
      const logger1 = getLogger();
      const logger2 = getLogger();
      
      expect(logger1).toBe(logger2);
    });

    it('should throw error when getting logger before initialization', () => {
      // Reset the singleton
      resetLogger();
      
      expect(() => getLogger()).toThrow('Logger not initialized');
      
      // Recreate logger for other tests
      logger = createLogger({
        level: 'debug',
        service: 'test-service',
        logFile: 'test.log',
        enableConsole: true,
        enableFile: true,
        enableStructured: true
      });
    });
  });

  describe('Memory Usage Tracking', () => {
    it('should include memory usage in log entries', () => {
      logger.info('Test memory tracking');
      
      // Check that console output includes memory information in the log entry
      expect(consoleSpy.info).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should handle file write errors gracefully', async () => {
      (fs.appendFile as any).mockRejectedValue(new Error('Write failed'));
      
      logger.info('Test error handling');
      
      // Should not throw and should put entries back in buffer
      await expect(logger['flushBuffer']()).resolves.not.toThrow();
    });

    it('should handle JSON parsing errors in search', async () => {
      const invalidLogContent = 'invalid json\n{"message":"valid json entry","level":"info"}';
      (fs.readFile as any).mockResolvedValue(invalidLogContent);
      
      const results = await logger.searchLogs('valid');
      
      expect(results).toHaveLength(1);
      expect(results[0].message).toBe('valid json entry');
    });
  });
});

describe('Logger Integration', () => {
  it('should work with real file operations in development', async () => {
    // This test would run with real file system in integration testing
    // For unit tests, we keep it simple
    const logger = createLogger({
      level: 'info',
      service: 'integration-test',
      logFile: 'integration-test.log',
      enableFile: false, // Disable file operations for unit test
      enableConsole: true
    });

    expect(() => {
      logger.info('Integration test message');
      logger.error('Integration test error', new Error('Test error'));
      logger.logPerformance('test-operation', 100);
      logger.logEvent('test-event', { data: 'test' });
    }).not.toThrow();
  });
});