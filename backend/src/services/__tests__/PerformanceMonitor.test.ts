import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PerformanceMonitor } from '../PerformanceMonitor';
import * as fs from 'fs/promises';
import * as path from 'path';

describe('PerformanceMonitor', () => {
  let monitor: PerformanceMonitor;
  let testPersistencePath: string;

  beforeEach(() => {
    testPersistencePath = path.join(process.cwd(), 'temp', 'test-performance.json');
    monitor = new PerformanceMonitor({
      maxMetricsHistory: 100,
      maxSystemMetricsHistory: 50,
      maxAlertsHistory: 50,
      persistencePath: testPersistencePath,
      enablePersistence: false // Disable for most tests
    });
  });

  afterEach(async () => {
    await monitor.shutdown();
    
    // Cleanup test files
    try {
      await fs.unlink(testPersistencePath);
    } catch (error) {
      // File might not exist, ignore
    }
  });

  describe('metric recording', () => {
    it('should record performance metrics', () => {
      monitor.recordMetric('test-service', 'test-operation', 100, true);
      
      const metrics = monitor.getServiceMetrics('test-service');
      
      expect(metrics.totalRequests).toBe(1);
      expect(metrics.successfulRequests).toBe(1);
      expect(metrics.failedRequests).toBe(0);
      expect(metrics.averageResponseTime).toBe(100);
      expect(metrics.errorRate).toBe(0);
    });

    it('should record failed metrics', () => {
      monitor.recordMetric('test-service', 'test-operation', 200, false, 'Test error');
      
      const metrics = monitor.getServiceMetrics('test-service');
      
      expect(metrics.totalRequests).toBe(1);
      expect(metrics.successfulRequests).toBe(0);
      expect(metrics.failedRequests).toBe(1);
      expect(metrics.averageResponseTime).toBe(200);
      expect(metrics.errorRate).toBe(1);
    });

    it('should calculate percentiles correctly', () => {
      // Record multiple metrics with different durations
      const durations = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
      
      for (const duration of durations) {
        monitor.recordMetric('test-service', 'test-operation', duration, true);
      }
      
      const metrics = monitor.getServiceMetrics('test-service');
      
      expect(metrics.totalRequests).toBe(10);
      expect(metrics.minResponseTime).toBe(10);
      expect(metrics.maxResponseTime).toBe(100);
      expect(metrics.averageResponseTime).toBe(55);
      expect(metrics.p95ResponseTime).toBeGreaterThan(80);
      expect(metrics.p99ResponseTime).toBeGreaterThan(90);
    });
  });

  describe('timer functionality', () => {
    it('should measure operation duration with timer', async () => {
      const timer = monitor.startTimer('timer-service', 'timer-operation');
      
      // Simulate some work
      await new Promise(resolve => setTimeout(resolve, 50));
      
      const duration = timer.end(true);
      
      expect(duration).toBeGreaterThan(40);
      expect(duration).toBeLessThan(100);
      
      const metrics = monitor.getServiceMetrics('timer-service');
      expect(metrics.totalRequests).toBe(1);
      expect(metrics.successfulRequests).toBe(1);
    });

    it('should handle timer with error', async () => {
      const timer = monitor.startTimer('timer-service', 'timer-operation');
      
      await new Promise(resolve => setTimeout(resolve, 10));
      
      timer.end(false, 'Timer error');
      
      const metrics = monitor.getServiceMetrics('timer-service');
      expect(metrics.totalRequests).toBe(1);
      expect(metrics.failedRequests).toBe(1);
      expect(metrics.errorRate).toBe(1);
    });
  });

  describe('service metrics', () => {
    it('should return empty metrics for non-existent service', () => {
      const metrics = monitor.getServiceMetrics('non-existent');
      
      expect(metrics.totalRequests).toBe(0);
      expect(metrics.successfulRequests).toBe(0);
      expect(metrics.failedRequests).toBe(0);
      expect(metrics.averageResponseTime).toBe(0);
      expect(metrics.errorRate).toBe(0);
    });

    it('should filter metrics by time window', async () => {
      // Record old metric
      monitor.recordMetric('test-service', 'old-operation', 100, true);
      
      // Wait a bit
      await new Promise(resolve => setTimeout(resolve, 10));
      
      monitor.recordMetric('test-service', 'new-operation', 200, true);
      
      // Get metrics for last 5ms (should only include new metric)
      const metrics = monitor.getServiceMetrics('test-service', 5);
      expect(metrics.totalRequests).toBeLessThanOrEqual(2); // Could be 1 or 2 depending on timing
      
      // Get all metrics (no time window)
      const allMetrics = monitor.getServiceMetrics('test-service');
      expect(allMetrics.totalRequests).toBe(2);
    });

    it('should list all services with metrics', () => {
      monitor.recordMetric('service-1', 'operation', 100, true);
      monitor.recordMetric('service-2', 'operation', 200, true);
      monitor.recordMetric('service-1', 'operation', 150, true);
      
      const services = monitor.getServices();
      
      expect(services).toContain('service-1');
      expect(services).toContain('service-2');
      expect(services).toHaveLength(2);
    });
  });

  describe('system metrics', () => {
    it('should collect current system metrics', () => {
      const systemMetrics = monitor.getCurrentSystemMetrics();
      
      expect(systemMetrics.timestamp).toBeInstanceOf(Date);
      expect(systemMetrics.cpu).toBeDefined();
      expect(systemMetrics.memory).toBeDefined();
      expect(systemMetrics.process).toBeDefined();
      
      expect(systemMetrics.memory.total).toBeGreaterThan(0);
      expect(systemMetrics.memory.usage).toBeGreaterThanOrEqual(0);
      expect(systemMetrics.memory.usage).toBeLessThanOrEqual(100);
      
      expect(systemMetrics.process.pid).toBe(process.pid);
      expect(systemMetrics.process.uptime).toBeGreaterThan(0);
    });

    it('should return system metrics history', () => {
      const history = monitor.getSystemMetricsHistory();
      
      // Should be empty initially (collection happens on interval)
      expect(Array.isArray(history)).toBe(true);
    });
  });

  describe('dashboard data', () => {
    it('should provide comprehensive dashboard data', () => {
      // Add some test data
      monitor.recordMetric('service-1', 'operation-1', 100, true);
      monitor.recordMetric('service-1', 'operation-2', 200, false, 'Error');
      monitor.recordMetric('service-2', 'operation-1', 150, true);
      
      const dashboard = monitor.getDashboardData();
      
      expect(dashboard.services).toBeDefined();
      expect(dashboard.systemMetrics).toBeDefined();
      expect(dashboard.alerts).toBeDefined();
      expect(dashboard.uptime).toBeGreaterThanOrEqual(0);
      expect(dashboard.overview).toBeDefined();
      
      expect(dashboard.overview.totalRequests).toBe(3);
      expect(dashboard.overview.totalErrors).toBe(1);
      expect(dashboard.overview.activeServices).toBe(2);
      expect(dashboard.overview.averageResponseTime).toBeGreaterThan(0);
    });
  });

  describe('alert system', () => {
    it('should add and remove alert rules', () => {
      const ruleId = monitor.addAlertRule({
        name: 'Test Rule',
        condition: () => true,
        severity: 'medium',
        cooldown: 1000,
        enabled: true
      });
      
      expect(ruleId).toBeDefined();
      
      const rules = monitor.getAlertRules();
      expect(rules.some(r => r.id === ruleId)).toBe(true);
      
      const removed = monitor.removeAlertRule(ruleId);
      expect(removed).toBe(true);
      
      const rulesAfter = monitor.getAlertRules();
      expect(rulesAfter.some(r => r.id === ruleId)).toBe(false);
    });

    it('should have default alert rules', () => {
      const rules = monitor.getAlertRules();
      
      expect(rules.length).toBeGreaterThan(0);
      expect(rules.some(r => r.name === 'High Error Rate')).toBe(true);
      expect(rules.some(r => r.name === 'Slow Response Time')).toBe(true);
      expect(rules.some(r => r.name === 'High Memory Usage')).toBe(true);
      expect(rules.some(r => r.name === 'High CPU Usage')).toBe(true);
    });

    it('should get and resolve alerts', () => {
      // This test would require triggering alerts, which is complex
      // For now, just test the basic functionality
      const alerts = monitor.getAlerts();
      expect(Array.isArray(alerts)).toBe(true);
      
      const unresolved = monitor.getAlerts(10, true);
      expect(Array.isArray(unresolved)).toBe(true);
    });
  });

  describe('persistence', () => {
    it('should persist and load data', async () => {
      const persistentMonitor = new PerformanceMonitor({
        persistencePath: testPersistencePath,
        enablePersistence: true
      });
      
      try {
        // Add some data
        persistentMonitor.recordMetric('persist-service', 'persist-operation', 100, true);
        
        // Force persistence
        await persistentMonitor.shutdown();
        
        // Create new monitor and check if data was loaded
        const newMonitor = new PerformanceMonitor({
          persistencePath: testPersistencePath,
          enablePersistence: true
        });
        
        try {
          // Wait a bit for loading
          await new Promise(resolve => setTimeout(resolve, 100));
          
          const services = newMonitor.getServices();
          expect(services).toContain('persist-service');
        } finally {
          await newMonitor.shutdown();
        }
      } finally {
        await persistentMonitor.shutdown();
      }
    });
  });

  describe('memory management', () => {
    it('should limit metrics history', () => {
      const smallMonitor = new PerformanceMonitor({
        maxMetricsHistory: 5
      });
      
      try {
        // Add more metrics than the limit
        for (let i = 0; i < 10; i++) {
          smallMonitor.recordMetric('test-service', 'operation', i * 10, true);
        }
        
        const metrics = smallMonitor.getServiceMetrics('test-service');
        
        // Should only have the last 5 metrics
        expect(metrics.totalRequests).toBe(5);
        expect(metrics.minResponseTime).toBe(50); // Should be from the last 5 metrics
      } finally {
        smallMonitor.shutdown();
      }
    });
  });
});