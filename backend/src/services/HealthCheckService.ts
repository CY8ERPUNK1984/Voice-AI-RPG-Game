import { EventEmitter } from 'events';
import { getLogger } from './Logger';
import { getPerformanceMonitor } from './PerformanceMonitor';

export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy' | 'unknown';

export interface HealthCheckResult {
  name: string;
  status: HealthStatus;
  message: string;
  timestamp: Date;
  responseTime: number;
  details?: Record<string, any>;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

export interface ServiceHealth {
  name: string;
  status: HealthStatus;
  lastCheck: Date;
  responseTime: number;
  uptime: number;
  errorCount: number;
  successCount: number;
  availability: number;
  dependencies: DependencyHealth[];
}

export interface DependencyHealth {
  name: string;
  status: HealthStatus;
  lastCheck: Date;
  responseTime: number;
  required: boolean;
  endpoint?: string;
}

export interface SystemHealth {
  status: HealthStatus;
  timestamp: Date;
  uptime: number;
  services: ServiceHealth[];
  dependencies: DependencyHealth[];
  resources: {
    memory: {
      used: number;
      total: number;
      percentage: number;
      status: HealthStatus;
    };
    cpu: {
      usage: number;
      status: HealthStatus;
    };
    disk: {
      usage: number;
      status: HealthStatus;
    };
  };
}

export interface HealthCheckConfig {
  interval: number; // milliseconds
  timeout: number; // milliseconds
  retries: number;
  enabled: boolean;
}

export type HealthCheckFunction = () => Promise<HealthCheckResult>;

class HealthCheckService extends EventEmitter {
  private healthChecks: Map<string, HealthCheckFunction> = new Map();
  private healthResults: Map<string, HealthCheckResult> = new Map();
  private dependencies: Map<string, DependencyHealth> = new Map();
  private config: HealthCheckConfig;
  private logger = getLogger();
  private performanceMonitor = getPerformanceMonitor();
  private checkInterval: NodeJS.Timeout | null = null;
  private startTime = Date.now();

  constructor(config: Partial<HealthCheckConfig> = {}) {
    super();
    
    this.config = {
      interval: 30000, // 30 seconds
      timeout: 5000,   // 5 seconds
      retries: 3,
      enabled: true,
      ...config
    };

    if (this.config.enabled) {
      this.startHealthChecks();
    }

    // Register default system health checks
    this.registerDefaultHealthChecks();

    // Graceful shutdown
    process.on('SIGINT', () => this.shutdown());
    process.on('SIGTERM', () => this.shutdown());

    this.logger.info('HealthCheckService initialized', { config: this.config }, 'health-check');
  }

  // Register a health check function
  registerHealthCheck(name: string, checkFunction: HealthCheckFunction): void {
    this.healthChecks.set(name, checkFunction);
    this.logger.info(`Health check registered: ${name}`, {}, 'health-check');
  }

  // Unregister a health check
  unregisterHealthCheck(name: string): void {
    this.healthChecks.delete(name);
    this.healthResults.delete(name);
    this.logger.info(`Health check unregistered: ${name}`, {}, 'health-check');
  }

  // Register a dependency
  registerDependency(name: string, dependency: Omit<DependencyHealth, 'lastCheck'>): void {
    this.dependencies.set(name, {
      ...dependency,
      lastCheck: new Date()
    });
    this.logger.info(`Dependency registered: ${name}`, { dependency }, 'health-check');
  }

  // Run a specific health check
  async runHealthCheck(name: string): Promise<HealthCheckResult> {
    const checkFunction = this.healthChecks.get(name);
    if (!checkFunction) {
      throw new Error(`Health check not found: ${name}`);
    }

    const startTime = Date.now();
    let result: HealthCheckResult;

    try {
      // Run with timeout
      result = await this.withTimeout(checkFunction(), this.config.timeout);
      result.responseTime = Date.now() - startTime;
      
      this.performanceMonitor.recordHistogram('health_check_duration', result.responseTime, { check: name });
      this.performanceMonitor.incrementCounter('health_check_success_total', 1, { check: name });
      
    } catch (error) {
      result = {
        name,
        status: 'unhealthy',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date(),
        responseTime: Date.now() - startTime,
        error: error instanceof Error ? {
          name: error.name,
          message: error.message,
          stack: error.stack
        } : undefined
      };
      
      this.performanceMonitor.incrementCounter('health_check_error_total', 1, { check: name });
    }

    this.healthResults.set(name, result);
    this.emit('healthCheckResult', result);

    if (result.status !== 'healthy') {
      this.logger.warn(`Health check failed: ${name}`, { result }, 'health-check');
    } else {
      this.logger.debug(`Health check passed: ${name}`, { result }, 'health-check');
    }

    return result;
  }

  // Run all health checks
  async runAllHealthChecks(): Promise<HealthCheckResult[]> {
    const results: HealthCheckResult[] = [];
    
    for (const [name] of this.healthChecks) {
      try {
        const result = await this.runHealthCheck(name);
        results.push(result);
      } catch (error) {
        this.logger.error(`Failed to run health check: ${name}`, error as Error, {}, 'health-check');
      }
    }

    return results;
  }

  // Get health status for a specific service
  getServiceHealth(serviceName: string): ServiceHealth | null {
    const result = this.healthResults.get(serviceName);
    if (!result) {
      return null;
    }

    // Calculate metrics
    const successCount = this.performanceMonitor.getAllMetrics().counters[`health_check_success_total{check="${serviceName}"}`] || 0;
    const errorCount = this.performanceMonitor.getAllMetrics().counters[`health_check_error_total{check="${serviceName}"}`] || 0;
    const totalChecks = successCount + errorCount;
    const availability = totalChecks > 0 ? (successCount / totalChecks) * 100 : 100;

    return {
      name: serviceName,
      status: result.status,
      lastCheck: result.timestamp,
      responseTime: result.responseTime,
      uptime: Date.now() - this.startTime,
      errorCount,
      successCount,
      availability,
      dependencies: Array.from(this.dependencies.values())
    };
  }

  // Get overall system health
  async getSystemHealth(): Promise<SystemHealth> {
    const services: ServiceHealth[] = [];
    const dependencies = Array.from(this.dependencies.values());
    
    // Collect service health
    for (const [name] of this.healthChecks) {
      const serviceHealth = this.getServiceHealth(name);
      if (serviceHealth) {
        services.push(serviceHealth);
      }
    }

    // Get resource health
    const resources = await this.getResourceHealth();

    // Determine overall status
    const overallStatus = this.calculateOverallStatus(services, dependencies, resources);

    return {
      status: overallStatus,
      timestamp: new Date(),
      uptime: Date.now() - this.startTime,
      services,
      dependencies,
      resources
    };
  }

  // Get resource health
  private async getResourceHealth(): Promise<SystemHealth['resources']> {
    const totalMemory = require('os').totalmem();
    const freeMemory = require('os').freemem();
    const usedMemory = totalMemory - freeMemory;
    const memoryPercentage = (usedMemory / totalMemory) * 100;

    // Get CPU usage from performance monitor
    const cpuMetrics = this.performanceMonitor.getAllMetrics().gauges;
    const cpuUsage = cpuMetrics['system_cpu_usage_percent'] || 0;

    return {
      memory: {
        used: usedMemory,
        total: totalMemory,
        percentage: memoryPercentage,
        status: this.getResourceStatus(memoryPercentage, 80, 90) // 80% degraded, 90% unhealthy
      },
      cpu: {
        usage: cpuUsage,
        status: this.getResourceStatus(cpuUsage, 70, 85) // 70% degraded, 85% unhealthy
      },
      disk: {
        usage: 0, // Would need platform-specific implementation
        status: 'healthy' as HealthStatus
      }
    };
  }

  private getResourceStatus(usage: number, degradedThreshold: number, unhealthyThreshold: number): HealthStatus {
    if (usage >= unhealthyThreshold) return 'unhealthy';
    if (usage >= degradedThreshold) return 'degraded';
    return 'healthy';
  }

  private calculateOverallStatus(
    services: ServiceHealth[], 
    dependencies: DependencyHealth[], 
    resources: SystemHealth['resources']
  ): HealthStatus {
    // Check critical dependencies first
    const criticalDependencies = dependencies.filter(d => d.required);
    const unhealthyCriticalDeps = criticalDependencies.filter(d => d.status === 'unhealthy');
    
    if (unhealthyCriticalDeps.length > 0) {
      return 'unhealthy';
    }

    // Check resources
    if (resources.memory.status === 'unhealthy' || resources.cpu.status === 'unhealthy') {
      return 'unhealthy';
    }

    // Check services
    const unhealthyServices = services.filter(s => s.status === 'unhealthy');
    const degradedServices = services.filter(s => s.status === 'degraded');

    if (unhealthyServices.length > 0) {
      return 'unhealthy';
    }

    if (degradedServices.length > 0 || resources.memory.status === 'degraded' || resources.cpu.status === 'degraded') {
      return 'degraded';
    }

    return 'healthy';
  }

  // Register default system health checks
  private registerDefaultHealthChecks(): void {
    // Memory health check
    this.registerHealthCheck('memory', async () => {
      const memoryUsage = process.memoryUsage();
      const totalMemory = require('os').totalmem();
      const usedPercentage = (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100;
      
      let status: HealthStatus = 'healthy';
      let message = `Memory usage: ${usedPercentage.toFixed(2)}%`;
      
      if (usedPercentage > 90) {
        status = 'unhealthy';
        message += ' - Critical memory usage';
      } else if (usedPercentage > 80) {
        status = 'degraded';
        message += ' - High memory usage';
      }

      return {
        name: 'memory',
        status,
        message,
        timestamp: new Date(),
        responseTime: 0,
        details: {
          heapUsed: memoryUsage.heapUsed,
          heapTotal: memoryUsage.heapTotal,
          rss: memoryUsage.rss,
          external: memoryUsage.external,
          usedPercentage
        }
      };
    });

    // Event loop lag check
    this.registerHealthCheck('event_loop', async () => {
      const start = process.hrtime.bigint();
      
      return new Promise<HealthCheckResult>((resolve) => {
        setImmediate(() => {
          const lag = Number(process.hrtime.bigint() - start) / 1000000; // Convert to milliseconds
          
          let status: HealthStatus = 'healthy';
          let message = `Event loop lag: ${lag.toFixed(2)}ms`;
          
          if (lag > 100) {
            status = 'unhealthy';
            message += ' - Critical event loop lag';
          } else if (lag > 50) {
            status = 'degraded';
            message += ' - High event loop lag';
          }

          resolve({
            name: 'event_loop',
            status,
            message,
            timestamp: new Date(),
            responseTime: lag,
            details: { lag }
          });
        });
      });
    });

    // Process uptime check
    this.registerHealthCheck('uptime', async () => {
      const uptime = process.uptime();
      
      return {
        name: 'uptime',
        status: 'healthy',
        message: `Process uptime: ${Math.floor(uptime)}s`,
        timestamp: new Date(),
        responseTime: 0,
        details: { uptime }
      };
    });
  }

  // Start periodic health checks
  private startHealthChecks(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }

    this.checkInterval = setInterval(async () => {
      try {
        await this.runAllHealthChecks();
      } catch (error) {
        this.logger.error('Failed to run periodic health checks', error as Error, {}, 'health-check');
      }
    }, this.config.interval);

    this.logger.info(`Health checks started with ${this.config.interval}ms interval`, {}, 'health-check');
  }

  // Stop periodic health checks
  stopHealthChecks(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
      this.logger.info('Health checks stopped', {}, 'health-check');
    }
  }

  // Utility method to run function with timeout
  private async withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(`Health check timeout after ${timeoutMs}ms`)), timeoutMs);
    });

    return Promise.race([promise, timeoutPromise]);
  }

  // Get health check configuration
  getConfig(): HealthCheckConfig {
    return { ...this.config };
  }

  // Update configuration
  updateConfig(newConfig: Partial<HealthCheckConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    if (this.config.enabled && !this.checkInterval) {
      this.startHealthChecks();
    } else if (!this.config.enabled && this.checkInterval) {
      this.stopHealthChecks();
    } else if (this.checkInterval) {
      // Restart with new interval
      this.startHealthChecks();
    }

    this.logger.info('Health check configuration updated', { config: this.config }, 'health-check');
  }

  // Get all health check results
  getAllResults(): HealthCheckResult[] {
    return Array.from(this.healthResults.values());
  }

  // Check if system is ready (all critical dependencies healthy)
  async isReady(): Promise<boolean> {
    const systemHealth = await this.getSystemHealth();
    const criticalDependencies = systemHealth.dependencies.filter(d => d.required);
    
    return criticalDependencies.every(d => d.status === 'healthy') &&
           systemHealth.resources.memory.status !== 'unhealthy' &&
           systemHealth.resources.cpu.status !== 'unhealthy';
  }

  // Check if system is alive (basic functionality working)
  async isAlive(): Promise<boolean> {
    try {
      // Run basic health checks
      await this.runHealthCheck('memory');
      await this.runHealthCheck('event_loop');
      return true;
    } catch (error) {
      return false;
    }
  }

  private shutdown(): void {
    this.stopHealthChecks();
    this.logger.info('HealthCheckService shutdown complete', {}, 'health-check');
  }
}

// Singleton instance
let healthCheckServiceInstance: HealthCheckService | null = null;

export function createHealthCheckService(config?: Partial<HealthCheckConfig>): HealthCheckService {
  if (healthCheckServiceInstance) {
    return healthCheckServiceInstance;
  }
  
  healthCheckServiceInstance = new HealthCheckService(config);
  return healthCheckServiceInstance;
}

export function getHealthCheckService(): HealthCheckService {
  if (!healthCheckServiceInstance) {
    throw new Error('HealthCheckService not initialized. Call createHealthCheckService() first.');
  }
  return healthCheckServiceInstance;
}

// For testing purposes
export function resetHealthCheckService(): void {
  if (healthCheckServiceInstance) {
    healthCheckServiceInstance['shutdown']();
  }
  healthCheckServiceInstance = null;
}

export { HealthCheckService };