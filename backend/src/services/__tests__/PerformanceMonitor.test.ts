import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { 
  PerformanceMonitor, 
  createPerformanceMonitor, 
  getPerformanceMonitor, 
  resetPerformanceMonitor,
  AlertRule,
  Alert
} from '../PerformanceMonitor';
import { createLogger } from '../Logger';

// Mock the logger
vi.mock('../Logger', () => ({
  getLogger: vi.fn(() => ({
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  })),
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }))
}));

describe('PerformanceMonitor', () => {
  let monitor: PerformanceMonitor;

  beforeEach(() => {
    // Create logger first
    createLogger({
      level: 'debug',
      service: 'test-service',
      enableConsole: false,
      enableFile: false
    });
    
    resetPerformanceMonitor();
    monitor = createPerformanceMonitor();
  });

  afterEach(() => {
    resetPerformanceMonitor();
    vi.clearAllMocks();
  });

  describe('Counter Metrics', () => {
    it('should increment counter metrics', () => {
      monitor.incrementCounter('test_counter', 5);
      monitor.incrementCounter('test_counter', 3);
      
      const metrics = monitor.getAllMetrics();
      expect(metrics.counters['test_counter']).toBe(8);
    });

    it('should handle counter metrics with labels', () => {
      monitor.incrementCounter('requests_total', 1, { method: 'GET', status: '200' });
      monitor.incrementCounter('requests_total', 1, { method: 'POST', status: '201' });
      monitor.incrementCounter('requests_total', 1, { method: 'GET', status: '200' });
      
      const metrics = monitor.getAllMetrics();
      expect(metrics.counters['requests_total{method="GET",status="200"}']).toBe(2);
      expect(metrics.counters['requests_total{method="POST",status="201"}']).toBe(1);
    });
  });

  describe('Gauge Metrics', () => {
    it('should set gauge metrics', () => {
      monitor.setGauge('cpu_usage', 75.5);
      monitor.setGauge('cpu_usage', 80.2);
      
      const metrics = monitor.getAllMetrics();
      expect(metrics.gauges['cpu_usage']).toBe(80.2);
    });

    it('should handle gauge metrics with labels', () => {
      monitor.setGauge('memory_usage', 1024, { type: 'heap' });
      monitor.setGauge('memory_usage', 2048, { type: 'rss' });
      
      const metrics = monitor.getAllMetrics();
      expect(metrics.gauges['memory_usage{type="heap"}']).toBe(1024);
      expect(metrics.gauges['memory_usage{type="rss"}']).toBe(2048);
    });
  });

  describe('Histogram Metrics', () => {
    it('should record histogram metrics', () => {
      monitor.recordHistogram('response_time', 100);
      monitor.recordHistogram('response_time', 200);
      monitor.recordHistogram('response_time', 150);
      
      const summary = monitor.getMetricSummary('response_time');
      expect(summary).toBeDefined();
      expect(summary!.count).toBe(3);
      expect(summary!.min).toBe(100);
      expect(summary!.max).toBe(200);
      expect(summary!.avg).toBe(150);
    });

    it('should calculate percentiles correctly', () => {
      // Add 100 values from 1 to 100
      for (let i = 1; i <= 100; i++) {
        monitor.recordHistogram('test_metric', i);
      }
      
      const summary = monitor.getMetricSummary('test_metric');
      expect(summary).toBeDefined();
      expect(summary!.p50).toBe(50);
      expect(summary!.p95).toBe(95);
      expect(summary!.p99).toBe(99);
    });
  });

  describe('Timer Functionality', () => {
    it('should measure execution time with timer', async () => {
      const endTimer = monitor.startTimer('operation_duration');
      
      // Simulate some work
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const duration = endTimer();
      expect(duration).toBeGreaterThan(0);
      
      const summary = monitor.getMetricSummary('operation_duration');
      expect(summary).toBeDefined();
      expect(summary!.count).toBe(1);
      expect(summary!.min).toBeGreaterThan(0);
    });

    it('should time async operations', async () => {
      const result = await monitor.timeAsync('async_operation', async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
        return 'test_result';
      });
      
      expect(result).toBe('test_result');
      
      const summary = monitor.getMetricSummary('async_operation');
      expect(summary).toBeDefined();
      expect(summary!.count).toBe(1);
    });

    it('should handle errors in timed async operations', async () => {
      await expect(
        monitor.timeAsync('failing_operation', async () => {
          throw new Error('Test error');
        })
      ).rejects.toThrow('Test error');
      
      const metrics = monitor.getAllMetrics();
      expect(metrics.counters['failing_operation_errors']).toBe(1);
    });
  });

  describe('Service Metrics', () => {
    it('should record service metrics', () => {
      monitor.recordServiceMetrics('api_service', 150, true);
      monitor.recordServiceMetrics('api_service', 200, true);
      monitor.recordServiceMetrics('api_service', 300, false);
      
      const serviceMetrics = monitor.getServiceMetrics('api_service');
      expect(serviceMetrics).toBeDefined();
      expect(serviceMetrics!.name).toBe('api_service');
      expect(serviceMetrics!.responseTime.count).toBe(3);
      expect(serviceMetrics!.errorRate).toBeCloseTo(33.33, 1);
      expect(serviceMetrics!.availability).toBeCloseTo(66.67, 1);
    });
  });

  describe('Alert System', () => {
    it('should add and remove alert rules', () => {
      const rule: AlertRule = {
        id: 'high_cpu',
        name: 'High CPU Usage',
        metric: 'cpu_usage',
        condition: 'gt',
        threshold: 80,
        duration: 60,
        enabled: true
      };
      
      monitor.addAlertRule(rule);
      
      const rules = monitor.getAlertRules();
      expect(rules).toHaveLength(1);
      expect(rules[0].id).toBe('high_cpu');
      
      monitor.removeAlertRule('high_cpu');
      expect(monitor.getAlertRules()).toHaveLength(0);
    });

    it('should fire alerts when conditions are met', () => {
      return new Promise<void>((done) => {
      const rule: AlertRule = {
        id: 'test_alert',
        name: 'Test Alert',
        metric: 'test_gauge',
        condition: 'gt',
        threshold: 50,
        duration: 1,
        enabled: true
      };
      
      monitor.addAlertRule(rule);
      
      monitor.on('alert', (alert: Alert) => {
        expect(alert.rule.id).toBe('test_alert');
        expect(alert.status).toBe('firing');
        expect(alert.value).toBe(75);
        done();
      });
      
      // Set gauge above threshold
      monitor.setGauge('test_gauge', 75);
      
      // Trigger alert check manually
      monitor['checkAlerts']();
      });
    });

    it('should resolve alerts when conditions are no longer met', () => {
      return new Promise<void>((done) => {
        const rule: AlertRule = {
          id: 'test_resolve',
          name: 'Test Resolve',
          metric: 'test_gauge_resolve',
          condition: 'gt',
          threshold: 50,
          duration: 1,
          enabled: true
        };
        
        monitor.addAlertRule(rule);
        
        let alertFired = false;
        
        monitor.on('alert', () => {
          alertFired = true;
          // Lower the value to resolve the alert
          monitor.setGauge('test_gauge_resolve', 30);
          monitor['checkAlerts']();
        });
        
        monitor.on('alertResolved', (alert: Alert) => {
          expect(alertFired).toBe(true);
          expect(alert.status).toBe('resolved');
          done();
        });
        
        // Set gauge above threshold to fire alert
        monitor.setGauge('test_gauge_resolve', 75);
        monitor['checkAlerts']();
      });
    });
  });

  describe('Metric Key Generation', () => {
    it('should generate consistent metric keys', () => {
      const key1 = monitor['getMetricKey']('test_metric', { a: '1', b: '2' });
      const key2 = monitor['getMetricKey']('test_metric', { b: '2', a: '1' });
      
      expect(key1).toBe(key2);
      expect(key1).toBe('test_metric{a="1",b="2"}');
    });

    it('should handle metrics without labels', () => {
      const key = monitor['getMetricKey']('simple_metric');
      expect(key).toBe('simple_metric');
    });
  });

  describe('Condition Evaluation', () => {
    it('should evaluate different conditions correctly', () => {
      expect(monitor['evaluateCondition'](75, 'gt', 50)).toBe(true);
      expect(monitor['evaluateCondition'](25, 'gt', 50)).toBe(false);
      
      expect(monitor['evaluateCondition'](50, 'gte', 50)).toBe(true);
      expect(monitor['evaluateCondition'](49, 'gte', 50)).toBe(false);
      
      expect(monitor['evaluateCondition'](25, 'lt', 50)).toBe(true);
      expect(monitor['evaluateCondition'](75, 'lt', 50)).toBe(false);
      
      expect(monitor['evaluateCondition'](50, 'lte', 50)).toBe(true);
      expect(monitor['evaluateCondition'](51, 'lte', 50)).toBe(false);
      
      expect(monitor['evaluateCondition'](50, 'eq', 50)).toBe(true);
      expect(monitor['evaluateCondition'](51, 'eq', 50)).toBe(false);
    });
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const monitor1 = getPerformanceMonitor();
      const monitor2 = getPerformanceMonitor();
      
      expect(monitor1).toBe(monitor2);
    });

    it('should throw error when not initialized', () => {
      resetPerformanceMonitor();
      
      expect(() => getPerformanceMonitor()).toThrow(
        'PerformanceMonitor not initialized. Call createPerformanceMonitor() first.'
      );
    });
  });

  describe('Metrics Export', () => {
    it('should export all metrics correctly', () => {
      monitor.incrementCounter('test_counter', 5);
      monitor.setGauge('test_gauge', 42);
      monitor.recordHistogram('test_histogram', 100);
      monitor.recordHistogram('test_histogram', 200);
      
      const allMetrics = monitor.getAllMetrics();
      
      expect(allMetrics.counters['test_counter']).toBe(5);
      expect(allMetrics.gauges['test_gauge']).toBe(42);
      expect(allMetrics.histograms['test_histogram']).toBeDefined();
      expect(allMetrics.histograms['test_histogram'].count).toBe(2);
      expect(allMetrics.histograms['test_histogram'].avg).toBe(150);
    });
  });
});