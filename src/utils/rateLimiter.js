// src/utils/rateLimiter.js
const { Logger } = require('./logger');

/**
 * Token Bucket Algorithm para Rate Limiting
 * Permite ráfagas controladas y se auto-regula
 */
class TokenBucket {
  constructor(capacity, refillRate) {
    this.capacity = capacity;           // Máximo de tokens
    this.tokens = capacity;             // Tokens actuales
    this.refillRate = refillRate;       // Tokens por segundo
    this.lastRefill = Date.now();
    
    // Refill automático cada 100ms
    this.refillInterval = setInterval(() => {
      this.refill();
    }, 100);
  }

  refill() {
    const now = Date.now();
    const timePassed = (now - this.lastRefill) / 1000; // segundos
    const tokensToAdd = timePassed * this.refillRate;
    
    this.tokens = Math.min(this.capacity, this.tokens + tokensToAdd);
    this.lastRefill = now;
  }

   async consume(tokensNeeded = 1) {
    // Refill antes de consumir
    this.refill();

    // Si hay tokens suficientes, consumir inmediatamente
    if (this.tokens >= tokensNeeded) {
      this.tokens -= tokensNeeded;
      return true;
    }

    // Si no hay tokens, calcular cuánto esperar
    const tokensShortage = tokensNeeded - this.tokens;
    const waitTime = (tokensShortage / this.refillRate) * 1000; // ms

    await this.wait(waitTime);
    
    // Después de esperar, consumir
    this.refill();
    this.tokens -= tokensShortage;
    return true;
  }
  wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  getStatus() {
    this.refill();
    return {
      tokens: Math.floor(this.tokens),
      capacity: this.capacity,
      refillRate: this.refillRate
    };
  }

  destroy() {
    clearInterval(this.refillInterval);
  }
}

/**
 * Rate Limiter con cola de peticiones
 * Procesa peticiones respetando límites por API
 */
class RateLimiter {
  constructor() {
    // Configuración por API (requests por segundo)
    this.limits = {
      'jsonplaceholder': { requestsPerSecond: 10, concurrent: 5 },
      'catfact': { requestsPerSecond: 5, concurrent: 2 },
      'dogapi': { requestsPerSecond: 5, concurrent: 2 },
      'randomuser': { requestsPerSecond: 10, concurrent: 3 },
      'boredapi': { requestsPerSecond: 10, concurrent: 3 },
      'default': { requestsPerSecond: 10, concurrent: 5 }
    };

    // Token buckets por API
    this.buckets = new Map();
    
    // Colas de peticiones por API
    this.queues = new Map();
    
    // Peticiones activas por API
    this.activeRequests = new Map();
  }

  /**
   * Obtener o crear bucket para una API
   */
  getBucket(apiName) {
    if (!this.buckets.has(apiName)) {
      const config = this.getConfig(apiName);
      const bucket = new TokenBucket(
        config.requestsPerSecond * 2, // Capacity = 2x rate (permite ráfagas)
        config.requestsPerSecond       // Refill rate
      );
      this.buckets.set(apiName, bucket);
    }
    return this.buckets.get(apiName);
  }

  /**
   * Obtener configuración para una API
   */
  getConfig(apiName) {
    // Normalizar nombre (jsonplaceholder-users -> jsonplaceholder)
    const baseName = apiName.split('-')[0];
    return this.limits[baseName] || this.limits['default'];
  }

  /**
   * Ejecutar request con rate limiting
   */
  async execute(apiName, requestFn) {
    const config = this.getConfig(apiName);
    
    // Esperar si hay demasiadas peticiones concurrentes
    await this.waitForConcurrencySlot(apiName, config.concurrent);
    
    // Incrementar contador de peticiones activas
    const active = this.activeRequests.get(apiName) || 0;
    this.activeRequests.set(apiName, active + 1);

    try {
      // Consumir token del bucket (espera si es necesario)
      const bucket = this.getBucket(apiName);
      await bucket.consume(1);

      Logger.debug(`[RATE LIMITER] Ejecutando request a ${apiName}`);

      // Ejecutar la petición real
      const result = await requestFn();
      
      return result;

    } finally {
      // Decrementar contador de peticiones activas
      const active = this.activeRequests.get(apiName);
      this.activeRequests.set(apiName, active - 1);
    }
  }

  /**
   * Esperar hasta que haya slot de concurrencia disponible
   */
  async waitForConcurrencySlot(apiName, maxConcurrent) {
    while (true) {
      const active = this.activeRequests.get(apiName) || 0;
      
      if (active < maxConcurrent) {
        return; // Hay slot disponible
      }

      // Esperar un poco y reintentar
      Logger.debug(`[RATE LIMITER] ${apiName} tiene ${active}/${maxConcurrent} activas, esperando...`);
      await this.wait(50);
    }
  }

  wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Obtener estadísticas de rate limiting
   */
  getStats() {
    const stats = {};
    
    for (const [apiName, bucket] of this.buckets.entries()) {
      stats[apiName] = {
        ...bucket.getStatus(),
        activeRequests: this.activeRequests.get(apiName) || 0
      };
    }
    
    return stats;
  }

  /**
   * Limpiar recursos
   */
  destroy() {
    for (const bucket of this.buckets.values()) {
      bucket.destroy();
    }
    this.buckets.clear();
    this.queues.clear();
    this.activeRequests.clear();
  }
}

// Singleton para compartir entre todos los workers
let instance = null;

module.exports = { 
  RateLimiter,
  TokenBucket,
  getRateLimiter: () => {
    if (!instance) {
      instance = new RateLimiter();
    }
    return instance;
  }
};