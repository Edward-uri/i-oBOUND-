// src/routes/router.js
const { AggregatorController } = require('../controllers/aggregatorController');
const { HealthController } = require('../controllers/healthController');

class Router {
  constructor() {
    this.routes = new Map();
    this.aggregatorController = new AggregatorController();
    this.healthController = new HealthController();
    
    this.registerRoutes();
  }

  registerRoutes() {
    // Health check
    this.register('GET', '/health', this.healthController.check.bind(this.healthController));
    
    // Endpoint principal - Agregador de APIs
    this.register('GET', '/api/aggregate', this.aggregatorController.aggregate.bind(this.aggregatorController));
    
    // Endpoint con parámetros personalizados
    this.register('POST', '/api/aggregate', this.aggregatorController.aggregateCustom.bind(this.aggregatorController));
    
    // Estadísticas
    this.register('GET', '/api/stats', this.aggregatorController.getStats.bind(this.aggregatorController));
  }

  register(method, path, handler) {
    const key = `${method}:${path}`;
    this.routes.set(key, handler);
  }

  async handle(pathname, method, req, res) {
    const key = `${method}:${pathname}`;
    const handler = this.routes.get(key);

    if (handler) {
      await handler(req, res);
      return true;
    }

    return false;
  }
}

module.exports = { Router };