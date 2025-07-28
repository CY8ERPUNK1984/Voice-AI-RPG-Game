import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createLogger, getLogger, resetLogger } from '../Logger';
import { promises as fs } from 'fs';
import { join } from 'path';

describe('Logger Integration Tests', () => {
  const testLogFile = 'integration-test.log';
  const logPath = join(process.cwd(), 'logs', testLogFile);

  beforeAll(async () => {
    // Reset any existing logger
    resetLogger();
    
    // Create logger for integration testing
    createLogger({
      level: 'debug',
      service: 'integration-test',
      logFile: testLogFile,
      enableConsole: false, // Disable console for cleaner test output
      enableFile: true,
      enableStructured: true,
      maxFileSize: 1024 * 1024, // 1MB
      maxFiles: 3
    });
  });

  afterAll(async () => {
    // Cleanup test log files
    try {
      await fs.unlink(logPath);
    } catch (error) {
      // File might not exist
    }
    
    try {
      await fs.rmdir(join(process.cwd(), 'logs'));
    } catch (error) {
      // Directory might not be empty or not exist
    }
    
    resetLogger();
  });

  it('should create log files and write structured logs', async () => {
    const logger = getLogger();
    
    // Log various types of messages
    logger.info('Integration test started', { testId: 'int-001' }, 'integration');
    logger.debug('Debug message for integration test', { data: { key: 'value' } }, 'integration');
    logger.warn('Warning message', { warning: 'test warning' }, 'integration');
    logger.error('Error message', new Error('Test error'), { errorContext: 'integration' }, 'integration');
    
    // Performance logging
    logger.logPerformance('test-operation', 150, { operation: 'integration-test' }, 'performance');
    
    // Business event logging
    logger.logEvent('integration-test-completed', { success: true }, 'integration');
    
    // Wait for buffer to flush
    await new Promise(resolve => setTimeout(resolve, 6000)); // Wait longer than flush interval
    
    // Check if log file was created and contains expected content
    const logContent = await fs.readFile(logPath, 'utf8');
    const logLines = logContent.split('\n').filter(line => line.trim());
    
    expect(logLines.length).toBeGreaterThan(0);
    
    // Parse and verify log entries
    const logEntries = logLines.map(line => JSON.parse(line));
    
    // Check that all log levels are present
    const levels = logEntries.map(entry => entry.level);
    expect(levels).toContain('info');
    expect(levels).toContain('debug');
    expect(levels).toContain('warn');
    expect(levels).toContain('error');
    
    // Check structured format
    const firstEntry = logEntries[0];
    expect(firstEntry).toHaveProperty('id');
    expect(firstEntry).toHaveProperty('timestamp');
    expect(firstEntry).toHaveProperty('level');
    expect(firstEntry).toHaveProperty('service', 'integration-test');
    expect(firstEntry).toHaveProperty('component');
    expect(firstEntry).toHaveProperty('message');
    expect(firstEntry).toHaveProperty('context');
    expect(firstEntry).toHaveProperty('memoryUsage');
    
    // Check error entry has error details
    const errorEntry = logEntries.find(entry => entry.level === 'error');
    expect(errorEntry).toHaveProperty('error');
    expect(errorEntry.error).toHaveProperty('name', 'Error');
    expect(errorEntry.error).toHaveProperty('message', 'Test error');
    expect(errorEntry.error).toHaveProperty('stack');
    
    // Check performance entry
    const perfEntry = logEntries.find(entry => entry.message.includes('Performance:'));
    expect(perfEntry).toBeDefined();
    expect(perfEntry.context).toHaveProperty('duration', 150);
    expect(perfEntry.context).toHaveProperty('operation', 'test-operation');
    
    // Check business event entry
    const eventEntry = logEntries.find(entry => entry.message.includes('Event:'));
    expect(eventEntry).toBeDefined();
    expect(eventEntry.context).toHaveProperty('event', 'integration-test-completed');
    expect(eventEntry.context).toHaveProperty('type', 'business_event');
  }, 10000); // Increase timeout for file operations

  it('should support log search functionality', async () => {
    const logger = getLogger();
    
    // Add some searchable logs
    logger.info('Searchable log entry with unique keyword SEARCHTEST', { searchable: true }, 'search');
    logger.error('Another searchable entry with SEARCHTEST keyword', new Error('Search error'), { searchable: true }, 'search');
    
    // Wait for logs to be written
    await new Promise(resolve => setTimeout(resolve, 6000));
    
    // Search for logs
    const searchResults = await logger.searchLogs('SEARCHTEST');
    
    expect(searchResults.length).toBeGreaterThanOrEqual(2);
    expect(searchResults.every(entry => 
      entry.message.includes('SEARCHTEST') || 
      JSON.stringify(entry.context).includes('SEARCHTEST')
    )).toBe(true);
    
    // Search by level
    const errorResults = await logger.searchLogs('', 'error');
    expect(errorResults.length).toBeGreaterThan(0);
    expect(errorResults.every(entry => entry.level === 'error')).toBe(true);
  }, 10000);

  it('should handle request context correctly', async () => {
    const logger = getLogger();
    
    // Set request context
    logger.setRequestId('test-request-123');
    logger.info('Message with request context', { hasRequestId: true }, 'context');
    
    // Clear request context
    logger.clearRequestId();
    logger.info('Message without request context', { hasRequestId: false }, 'context');
    
    // Wait for logs to be written
    await new Promise(resolve => setTimeout(resolve, 6000));
    
    // Search for logs and verify request ID presence
    const contextResults = await logger.searchLogs('request context');
    
    expect(contextResults.length).toBe(2);
    
    const withRequestId = contextResults.find(entry => entry.context.hasRequestId === true);
    const withoutRequestId = contextResults.find(entry => entry.context.hasRequestId === false);
    
    expect(withRequestId?.requestId).toBe('test-request-123');
    expect(withoutRequestId?.requestId).toBeUndefined();
  }, 10000);

  it('should provide accurate statistics', () => {
    const logger = getLogger();
    
    const stats = logger.getStats();
    
    expect(stats).toHaveProperty('bufferSize');
    expect(stats).toHaveProperty('memoryUsage');
    expect(typeof stats.bufferSize).toBe('number');
    expect(typeof stats.memoryUsage).toBe('object');
    expect(stats.memoryUsage).toHaveProperty('rss');
    expect(stats.memoryUsage).toHaveProperty('heapUsed');
    expect(stats.memoryUsage).toHaveProperty('heapTotal');
  });
});