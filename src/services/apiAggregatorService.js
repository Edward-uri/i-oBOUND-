// src/services/apiAggregatorService.js
const { APIClientFactory } = require('../clients/apiClientFactory');
const { AggregationStrategyFactory } = require('../strategies/aggregationStrategyFactory');
const { Logger } = require('../utils/logger');

class APIAggregatorService {
  constructor() {
    if (APIAggregatorService.instance) {
      return APIAggregatorService.instance;
    }

    this.clientFactory = new APIClientFactory();
    this.strategyFactory = new AggregationStrategyFactory();
    this.clients = this.initializeClients();
    
    APIAggregatorService.instance = this;
  }

  static getInstance() {
    if (!APIAggregatorService.instance) {
      APIAggregatorService.instance = new APIAggregatorService();
    }
    return APIAggregatorService.instance;
  }

  initializeClients() {
    // Crear 10 clientes de APIs diferentes
    return [
      this.clientFactory.createClient('jsonplaceholder-users'),
      this.clientFactory.createClient('jsonplaceholder-posts'),
      this.clientFactory.createClient('jsonplaceholder-comments'),
      this.clientFactory.createClient('jsonplaceholder-albums'),
      this.clientFactory.createClient('jsonplaceholder-photos'),
      this.clientFactory.createClient('jsonplaceholder-todos'),
      this.clientFactory.createClient('cat-facts'),
      this.clientFactory.createClient('dog-facts'),
      this.clientFactory.createClient('random-user'),
      this.clientFactory.createClient('activity-api')
    ];
  }

  async aggregateAPIs(strategyName = 'best-effort', timeout = 5000) {
    Logger.info(`[SERVICE ${process.pid}] Iniciando agregación con estrategia: ${strategyName}`);

    // Obtener estrategia
    const strategy = this.strategyFactory.createStrategy(strategyName);

    // Hacer todas las llamadas en paralelo con Promise.allSettled
    const promises = this.clients.map(client => 
      this.fetchWithTimeout(client, timeout)
    );

    const results = await Promise.allSettled(promises);

    // Aplicar estrategia para manejar resultados
    const aggregatedData = await strategy.aggregate(results);

    // Si necesitamos procesamiento pesado, lo delegamos a worker threads
    if (global.workerThreadPool && aggregatedData.data.length > 0) {
      try {
        const processed = await this.processInWorkerThread(aggregatedData.data);
        aggregatedData.data = processed;
      } catch (error) {
        Logger.warn(`[SERVICE ${process.pid}] Error en worker thread: ${error.message}`);
        // Continuar con datos sin procesar si falla el worker
      }
    }

    return aggregatedData;
  }

  async fetchWithTimeout(client, timeout) {
    return Promise.race([
      client.fetch(),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout')), timeout)
      )
    ]);
  }

  async processInWorkerThread(data) {
    return new Promise((resolve, reject) => {
      const task = {
        type: 'aggregate',
        data: data
      };

      global.workerThreadPool.execute(task)
        .then(resolve)
        .catch(reject);
    });
  }

  getCircuitBreakerStatus() {
    return this.clients.map(client => ({
      name: client.name,
      state: client.circuitBreaker.state,
      failures: client.circuitBreaker.failures,
      lastFailure: client.circuitBreaker.lastFailureTime
    }));
  }
}

module.exports = { APIAggregatorService };