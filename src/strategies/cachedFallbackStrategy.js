// src/strategies/cachedFallbackStrategy.js
const { Logger } = require('../utils/logger');

class CachedFallbackStrategy {
  constructor() {
    // Caché simple en memoria (compartido por todas las instancias)
    if (!CachedFallbackStrategy.cache) {
      CachedFallbackStrategy.cache = new Map();
      CachedFallbackStrategy.TTL = 300000; // 5 minutos
    }
  }

  async aggregate(results) {
    const successful = [];
    const failed = [];
    const fromCache = [];

    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        successful.push(result.value);
        // Guardar en caché
        this.setCache(index, result.value);
      } else {
        // Intentar obtener de caché
        const cached = this.getCache(index);
        if (cached) {
          successful.push({ ...cached, fromCache: true });
          fromCache.push(index);
          Logger.info(`[STRATEGY] Usando caché para API ${index}`);
        } else {
          failed.push({
            index,
            reason: result.reason.message
          });
        }
      }
    });

    return {
      data: successful,
      successful: successful.length,
      failed: failed.length,
      failedAPIs: failed,
      fromCache: fromCache.length
    };
  }

  setCache(key, value) {
    CachedFallbackStrategy.cache.set(key, {
      data: value,
      timestamp: Date.now()
    });
  }

  getCache(key) {
    const cached = CachedFallbackStrategy.cache.get(key);
    if (!cached) return null;

    const age = Date.now() - cached.timestamp;
    if (age > CachedFallbackStrategy.TTL) {
      CachedFallbackStrategy.cache.delete(key);
      return null;
    }

    return cached.data;
  }
}

module.exports = { CachedFallbackStrategy };