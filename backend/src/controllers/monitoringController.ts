import { Request, Response } from 'express';
import { getLogger } from '../services/Logger';
import { getPerformanceMonitor } from '../services/PerformanceMonitor';
import { getHealthCheckService } from '../services/HealthCheckService';

export class MonitoringController {
  // Get all performance metrics
  async getMetrics(req: Request, res: Response): Promise<void> {
    try {
      const performanceMonitor = getPerformanceMonitor();
      const metrics = performanceMonitor.getAllMetrics();
      
      res.json({
        timestamp: new Date().toISOString(),
        metrics
      });
      
      getLogger().debug('Metrics retrieved', { metricsCount: Object.keys(metrics.counters).length }, 'monitoring-controller');
    } catch (error) {
      getLogger().error('Failed to get metrics', error as Error, {}, 'monitoring-controller');
      res.status(500).json({
        error: 'Failed to retrieve metrics',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // Get service-specific metrics
  async getServiceMetrics(req: Request, res: Response): Promise<void> {
    try {
      const { serviceName } = req.params;
      const performanceMonitor = getPerformanceMonitor();
      const serviceMetrics = performanceMonitor.getServiceMetrics(serviceName);
      
      if (!serviceMetrics) {
        res.status(404).json({
          error: 'Service not found',
          message: `No metrics found for service: ${serviceName}`
        });
        return;
      }
      
      res.json(serviceMetrics);
      
      getLogger().debug('Service metrics retrieved', { serviceName }, 'monitoring-controller');
    } catch (error) {
      getLogger().error('Failed to get service metrics', error as Error, { serviceName: req.params.serviceName }, 'monitoring-controller');
      res.status(500).json({
        error: 'Failed to retrieve service metrics',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // Get system health status
  async getHealth(req: Request, res: Response): Promise<void> {
    try {
      const healthService = getHealthCheckService();
      const systemHealth = await healthService.getSystemHealth();
      
      res.json(systemHealth);
      
      getLogger().debug('System health retrieved', { status: systemHealth.status }, 'monitoring-controller');
    } catch (error) {
      getLogger().error('Failed to get system health', error as Error, {}, 'monitoring-controller');
      res.status(500).json({
        error: 'Failed to retrieve system health',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // Get health check for specific service
  async getServiceHealth(req: Request, res: Response): Promise<void> {
    try {
      const { serviceName } = req.params;
      const healthService = getHealthCheckService();
      const serviceHealth = healthService.getServiceHealth(serviceName);
      
      if (!serviceHealth) {
        res.status(404).json({
          error: 'Service not found',
          message: `No health data found for service: ${serviceName}`
        });
        return;
      }
      
      res.json(serviceHealth);
      
      getLogger().debug('Service health retrieved', { serviceName, status: serviceHealth.status }, 'monitoring-controller');
    } catch (error) {
      getLogger().error('Failed to get service health', error as Error, { serviceName: req.params.serviceName }, 'monitoring-controller');
      res.status(500).json({
        error: 'Failed to retrieve service health',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // Run health check for specific service
  async runHealthCheck(req: Request, res: Response): Promise<void> {
    try {
      const { serviceName } = req.params;
      const healthService = getHealthCheckService();
      const result = await healthService.runHealthCheck(serviceName);
      
      res.json(result);
      
      getLogger().info('Health check executed', { serviceName, status: result.status }, 'monitoring-controller');
    } catch (error) {
      getLogger().error('Failed to run health check', error as Error, { serviceName: req.params.serviceName }, 'monitoring-controller');
      res.status(500).json({
        error: 'Failed to run health check',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // Get active alerts
  async getAlerts(req: Request, res: Response): Promise<void> {
    try {
      const performanceMonitor = getPerformanceMonitor();
      const activeAlerts = performanceMonitor.getActiveAlerts();
      
      res.json({
        timestamp: new Date().toISOString(),
        alerts: activeAlerts
      });
      
      getLogger().debug('Active alerts retrieved', { alertCount: activeAlerts.length }, 'monitoring-controller');
    } catch (error) {
      getLogger().error('Failed to get alerts', error as Error, {}, 'monitoring-controller');
      res.status(500).json({
        error: 'Failed to retrieve alerts',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // Get alert rules
  async getAlertRules(req: Request, res: Response): Promise<void> {
    try {
      const performanceMonitor = getPerformanceMonitor();
      const alertRules = performanceMonitor.getAlertRules();
      
      res.json({
        timestamp: new Date().toISOString(),
        rules: alertRules
      });
      
      getLogger().debug('Alert rules retrieved', { ruleCount: alertRules.length }, 'monitoring-controller');
    } catch (error) {
      getLogger().error('Failed to get alert rules', error as Error, {}, 'monitoring-controller');
      res.status(500).json({
        error: 'Failed to retrieve alert rules',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // Add alert rule
  async addAlertRule(req: Request, res: Response): Promise<void> {
    try {
      const alertRule = req.body;
      
      // Validate required fields
      if (!alertRule.id || !alertRule.name || !alertRule.metric || !alertRule.condition || alertRule.threshold === undefined) {
        res.status(400).json({
          error: 'Invalid alert rule',
          message: 'Missing required fields: id, name, metric, condition, threshold'
        });
        return;
      }
      
      const performanceMonitor = getPerformanceMonitor();
      performanceMonitor.addAlertRule(alertRule);
      
      res.status(201).json({
        message: 'Alert rule added successfully',
        rule: alertRule
      });
      
      getLogger().info('Alert rule added', { ruleId: alertRule.id, ruleName: alertRule.name }, 'monitoring-controller');
    } catch (error) {
      getLogger().error('Failed to add alert rule', error as Error, {}, 'monitoring-controller');
      res.status(500).json({
        error: 'Failed to add alert rule',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // Remove alert rule
  async removeAlertRule(req: Request, res: Response): Promise<void> {
    try {
      const { ruleId } = req.params;
      const performanceMonitor = getPerformanceMonitor();
      performanceMonitor.removeAlertRule(ruleId);
      
      res.json({
        message: 'Alert rule removed successfully',
        ruleId
      });
      
      getLogger().info('Alert rule removed', { ruleId }, 'monitoring-controller');
    } catch (error) {
      getLogger().error('Failed to remove alert rule', error as Error, { ruleId: req.params.ruleId }, 'monitoring-controller');
      res.status(500).json({
        error: 'Failed to remove alert rule',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // Get readiness probe
  async getReadiness(_req: Request, res: Response): Promise<void> {
    try {
      const healthService = getHealthCheckService();
      const isReady = await healthService.isReady();
      
      if (isReady) {
        res.json({
          status: 'ready',
          timestamp: new Date().toISOString()
        });
      } else {
        res.status(503).json({
          status: 'not ready',
          timestamp: new Date().toISOString()
        });
      }
      
      getLogger().debug('Readiness check', { isReady }, 'monitoring-controller');
    } catch (error) {
      getLogger().error('Failed to check readiness', error as Error, {}, 'monitoring-controller');
      res.status(500).json({
        error: 'Failed to check readiness',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // Get liveness probe
  async getLiveness(_req: Request, res: Response): Promise<void> {
    try {
      const healthService = getHealthCheckService();
      const isAlive = await healthService.isAlive();
      
      if (isAlive) {
        res.json({
          status: 'alive',
          timestamp: new Date().toISOString()
        });
      } else {
        res.status(503).json({
          status: 'not alive',
          timestamp: new Date().toISOString()
        });
      }
      
      getLogger().debug('Liveness check', { isAlive }, 'monitoring-controller');
    } catch (error) {
      getLogger().error('Failed to check liveness', error as Error, {}, 'monitoring-controller');
      res.status(500).json({
        error: 'Failed to check liveness',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // Get dashboard data (combined metrics and health)
  async getDashboardData(req: Request, res: Response): Promise<void> {
    try {
      const performanceMonitor = getPerformanceMonitor();
      const healthService = getHealthCheckService();
      
      const [metrics, systemHealth, activeAlerts] = await Promise.all([
        performanceMonitor.getAllMetrics(),
        healthService.getSystemHealth(),
        performanceMonitor.getActiveAlerts()
      ]);
      
      const dashboardData = {
        timestamp: new Date().toISOString(),
        system: {
          status: systemHealth.status,
          uptime: systemHealth.uptime,
          resources: systemHealth.resources
        },
        services: systemHealth.services,
        metrics: {
          counters: Object.keys(metrics.counters).length,
          gauges: Object.keys(metrics.gauges).length,
          histograms: Object.keys(metrics.histograms).length
        },
        alerts: {
          active: activeAlerts.length,
          total: performanceMonitor.getAlertRules().length
        }
      };
      
      res.json(dashboardData);
      
      getLogger().debug('Dashboard data retrieved', { 
        systemStatus: systemHealth.status,
        activeAlerts: activeAlerts.length 
      }, 'monitoring-controller');
    } catch (error) {
      getLogger().error('Failed to get dashboard data', error, {}, 'monitoring-controller');
      res.status(500).json({
        error: 'Failed to retrieve dashboard data',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
}

// Create singleton instance
export const monitoringController = new MonitoringController();