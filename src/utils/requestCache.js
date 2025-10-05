// src/utils/requestCache.js
const crypto = require('crypto');
const { Logger } = require('./logger');

/**
 * Cache inteligente con TTL y LRU
 * Reduce requests duplicados en ventanas de tiempo
 */
class RequestCache {
  constructor(options = {}) {
    this.maxSize = options.maxSize || 1000;       // Máximo de entradas
    this.defaultTTL = options.defaultTTL || 60000; // 60 segundos
    this.cache = new Map();
    this.accessOrder = [];                         // Para LRU
    
    // Limpiar caché expirado cada minuto
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60000);
  }

  /**
   * Generar key única para un request
   */
  generateKey(apiName, params = {}) {
    const data = JSON.stringify({ apiName, params });
    return crypto.createHash('md5').update(data).digest('hex');
  }

  /**
   * Obtener del caché si existe y es válido
   */
  get(key) {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }

    // Verificar si expiró
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.removeFromAccessOrder(key);
      return null;
    }

    // Actualizar access order (LRU)
    this.updateAccessOrder(key);
    
    Logger.debug(`[CACHE] HIT para ${entry.apiName}`);
    return entry.data;
  }

  /**
   * Guardar en caché
   */
  set(key, data, apiName, ttl = this.defaultTTL) {
    // Si el caché está lleno, remover el menos usado (LRU)
    if (this.cache.size >= this.maxSize) {
      this.evictLRU();
    }

    const entry = {
      key,
      apiName,
      data,
      createdAt: Date.now(),
      expiresAt: Date.now() + ttl,
      hits: 0
    };

    this.cache.set(key, entry);
    this.updateAccessOrder(key);
    
    Logger.debug(`[CACHE] SET para ${apiName} (TTL: ${ttl}ms)`);
  }

  /**
   * Ejecutar request con cache
   */
  async executeWithCache(apiName, requestFn, params = {}, ttl = this.defaultTTL) {
    const key = this.generateKey(apiName, params);
    
    // Intentar obtener de caché
    const cached = this.get(key);
    if (cached) {
      const entry = this.cache.get(key);
      entry.hits++;
      return {
        data: cached,
        fromCache: true,
        cacheAge: Date.now() - entry.createdAt
      };
    }

    // No está en caché, ejecutar request
    try {
      const data = await requestFn();
      
      // Guardar en caché
      this.set(key, data, apiName, ttl);
      
      return {
        data,
        fromCache: false
      };

    } catch (error) {
      // En caso de error, intentar devolver caché expirado si existe
      const entry = this.cache.get(key);
      if (entry) {
        Logger.warn(`[CACHE] Request falló, usando caché expirado para ${apiName}`);
        return {
          data: entry.data,
          fromCache: true,
          stale: true,
          cacheAge: Date.now() - entry.createdAt
        };
      }
      
      throw error;
    }
  }

  /**
   * Request Coalescing: Si hay múltiples requests al mismo endpoint,
   * solo hacer uno y compartir el resultado
   */
  async coalesce(apiName, requestFn, params = {}) {
    const key = this.generateKey(apiName, params);
    
    // Verificar si ya hay un request en vuelo para esta key
    if (this.inFlightRequests && this.inFlightRequests.has(key)) {
      Logger.debug(`[CACHE] Coalescing request para ${apiName}`);
      return await this.inFlightRequests.get(key);
    }

    // Crear set de requests en vuelo si no existe
    if (!this.inFlightRequests) {
      this.inFlightRequests = new Map();
    }

    // Crear promise del request
    const promise = this.executeWithCache(apiName, requestFn, params);
    this.inFlightRequests.set(key, promise);

    try {
      const result = await promise;
      return result;
    } finally {
      // Remover de requests en vuelo
      this.inFlightRequests.delete(key);
    }
  }

  /**
   * Evict Least Recently Used
   */
  evictLRU() {
    if (this.accessOrder.length === 0) return;
    
    const lruKey = this.accessOrder.shift();
    const entry = this.cache.get(lruKey);
    
    this.cache.delete(lruKey);
    
    if (entry) {
      Logger.debug(`[CACHE] Evicted LRU: ${entry.apiName} (hits: ${entry.hits})`);
    }
  }

  /**
   * Actualizar orden de acceso (para LRU)
   */
  updateAccessOrder(key) {
    this.removeFromAccessOrder(key);
    this.accessOrder.push(key);
  }

  removeFromAccessOrder(key) {
    const index = this.accessOrder.indexOf(key);
    if (index > -1) {
      this.accessOrder.splice(index, 1);
    }
  }

  /**
   * Limpiar entradas expiradas
   */
  cleanup() {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
        this.removeFromAccessOrder(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      Logger.info(`[CACHE] Limpieza: ${cleaned} entradas expiradas removidas`);
    }
  }

  /**
   * Obtener estadísticas del caché
   */
  getStats() {
    let totalHits = 0;
    let expired = 0;
    const now = Date.now();
    const byAPI = {};

    for (const entry of this.cache.values()) {
      totalHits += entry.hits;
      
      if (now > entry.expiresAt) {
        expired++;
      }

      if (!byAPI[entry.apiName]) {
        byAPI[entry.apiName] = { count: 0, hits: 0 };
      }
      byAPI[entry.apiName].count++;
      byAPI[entry.apiName].hits += entry.hits;
    }

    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      totalHits,
      expired,
      hitRate: totalHits > 0 ? (totalHits / this.cache.size).toFixed(2) : 0,
      byAPI
    };
  }

  /**
   * Invalidar caché para una API específica
   */
  invalidate(apiName) {
    let removed = 0;
    
    for (const [key, entry] of this.cache.entries()) {
      if (entry.apiName === apiName) {
        this.cache.delete(key);
        this.removeFromAccessOrder(key);
        removed++;
      }
    }

    Logger.info(`[CACHE] Invalidado ${removed} entradas para ${apiName}`);
    return removed;
  }

  /**
   * Limpiar todo el caché
   */
  clear() {
    this.cache.clear();
    this.accessOrder = [];
    Logger.info('[CACHE] Caché completamente limpiado');
  }

  /**
   * Destruir y limpiar recursos
   */
  destroy() {
    clearInterval(this.cleanupInterval);
    this.clear();
  }
}

// Singleton
let instance = null;

module.exports = { 
  RequestCache,
  getRequestCache: () => {
    if (!instance) {
      instance = new RequestCache();
    }
    return instance;
  }
};