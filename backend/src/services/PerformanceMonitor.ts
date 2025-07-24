import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

interface PerformanceMetric {
  timestamp: Date;
  service: string;
  operation: string;
  duration: number; // milliseconds
  success: boolean;
  error?: string;
  metadata?: Record<string, any>;
}

interface ServiceMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  minResponseTime: number;
  maxResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  errorRate: number;
  requestsPerMinute: number;
  lastActivity: Date;
}

interface SystemMetrics {
  timestamp: Date;
  cpu: {
    usage: number; // percentage
    loadAverage: number[];
  };
  memory: {
    used: number; // bytes
    free: number; // bytes
    total: number; // bytes
    usage: number; // percentage
  };
  process: {
    pid: number;
    uptime: number; // seconds
    memoryUsage: NodeJS.MemoryUsage;
    cpuUsage: NodeJS.CpuUsage;
  };
}

interface AlertRule {
  id: string;
  name: string;
  condition: (metrics: ServiceMetrics | SystemMetrics) => boolean;
  severity: 'low' | 'medium' | 'high' | 'critical';
  cooldown: number; // milliseconds
  lastTriggered?: Date;
  enabled: boolean;
}

interface Alert {
  id: string;
  ruleId: string;
  timestamp: Date;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  data: any;
  resolved: boolean;
  resolvedAt?: Date;
}

export class PerformanceMonitor {
  private metrics: PerformanceMetric[] = [];
  private systemMetrics: SystemMetrics[] = [];
  private alerts: Alert[] = [];
  private alertRules: AlertRule[] = [];
  private maxMetricsHistory: number = 10000;
  private maxSystemMetricsHistory: number = 1000;
  private maxAlertsHistory: number = 1000;
  private metricsCollectionInterval?: NodeJS.Timeout;
  private persistenceInterval?: NodeJS.Timeout;
  private persistencePath?: string;
  private enablePersistence: boolean = false;
  private startTime: Date = new Date();

  constructor(options: {
    maxMetricsHistory?: number;
    maxSystemMetricsHistory?: number;
    maxAlertsHistory?: number;
    persistencePath?: string;
    enablePersistence?: boolean;
  } = {}) {
    this.maxMetricsHistory = options.maxMetricsHistory || 10000;
    this.maxSystemMetricsHistory = options.maxSystemMetricsHistory || 1000;
    this.maxAlertsHistory = options.maxAlertsHistory || 1000;
    this.persistencePath = options.persistencePath;
    this.enablePersistence = options.enablePersistence || false;

    // Initialize default alert rules
    this.initializeDefaultAlertRules();

    // Start system metrics collection
    this.startSystemMetricsCollection();

    // Start persistence if enabled
    if (this.enablePersistence && this.persistencePath) {
      this.startPersistence();
      this.loadPersistedData().catch(error => {
        console.warn('Failed to load persisted performance data:', error);
      });
    }
  }

  /**
   * Record a performance metric
   */
  recordMetric(
    service: string,
    operation: string,
    duration: number,
    success: boolean,
    error?: string,
    metadata?: Record<string, any>
  ): void {
    const metric: PerformanceMetric = {
      timestamp: new Date(),
      service,
      operation,
      duration,
      success,
      error,
      metadata
    };

    this.metrics.push(metric);

    // Trim metrics if we exceed the limit
    if (this.metrics.length > this.maxMetricsHistory) {
      this.metrics = this.metrics.slice(-this.maxMetricsHistory);
    }

    // Check alert rules
    this.checkAlertRules();
  }

  /**
   * Create a timer for measuring operation duration
   */
  startTimer(service: string, operation: string, metadata?: Record<string, any>) {
    const startTime = Date.now();
    
    return {
      end: (success: boolean = true, error?: string) => {
        const duration = Date.now() - startTime;
        this.recordMetric(service, operation, duration, success, error, metadata);
        return duration;
      }
    };
  }

  /**
   * Get metrics for a specific service
   */
  getServiceMetrics(service: string, timeWindow?: number): ServiceMetrics {
    const cutoffTime = timeWindow ? new Date(Date.now() - timeWindow) : new Date(0);
    const serviceMetrics = this.metrics.filter(
      m => m.service === service && m.timestamp >= cutoffTime
    );

    if (serviceMetrics.length === 0) {
      return {
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        averageResponseTime: 0,
        minResponseTime: 0,
        maxResponseTime: 0,
        p95ResponseTime: 0,
        p99ResponseTime: 0,
        errorRate: 0,
        requestsPerMinute: 0,
        lastActivity: new Date(0)
      };
    }

    const durations = serviceMetrics.map(m => m.duration).sort((a, b) => a - b);
    const successfulRequests = serviceMetrics.filter(m => m.success).length;
    const failedRequests = serviceMetrics.length - successfulRequests;
    
    // Calculate percentiles
    const p95Index = Math.floor(durations.length * 0.95);
    const p99Index = Math.floor(durations.length * 0.99);

    // Calculate requests per minute
    const timeSpanMinutes = timeWindow ? timeWindow / (60 * 1000) : 
      (Date.now() - serviceMetrics[0].timestamp.getTime()) / (60 * 1000);
    const requestsPerMinute = timeSpanMinutes > 0 ? serviceMetrics.length / timeSpanMinutes : 0;

    return {
      totalRequests: serviceMetrics.length,
      successfulRequests,
      failedRequests,
      averageResponseTime: durations.reduce((sum, d) => sum + d, 0) / durations.length,
      minResponseTime: durations[0],
      maxResponseTime: durations[durations.length - 1],
      p95ResponseTime: durations[p95Index] || 0,
      p99ResponseTime: durations[p99Index] || 0,
      errorRate: failedRequests / serviceMetrics.length,
      requestsPerMinute,
      lastActivity: serviceMetrics[serviceMetrics.length - 1].timestamp
    };
  }

  /**
   * Get all service names that have metrics
   */
  getServices(): string[] {
    const services = new Set(this.metrics.map(m => m.service));
    return Array.from(services);
  }

  /**
   * Get system metrics
   */
  getCurrentSystemMetrics(): SystemMetrics {
    const memoryUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;

    return {
      timestamp: new Date(),
      cpu: {
        usage: this.calculateCpuUsage(cpuUsage),
        loadAverage: os.loadavg()
      },
      memory: {
        used: usedMemory,
        free: freeMemory,
        total: totalMemory,
        usage: (usedMemory / totalMemory) * 100
      },
      process: {
        pid: process.pid,
        uptime: process.uptime(),
        memoryUsage,
        cpuUsage
      }
    };
  }

  /**
   * Get historical system metrics
   */
  getSystemMetricsHistory(timeWindow?: number): SystemMetrics[] {
    if (!timeWindow) {
      return [...this.systemMetrics];
    }

    const cutoffTime = new Date(Date.now() - timeWindow);
    return this.systemMetrics.filter(m => m.timestamp >= cutoffTime);
  }

  /**
   * Get performance dashboard data
   */
  getDashboardData(timeWindow: number = 60 * 60 * 1000): {
    services: Record<string, ServiceMetrics>;
    systemMetrics: SystemMetrics;
    alerts: Alert[];
    uptime: number;
    overview: {
      totalRequests: number;
      totalErrors: number;
      averageResponseTime: number;
      activeServices: number;
    };
  } {
    const services: Record<string, ServiceMetrics> = {};
    const serviceNames = this.getServices();
    
    let totalRequests = 0;
    let totalErrors = 0;
    let totalResponseTime = 0;
    let totalResponseCount = 0;

    for (const service of serviceNames) {
      const metrics = this.getServiceMetrics(service, timeWindow);
      services[service] = metrics;
      
      totalRequests += metrics.totalRequests;
      totalErrors += metrics.failedRequests;
      totalResponseTime += metrics.averageResponseTime * metrics.totalRequests;
      totalResponseCount += metrics.totalRequests;
    }

    const recentAlerts = this.alerts
      .filter(a => a.timestamp.getTime() > Date.now() - timeWindow)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, 50);

    return {
      services,
      systemMetrics: this.getCurrentSystemMetrics(),
      alerts: recentAlerts,
      uptime: Date.now() - this.startTime.getTime(),
      overview: {
        totalRequests,
        totalErrors,
        averageResponseTime: totalResponseCount > 0 ? totalResponseTime / totalResponseCount : 0,
        activeServices: serviceNames.length
      }
    };
  }

  /**
   * Add custom alert rule
   */
  addAlertRule(rule: Omit<AlertRule, 'id'>): string {
    const id = `rule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.alertRules.push({ ...rule, id });
    return id;
  }

  /**
   * Remove alert rule
   */
  removeAlertRule(ruleId: string): boolean {
    const index = this.alertRules.findIndex(r => r.id === ruleId);
    if (index !== -1) {
      this.alertRules.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * Get all alert rules
   */
  getAlertRules(): AlertRule[] {
    return [...this.alertRules];
  }

  /**
   * Get recent alerts
   */
  getAlerts(limit: number = 100, unresolved: boolean = false): Alert[] {
    let alerts = [...this.alerts];
    
    if (unresolved) {
      alerts = alerts.filter(a => !a.resolved);
    }
    
    return alerts
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  /**
   * Resolve an alert
   */
  resolveAlert(alertId: string): boolean {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert && !alert.resolved) {
      alert.resolved = true;
      alert.resolvedAt = new Date();
      return true;
    }
    return false;
  }

  /**
   * Initialize default alert rules
   */
  private initializeDefaultAlertRules(): void {
    // High error rate alert
    this.addAlertRule({
      name: 'High Error Rate',
      condition: (metrics) => {
        if ('errorRate' in metrics) {
          return metrics.errorRate > 0.1; // 10% error rate
        }
        return false;
      },
      severity: 'high',
      cooldown: 5 * 60 * 1000, // 5 minutes
      enabled: true
    });

    // Slow response time alert
    this.addAlertRule({
      name: 'Slow Response Time',
      condition: (metrics) => {
        if ('averageResponseTime' in metrics) {
          return metrics.averageResponseTime > 10000; // 10 seconds
        }
        return false;
      },
      severity: 'medium',
      cooldown: 5 * 60 * 1000,
      enabled: true
    });

    // High memory usage alert
    this.addAlertRule({
      name: 'High Memory Usage',
      condition: (metrics) => {
        if ('memory' in metrics) {
          return metrics.memory.usage > 90; // 90% memory usage
        }
        return false;
      },
      severity: 'high',
      cooldown: 10 * 60 * 1000, // 10 minutes
      enabled: true
    });

    // High CPU usage alert
    this.addAlertRule({
      name: 'High CPU Usage',
      condition: (metrics) => {
        if ('cpu' in metrics) {
          return metrics.cpu.usage > 80; // 80% CPU usage
        }
        return false;
      },
      severity: 'medium',
      cooldown: 10 * 60 * 1000,
      enabled: true
    });
  }

  /**
   * Check alert rules against current metrics
   */
  private checkAlertRules(): void {
    const now = new Date();
    
    // Check service metrics alerts
    for (const service of this.getServices()) {
      const metrics = this.getServiceMetrics(service, 5 * 60 * 1000); // Last 5 minutes
      
      for (const rule of this.alertRules) {
        if (!rule.enabled) continue;
        
        // Check cooldown
        if (rule.lastTriggered && 
            now.getTime() - rule.lastTriggered.getTime() < rule.cooldown) {
          continue;
        }
        
        if (rule.condition(metrics)) {
          this.triggerAlert(rule, `Service: ${service}`, metrics);
        }
      }
    }
    
    // Check system metrics alerts
    const systemMetrics = this.getCurrentSystemMetrics();
    for (const rule of this.alertRules) {
      if (!rule.enabled) continue;
      
      if (rule.lastTriggered && 
          now.getTime() - rule.lastTriggered.getTime() < rule.cooldown) {
        continue;
      }
      
      if (rule.condition(systemMetrics)) {
        this.triggerAlert(rule, 'System', systemMetrics);
      }
    }
  }

  /**
   * Trigger an alert
   */
  private triggerAlert(rule: AlertRule, context: string, data: any): void {
    const alertId = `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const alert: Alert = {
      id: alertId,
      ruleId: rule.id,
      timestamp: new Date(),
      severity: rule.severity,
      message: `${rule.name} - ${context}`,
      data,
      resolved: false
    };
    
    this.alerts.push(alert);
    rule.lastTriggered = new Date();
    
    // Trim alerts if we exceed the limit
    if (this.alerts.length > this.maxAlertsHistory) {
      this.alerts = this.alerts.slice(-this.maxAlertsHistory);
    }
    
    console.warn(`ALERT [${rule.severity.toUpperCase()}]: ${alert.message}`);
  }

  /**
   * Calculate CPU usage percentage
   */
  private calculateCpuUsage(cpuUsage: NodeJS.CpuUsage): number {
    // This is a simplified calculation
    // In a real implementation, you would track CPU usage over time
    const totalUsage = cpuUsage.user + cpuUsage.system;
    return Math.min(100, (totalUsage / 1000000) * 100); // Convert microseconds to percentage
  }

  /**
   * Start system metrics collection
   */
  private startSystemMetricsCollection(): void {
    this.metricsCollectionInterval = setInterval(() => {
      const systemMetrics = this.getCurrentSystemMetrics();
      this.systemMetrics.push(systemMetrics);
      
      // Trim system metrics if we exceed the limit
      if (this.systemMetrics.length > this.maxSystemMetricsHistory) {
        this.systemMetrics = this.systemMetrics.slice(-this.maxSystemMetricsHistory);
      }
    }, 30000); // Collect every 30 seconds
  }

  /**
   * Start persistence
   */
  private startPersistence(): void {
    this.persistenceInterval = setInterval(() => {
      this.persistData().catch(error => {
        console.error('Failed to persist performance data:', error);
      });
    }, 5 * 60 * 1000); // Persist every 5 minutes
  }

  /**
   * Persist data to disk
   */
  private async persistData(): Promise<void> {
    if (!this.persistencePath) return;

    try {
      const data = {
        metrics: this.metrics.slice(-1000), // Keep last 1000 metrics
        systemMetrics: this.systemMetrics.slice(-100), // Keep last 100 system metrics
        alerts: this.alerts.slice(-100), // Keep last 100 alerts
        alertRules: this.alertRules,
        startTime: this.startTime,
        timestamp: new Date()
      };

      const dir = path.dirname(this.persistencePath);
      await fs.mkdir(dir, { recursive: true });

      const tempPath = `${this.persistencePath}.tmp`;
      await fs.writeFile(tempPath, JSON.stringify(data, null, 2));
      await fs.rename(tempPath, this.persistencePath);

      console.log('Performance data persisted successfully');
    } catch (error) {
      console.error('Failed to persist performance data:', error);
      throw error;
    }
  }

  /**
   * Load persisted data from disk
   */
  private async loadPersistedData(): Promise<void> {
    if (!this.persistencePath) return;

    try {
      const data = await fs.readFile(this.persistencePath, 'utf8');
      const parsedData = JSON.parse(data);

      // Restore metrics
      if (parsedData.metrics) {
        this.metrics = parsedData.metrics.map((m: any) => ({
          ...m,
          timestamp: new Date(m.timestamp)
        }));
      }

      // Restore system metrics
      if (parsedData.systemMetrics) {
        this.systemMetrics = parsedData.systemMetrics.map((m: any) => ({
          ...m,
          timestamp: new Date(m.timestamp)
        }));
      }

      // Restore alerts
      if (parsedData.alerts) {
        this.alerts = parsedData.alerts.map((a: any) => ({
          ...a,
          timestamp: new Date(a.timestamp),
          resolvedAt: a.resolvedAt ? new Date(a.resolvedAt) : undefined
        }));
      }

      // Restore alert rules
      if (parsedData.alertRules) {
        this.alertRules = parsedData.alertRules.map((r: any) => ({
          ...r,
          lastTriggered: r.lastTriggered ? new Date(r.lastTriggered) : undefined
        }));
      }

      // Restore start time
      if (parsedData.startTime) {
        this.startTime = new Date(parsedData.startTime);
      }

      console.log('Performance data loaded successfully');
    } catch (error) {
      if ((error as any).code === 'ENOENT') {
        console.log('No persisted performance data found, starting fresh');
      } else {
        console.error('Failed to load persisted performance data:', error);
        throw error;
      }
    }
  }

  /**
   * Shutdown the performance monitor
   */
  async shutdown(): Promise<void> {
    console.log('Performance monitor shutting down...');

    // Stop intervals
    if (this.metricsCollectionInterval) {
      clearInterval(this.metricsCollectionInterval);
      this.metricsCollectionInterval = undefined;
    }

    if (this.persistenceInterval) {
      clearInterval(this.persistenceInterval);
      this.persistenceInterval = undefined;
    }

    // Final persistence
    if (this.enablePersistence && this.persistencePath) {
      try {
        await this.persistData();
        console.log('Final performance data persistence completed');
      } catch (error) {
        console.error('Failed to persist performance data during shutdown:', error);
      }
    }

    console.log('Performance monitor shutdown complete');
  }
}

// Global performance monitor instance
export const globalPerformanceMonitor = new PerformanceMonitor({
  maxMetricsHistory: 10000,
  maxSystemMetricsHistory: 1000,
  maxAlertsHistory: 1000,
  persistencePath: path.join(process.cwd(), 'temp', 'performance-data.json'),
  enablePersistence: true
});