import { promises as fs } from 'fs';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

export interface LogEntry {
  id: string;
  timestamp: string;
  level: LogLevel;
  service: string;
  component: string;
  message: string;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
  context: Record<string, any>;
  userId?: string;
  sessionId?: string;
  requestId?: string;
  duration?: number;
  memoryUsage?: NodeJS.MemoryUsage;
}

export interface LoggerConfig {
  level: LogLevel;
  service: string;
  logFile?: string;
  maxFileSize?: number; // in bytes
  maxFiles?: number;
  enableConsole?: boolean;
  enableFile?: boolean;
  enableStructured?: boolean;
}

class StructuredLogger {
  private config: LoggerConfig;
  private currentRequestId?: string;
  private logBuffer: LogEntry[] = [];
  private bufferFlushInterval: NodeJS.Timeout;
  private logLevels: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
    fatal: 4
  };

  constructor(config: LoggerConfig) {
    this.config = {
      enableConsole: true,
      enableFile: true,
      enableStructured: true,
      maxFileSize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5,
      ...config
    };

    // Flush buffer every 5 seconds
    this.bufferFlushInterval = setInterval(() => {
      this.flushBuffer();
    }, 5000);

    // Graceful shutdown
    process.on('SIGINT', () => this.shutdown());
    process.on('SIGTERM', () => this.shutdown());
  }

  setRequestId(requestId: string): void {
    this.currentRequestId = requestId;
  }

  clearRequestId(): void {
    this.currentRequestId = undefined;
  }

  debug(message: string, context?: any, component?: string): void {
    this.log('debug', message, context, undefined, component);
  }

  info(message: string, context?: any, component?: string): void {
    this.log('info', message, context, undefined, component);
  }

  warn(message: string, context?: any, component?: string): void {
    this.log('warn', message, context, undefined, component);
  }

  error(message: string, error?: Error, context?: any, component?: string): void {
    this.log('error', message, context, error, component);
  }

  fatal(message: string, error?: Error, context?: any, component?: string): void {
    this.log('fatal', message, context, error, component);
  }

  // Performance logging
  logPerformance(operation: string, duration: number, context?: any, component?: string): void {
    this.info(`Performance: ${operation}`, {
      ...context,
      duration,
      operation
    }, component);
  }

  // Request logging
  logRequest(method: string, url: string, statusCode: number, duration: number, context?: any): void {
    const level: LogLevel = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info';
    this.log(level, `${method} ${url} ${statusCode}`, {
      ...context,
      method,
      url,
      statusCode,
      duration,
      type: 'request'
    }, undefined, 'http');
  }

  // Business event logging
  logEvent(event: string, context?: any, component?: string): void {
    this.info(`Event: ${event}`, {
      ...context,
      event,
      type: 'business_event'
    }, component);
  }

  private log(level: LogLevel, message: string, context?: any, error?: Error, component?: string): void {
    if (this.logLevels[level] < this.logLevels[this.config.level]) {
      return;
    }

    const logEntry = this.formatLog(level, message, context, error, component);
    
    if (this.config.enableConsole) {
      this.logToConsole(logEntry);
    }

    if (this.config.enableFile && this.config.logFile) {
      this.logBuffer.push(logEntry);
    }
  }

  private formatLog(level: LogLevel, message: string, context?: any, error?: Error, component?: string): LogEntry {
    const entry: LogEntry = {
      id: uuidv4(),
      timestamp: new Date().toISOString(),
      level,
      service: this.config.service,
      component: component || 'unknown',
      message,
      context: context || {},
      requestId: this.currentRequestId,
      memoryUsage: process.memoryUsage()
    };

    if (error) {
      entry.error = {
        name: error.name,
        message: error.message,
        stack: error.stack
      };
    }

    return entry;
  }

  private logToConsole(entry: LogEntry): void {
    const timestamp = new Date(entry.timestamp).toLocaleString();
    const level = entry.level.toUpperCase().padEnd(5);
    const component = entry.component.padEnd(15);
    
    let output = `[${timestamp}] ${level} [${component}] ${entry.message}`;
    
    if (entry.requestId) {
      output += ` [req:${entry.requestId.slice(0, 8)}]`;
    }

    if (entry.context && Object.keys(entry.context).length > 0) {
      output += ` ${JSON.stringify(entry.context)}`;
    }

    const logMethod = this.getConsoleMethod(entry.level);
    
    if (entry.error) {
      logMethod(output);
      console.error('Error details:', entry.error);
    } else {
      logMethod(output);
    }
  }

  private getConsoleMethod(level: LogLevel): (...args: any[]) => void {
    switch (level) {
      case 'debug':
        return console.debug;
      case 'info':
        return console.info;
      case 'warn':
        return console.warn;
      case 'error':
      case 'fatal':
        return console.error;
      default:
        return console.log;
    }
  }

  private async flushBuffer(): Promise<void> {
    if (this.logBuffer.length === 0 || !this.config.logFile) {
      return;
    }

    const entries = [...this.logBuffer];
    this.logBuffer = [];

    try {
      await this.writeToFile(entries);
    } catch (error) {
      console.error('Failed to write logs to file:', error);
      // Put entries back in buffer for retry
      this.logBuffer.unshift(...entries);
    }
  }

  private async writeToFile(entries: LogEntry[]): Promise<void> {
    if (!this.config.logFile) return;

    const logDir = join(process.cwd(), 'logs');
    const logPath = join(logDir, this.config.logFile);

    try {
      await fs.mkdir(logDir, { recursive: true });
    } catch (error) {
      // Directory might already exist
    }

    // Check file size and rotate if necessary
    await this.rotateLogIfNeeded(logPath);

    const logLines = entries.map(entry => JSON.stringify(entry)).join('\n') + '\n';
    await fs.appendFile(logPath, logLines, 'utf8');
  }

  private async rotateLogIfNeeded(logPath: string): Promise<void> {
    try {
      const stats = await fs.stat(logPath);
      if (stats.size > (this.config.maxFileSize || 10 * 1024 * 1024)) {
        await this.rotateLog(logPath);
      }
    } catch (error) {
      // File doesn't exist yet, no need to rotate
    }
  }

  private async rotateLog(logPath: string): Promise<void> {
    const maxFiles = this.config.maxFiles || 5;
    
    // Rotate existing files
    for (let i = maxFiles - 1; i >= 1; i--) {
      const oldFile = `${logPath}.${i}`;
      const newFile = `${logPath}.${i + 1}`;
      
      try {
        await fs.rename(oldFile, newFile);
      } catch (error) {
        // File might not exist
      }
    }

    // Move current log to .1
    try {
      await fs.rename(logPath, `${logPath}.1`);
    } catch (error) {
      console.error('Failed to rotate log file:', error);
    }
  }

  // Cleanup old log files
  async cleanup(): Promise<void> {
    if (!this.config.logFile) return;

    const logDir = join(process.cwd(), 'logs');
    const maxFiles = this.config.maxFiles || 5;

    try {
      const files = await fs.readdir(logDir);
      const logFiles = files
        .filter(file => file.startsWith(this.config.logFile!))
        .sort()
        .reverse();

      // Remove files beyond maxFiles limit
      for (let i = maxFiles; i < logFiles.length; i++) {
        const filePath = join(logDir, logFiles[i]);
        try {
          await fs.unlink(filePath);
          this.info(`Cleaned up old log file: ${logFiles[i]}`, {}, 'logger');
        } catch (error) {
          this.warn(`Failed to cleanup log file: ${logFiles[i]}`, { error }, 'logger');
        }
      }
    } catch (error) {
      this.warn('Failed to cleanup log files', { error }, 'logger');
    }
  }

  // Get log statistics
  getStats(): { bufferSize: number; memoryUsage: NodeJS.MemoryUsage } {
    return {
      bufferSize: this.logBuffer.length,
      memoryUsage: process.memoryUsage()
    };
  }

  // Search logs (for development/debugging)
  async searchLogs(query: string, level?: LogLevel, limit: number = 100): Promise<LogEntry[]> {
    if (!this.config.logFile) return [];

    const logPath = join(process.cwd(), 'logs', this.config.logFile);
    
    try {
      const content = await fs.readFile(logPath, 'utf8');
      const lines = content.split('\n').filter(line => line.trim());
      const entries: LogEntry[] = [];

      for (const line of lines.slice(-limit * 2)) { // Read more lines to filter
        try {
          const entry: LogEntry = JSON.parse(line);
          
          if (level && entry.level !== level) continue;
          
          const searchText = `${entry.message} ${JSON.stringify(entry.context)}`.toLowerCase();
          if (searchText.includes(query.toLowerCase())) {
            entries.push(entry);
          }

          if (entries.length >= limit) break;
        } catch (error) {
          // Skip invalid JSON lines
        }
      }

      return entries.reverse(); // Most recent first
    } catch (error) {
      this.warn('Failed to search logs', { error, query }, 'logger');
      return [];
    }
  }

  private async shutdown(): Promise<void> {
    clearInterval(this.bufferFlushInterval);
    await this.flushBuffer();
    await this.cleanup();
  }
}

// Singleton logger instance
let loggerInstance: StructuredLogger | null = null;

export function createLogger(config: LoggerConfig): StructuredLogger {
  if (loggerInstance) {
    return loggerInstance;
  }
  
  loggerInstance = new StructuredLogger(config);
  return loggerInstance;
}

export function getLogger(): StructuredLogger {
  if (!loggerInstance) {
    throw new Error('Logger not initialized. Call createLogger() first.');
  }
  return loggerInstance;
}

// For testing purposes - reset singleton
export function resetLogger(): void {
  if (loggerInstance) {
    loggerInstance['shutdown']();
  }
  loggerInstance = null;
}

// Request context middleware helper
export function withRequestContext<T extends any[], R>(
  fn: (...args: T) => R,
  requestId?: string
): (...args: T) => R {
  return (...args: T): R => {
    const logger = getLogger();
    const oldRequestId = logger['currentRequestId'];
    
    if (requestId) {
      logger.setRequestId(requestId);
    }
    
    try {
      return fn(...args);
    } finally {
      if (oldRequestId) {
        logger.setRequestId(oldRequestId);
      } else {
        logger.clearRequestId();
      }
    }
  };
}

export { StructuredLogger };