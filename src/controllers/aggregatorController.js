// src/controllers/aggregatorController.js
const { APIAggregatorService } = require('../services/apiAggregatorService');
const { Logger } = require('../utils/logger');

class AggregatorController {
  constructor() {
    this.service = APIAggregatorService.getInstance();
    this.stats = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      avgResponseTime: 0
    };
  }

  async aggregate(req, res) {
    const startTime = Date.now();
    this.stats.totalRequests++;

    try {
      Logger.info(`[CONTROLLER ${process.pid}] Petición recibida en /api/aggregate`);

      // Llamar al servicio con estrategia por defecto (BestEffort)
      const result = await this.service.aggregateAPIs('best-effort');

      const responseTime = Date.now() - startTime;
      this.updateStats(true, responseTime);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        data: result.data,
        metadata: {
          successful: result.successful,
          failed: result.failed,
          responseTime: `${responseTime}ms`,
          workerId: process.pid
        }
      }));

    } catch (error) {
      const responseTime = Date.now() - startTime;
      this.updateStats(false, responseTime);

      Logger.error(`[CONTROLLER ${process.pid}] Error: ${error.message}`);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: false,
        error: error.message,
        metadata: {
          responseTime: `${responseTime}ms`,
          workerId: process.pid
        }
      }));
    }
  }

  async aggregateCustom(req, res) {
    const startTime = Date.now();
    this.stats.totalRequests++;

    try {
      const { strategy = 'best-effort', timeout = 5000 } = req.body;

      Logger.info(`[CONTROLLER ${process.pid}] Petición POST con estrategia: ${strategy}`);

      const result = await this.service.aggregateAPIs(strategy, timeout);

      const responseTime = Date.now() - startTime;
      this.updateStats(true, responseTime);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        data: result.data,
        metadata: {
          successful: result.successful,
          failed: result.failed,
          strategy: strategy,
          responseTime: `${responseTime}ms`,
          workerId: process.pid
        }
      }));

    } catch (error) {
      const responseTime = Date.now() - startTime;
      this.updateStats(false, responseTime);

      Logger.error(`[CONTROLLER ${process.pid}] Error: ${error.message}`);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: false,
        error: error.message,
        metadata: {
          responseTime: `${responseTime}ms`,
          workerId: process.pid
        }
      }));
    }
  }

  async getStats(req, res) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      workerId: process.pid,
      stats: this.stats,
      circuitBreakers: this.service.getCircuitBreakerStatus()
    }));
  }

  updateStats(success, responseTime) {
    if (success) {
      this.stats.successfulRequests++;
    } else {
      this.stats.failedRequests++;
    }

    // Promedio móvil simple
    const total = this.stats.successfulRequests + this.stats.failedRequests;
    this.stats.avgResponseTime = 
      (this.stats.avgResponseTime * (total - 1) + responseTime) / total;
  }
}

module.exports = { AggregatorController };