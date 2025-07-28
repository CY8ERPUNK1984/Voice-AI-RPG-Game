import { EventEmitter } from 'events';
import { getLogger } from './Logger';

export interface MetricValue {
  value: number;
  timestamp: Date;
  labels?: Record<string, string>;
}

export interface MetricSummary {
  count: number;
  sum: number;
  min: number;
  max: number;
  avg: number;
  p50: number;
  p95: number;
  p99: number;
}

export interface ResourceMetrics {
  cpu: {
    usage: number; // percentage
    loadAverage: number[];
  };
  memory: {
    used: number;
    free: number;
    total: number;
    percentage: number;
    heapUsed: number;
    heapTotal: number;
  };
  disk: {
    used: number;
    free: number;
    total: number;
    percentage: number;
  };
  network: {
    bytesIn: number;
    bytesOut: number;
    connectionsActive: number;
  };
}

export interface ServiceMetrics {
  name: string;
  responseTime: MetricSummary;
  throughput: number; // requests per second
  errorRate: number; // percentage
  availability: number; // percentage
  lastUpdate: Date;
}

export interface AlertRule {
  id: string;
  name: string;
  metric: string;
  condition: 'gt' | 'lt' | 'eq' | 'gte' | 'lte';
  threshold: number;
  duration: number; // seconds
  enabled: boolean;
  labels?: Record<string, string>;
}

export interface Alert {
  id: string;
  rule: AlertRule;
  value: number;
  timestamp: Date;
  status: 'firing' | 'resolved';
  message: string;
}

class PerformanceMonitor extends EventEmitter {
  private metrics: Map<string, MetricValue[]> = new Map();
  private counters: Map<string, number> = new Map();
  private gauges: Map<string, number> = new Map();
  private histograms: Map<string, number[]> = new Map();
  private alertRules: Map<string, AlertRule> = new Map();
  private activeAlerts: Map<string, Alert> = new Map();
  private logger = getLogger();
  private metricsRetentionMs = 24 * 60 * 60 * 1000; // 24 hours
  private cleanupInterval: NodeJS.Timeout;
  private resourceMonitorInterval: NodeJS.Timeout;
  private alertCheckInterval: NodeJS.Timeout;

  constructor() {
    super();
    
    // Start background tasks
    this.cleanupInterval = setInterval(() => this.cleanupOldMetrics(), 60000); // Every minute
    this.resourceMonitorInterval = setInterval(() => this.collectResourceMetrics(), 5000); // Every 5 seconds
    this.alertCheckInterval = setInterval(() => this.checkAlerts(), 10000); // Every 10 seconds

    // Graceful shutdown
    process.on('SIGINT', () => this.shutdown());
    process.on('SIGTERM', () => this.shutdown());

    this.logger.info('PerformanceMonitor initialized', {}, 'performance-monitor');
  }

  // Counter metrics (monotonically increasing)
  incrementCounter(name: string, value: number = 1, labels?: Record<string, string>): void {
    const key = this.getMetricKey(name, labels);
    const current = this.counters.get(key) || 0;
    this.counters.set(key, current + value);
    
    this.recordMetric(name, current + value, labels);
    this.logger.debug(`Counter incremented: ${name}`, { value, labels }, 'performance-monitor');
  }

  // Gauge metrics (can go up or down)
  setGauge(name: string, value: number, labels?: Record<string, string>): void {
    const key = this.getMetricKey(name, labels);
    this.gauges.set(key, value);
    
    this.recordMetric(name, value, labels);
    this.logger.debug(`Gauge set: ${name}`, { value, labels }, 'performance-monitor');
  }

  // Histogram metrics (for response times, etc.)
  recordHistogram(name: string, value: number, labels?: Record<string, string>): void {
    const key = this.getMetricKey(name, labels);
    const values = this.histograms.get(key) || [];
    values.push(value);
    this.histograms.set(key, values);
    
    this.recordMetric(name, value, labels);
    this.logger.debug(`Histogram recorded: ${name}`, { value, labels }, 'performance-monitor');
  }

  // Timer utility for measuring durations
  startTimer(name: string, labels?: Record<string, string>): () => void {
    const startTime = Date.now();
    
    return () => {
      const duration = Date.now() - startTime;
      this.recordHistogram(name, duration, labels);
      return duration;
    };
  }

  // Async timer wrapper
  async timeAsync<T>(
    name: string,
    fn: () => Promise<T>,
    labels?: Record<string, string>
  ): Promise<T> {
    const endTimer = this.startTimer(name, labels);
    
    try {
      const result = await fn();
      endTimer();
      return result;
    } catch (error) {
      endTimer();
      this.incrementCounter(`${name}_errors`, 1, labels);
      throw error;
    }
  }

  // Service-specific metrics
  recordServiceMetrics(serviceName: string, responseTime: number, success: boolean): void {
    const labels = { service: serviceName };
    
    this.recordHistogram('service_response_time', responseTime, labels);
    this.incrementCounter('service_requests_total', 1, labels);
    
    if (!success) {
      this.incrementCounter('service_errors_total', 1, labels);
    }
  }

  // Resource metrics collection
  private async collectResourceMetrics(): Promise<void> {
    try {
      const metrics = await this.getResourceMetrics();
      
      // CPU metrics
      this.setGauge('system_cpu_usage_percent', metrics.cpu.usage);
      this.setGauge('system_load_average_1m', metrics.cpu.loadAverage[0]);
      this.setGauge('system_load_average_5m', metrics.cpu.loadAverage[1]);
      this.setGauge('system_load_average_15m', metrics.cpu.loadAverage[2]);
      
      // Memory metrics
      this.setGauge('system_memory_used_bytes', metrics.memory.used);
      this.setGauge('system_memory_free_bytes', metrics.memory.free);
      this.setGauge('system_memory_usage_percent', metrics.memory.percentage);
      this.setGauge('process_heap_used_bytes', metrics.memory.heapUsed);
      this.setGauge('process_heap_total_bytes', metrics.memory.heapTotal);
      
      // Network metrics
      this.setGauge('network_connections_active', metrics.network.connectionsActive);
      
    } catch (error) {
      this.logger.error('Failed to collect resource metrics', error as Error, {}, 'performance-monitor');
    }
  }

  // Get current resource metrics
  private async getResourceMetrics(): Promise<ResourceMetrics> {
    const os = await import('os');
    
    const memoryUsage = process.memoryUsage();
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;
    
    return {
      cpu: {
        usage: await this.getCpuUsage(),
        loadAverage: os.loadavg()
      },
      memory: {
        used: usedMemory,
        free: freeMemory,
        total: totalMemory,
        percentage: (usedMemory / totalMemory) * 100,
        heapUsed: memoryUsage.heapUsed,
        heapTotal: memoryUsage.heapTotal
      },
      disk: {
        used: 0, // Would need platform-specific implementation
        free: 0,
        total: 0,
        percentage: 0
      },
      network: {
        bytesIn: 0, // Would need to track from network interfaces
        bytesOut: 0,
        connectionsActive: 0 // Would need to track active connections
      }
    };
  }

  // CPU usage calculation
  private async getCpuUsage(): Promise<number> {
    return new Promise((resolve) => {
      const startMeasure = this.cpuAverage();
      
      setTimeout(() => {
        const endMeasure = this.cpuAverage();
        const idleDifference = endMeasure.idle - startMeasure.idle;
        const totalDifference = endMeasure.total - startMeasure.total;
        const percentageCPU = 100 - ~~(100 * idleDifference / totalDifference);
        resolve(percentageCPU);
      }, 100);
    });
  }

  private cpuAverage(): { idle: number; total: number } {
    const os = require('os');
    const cpus = os.cpus();
    
    let totalIdle = 0;
    let totalTick = 0;
    
    for (const cpu of cpus) {
      for (const type in cpu.times) {
        totalTick += cpu.times[type];
      }
      totalIdle += cpu.times.idle;
    }
    
    return {
      idle: totalIdle / cpus.length,
      total: totalTick / cpus.length
    };
  }

  // Get metric summary
  getMetricSummary(name: string, labels?: Record<string, string>): MetricSummary | null {
    const key = this.getMetricKey(name, labels);
    const values = this.histograms.get(key);
    
    if (!values || values.length === 0) {
      return null;
    }
    
    const sorted = [...values].sort((a, b) => a - b);
    const sum = sorted.reduce((a, b) => a + b, 0);
    
    return {
      count: sorted.length,
      sum,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      avg: sum / sorted.length,
      p50: this.percentile(sorted, 0.5),
      p95: this.percentile(sorted, 0.95),
      p99: this.percentile(sorted, 0.99)
    };
  }

  // Get service metrics
  getServiceMetrics(serviceName: string): ServiceMetrics | null {
    const requestsKey = this.getMetricKey('service_requests_total', { service: serviceName });
    const errorsKey = this.getMetricKey('service_errors_total', { service: serviceName });
    
    const responseTimeSummary = this.getMetricSummary('service_response_time', { service: serviceName });
    const totalRequests = this.counters.get(requestsKey) || 0;
    const totalErrors = this.counters.get(errorsKey) || 0;
    
    if (!responseTimeSummary || totalRequests === 0) {
      return null;
    }
    
    // Calculate throughput (requests per second over last minute)
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    const recentMetrics = this.metrics.get(requestsKey)?.filter(m => m.timestamp.getTime() > oneMinuteAgo) || [];
    const throughput = recentMetrics.length / 60;
    
    return {
      name: serviceName,
      responseTime: responseTimeSummary,
      throughput,
      errorRate: totalRequests > 0 ? (totalErrors / totalRequests) * 100 : 0,
      availability: totalRequests > 0 ? ((totalRequests - totalErrors) / totalRequests) * 100 : 100,
      lastUpdate: new Date()
    };
  }

  // Alert management
  addAlertRule(rule: AlertRule): void {
    this.alertRules.set(rule.id, rule);
    this.logger.info(`Alert rule added: ${rule.name}`, { rule }, 'performance-monitor');
  }

  removeAlertRule(ruleId: string): void {
    this.alertRules.delete(ruleId);
    this.activeAlerts.delete(ruleId);
    this.logger.info(`Alert rule removed: ${ruleId}`, {}, 'performance-monitor');
  }

  getAlertRules(): AlertRule[] {
    return Array.from(this.alertRules.values());
  }

  getActiveAlerts(): Alert[] {
    return Array.from(this.activeAlerts.values()).filter(alert => alert.status === 'firing');
  }

  // Check alerts
  private checkAlerts(): void {
    for (const rule of this.alertRules.values()) {
      if (!rule.enabled) continue;
      
      try {
        this.checkAlertRule(rule);
      } catch (error) {
        this.logger.error(`Failed to check alert rule: ${rule.name}`, error as Error, { rule }, 'performance-monitor');
      }
    }
  }

  private checkAlertRule(rule: AlertRule): void {
    const currentValue = this.getCurrentMetricValue(rule.metric, rule.labels);
    if (currentValue === null) return;
    
    const shouldFire = this.evaluateCondition(currentValue, rule.condition, rule.threshold);
    const existingAlert = this.activeAlerts.get(rule.id);
    
    if (shouldFire && !existingAlert) {
      // Fire new alert
      const alert: Alert = {
        id: rule.id,
        rule,
        value: currentValue,
        timestamp: new Date(),
        status: 'firing',
        message: `${rule.name}: ${rule.metric} is ${currentValue} (threshold: ${rule.threshold})`
      };
      
      this.activeAlerts.set(rule.id, alert);
      this.emit('alert', alert);
      this.logger.warn(`Alert fired: ${rule.name}`, { alert }, 'performance-monitor');
      
    } else if (!shouldFire && existingAlert && existingAlert.status === 'firing') {
      // Resolve alert
      existingAlert.status = 'resolved';
      existingAlert.timestamp = new Date();
      
      this.emit('alertResolved', existingAlert);
      this.logger.info(`Alert resolved: ${rule.name}`, { alert: existingAlert }, 'performance-monitor');
    }
  }

  private getCurrentMetricValue(metricName: string, labels?: Record<string, string>): number | null {
    const key = this.getMetricKey(metricName, labels);
    
    // Try gauge first
    if (this.gauges.has(key)) {
      return this.gauges.get(key)!;
    }
    
    // Try counter
    if (this.counters.has(key)) {
      return this.counters.get(key)!;
    }
    
    // Try histogram (use latest value)
    const histogramValues = this.histograms.get(key);
    if (histogramValues && histogramValues.length > 0) {
      return histogramValues[histogramValues.length - 1];
    }
    
    return null;
  }

  private evaluateCondition(value: number, condition: string, threshold: number): boolean {
    switch (condition) {
      case 'gt': return value > threshold;
      case 'gte': return value >= threshold;
      case 'lt': return value < threshold;
      case 'lte': return value <= threshold;
      case 'eq': return value === threshold;
      default: return false;
    }
  }

  // Utility methods
  private recordMetric(name: string, value: number, labels?: Record<string, string>): void {
    const key = this.getMetricKey(name, labels);
    const metrics = this.metrics.get(key) || [];
    
    metrics.push({
      value,
      timestamp: new Date(),
      labels
    });
    
    this.metrics.set(key, metrics);
  }

  private getMetricKey(name: string, labels?: Record<string, string>): string {
    if (!labels || Object.keys(labels).length === 0) {
      return name;
    }
    
    const labelString = Object.entries(labels)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}="${value}"`)
      .join(',');
    
    return `${name}{${labelString}}`;
  }

  private percentile(sortedArray: number[], p: number): number {
    const index = Math.ceil(sortedArray.length * p) - 1;
    return sortedArray[Math.max(0, index)];
  }

  private cleanupOldMetrics(): void {
    const cutoff = Date.now() - this.metricsRetentionMs;
    let cleanedCount = 0;
    
    for (const [key, metrics] of this.metrics.entries()) {
      const filtered = metrics.filter(m => m.timestamp.getTime() > cutoff);
      
      if (filtered.length !== metrics.length) {
        this.metrics.set(key, filtered);
        cleanedCount += metrics.length - filtered.length;
      }
    }
    
    // Also cleanup histogram data
    for (const [key, values] of this.histograms.entries()) {
      if (values.length > 10000) { // Keep only last 10k values
        this.histograms.set(key, values.slice(-10000));
        cleanedCount += values.length - 10000;
      }
    }
    
    if (cleanedCount > 0) {
      this.logger.debug(`Cleaned up ${cleanedCount} old metrics`, {}, 'performance-monitor');
    }
  }

  // Get all metrics for export/dashboard
  getAllMetrics(): {
    counters: Record<string, number>;
    gauges: Record<string, number>;
    histograms: Record<string, MetricSummary>;
  } {
    const counters: Record<string, number> = {};
    const gauges: Record<string, number> = {};
    const histograms: Record<string, MetricSummary> = {};
    
    for (const [key, value] of this.counters.entries()) {
      counters[key] = value;
    }
    
    for (const [key, value] of this.gauges.entries()) {
      gauges[key] = value;
    }
    
    for (const [key, values] of this.histograms.entries()) {
      if (values.length > 0) {
        const sorted = [...values].sort((a, b) => a - b);
        const sum = sorted.reduce((a, b) => a + b, 0);
        
        histograms[key] = {
          count: sorted.length,
          sum,
          min: sorted[0],
          max: sorted[sorted.length - 1],
          avg: sum / sorted.length,
          p50: this.percentile(sorted, 0.5),
          p95: this.percentile(sorted, 0.95),
          p99: this.percentile(sorted, 0.99)
        };
      }
    }
    
    return { counters, gauges, histograms };
  }

  private shutdown(): void {
    clearInterval(this.cleanupInterval);
    clearInterval(this.resourceMonitorInterval);
    clearInterval(this.alertCheckInterval);
    this.logger.info('PerformanceMonitor shutdown complete', {}, 'performance-monitor');
  }
}

// Singleton instance
let performanceMonitorInstance: PerformanceMonitor | null = null;

export function createPerformanceMonitor(): PerformanceMonitor {
  if (performanceMonitorInstance) {
    return performanceMonitorInstance;
  }
  
  performanceMonitorInstance = new PerformanceMonitor();
  return performanceMonitorInstance;
}

export function getPerformanceMonitor(): PerformanceMonitor {
  if (!performanceMonitorInstance) {
    throw new Error('PerformanceMonitor not initialized. Call createPerformanceMonitor() first.');
  }
  return performanceMonitorInstance;
}

// For testing purposes
export function resetPerformanceMonitor(): void {
  if (performanceMonitorInstance) {
    performanceMonitorInstance['shutdown']();
  }
  performanceMonitorInstance = null;
}

export { PerformanceMonitor };