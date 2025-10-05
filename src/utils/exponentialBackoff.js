// src/utils/exponentialBackoff.js
const { Logger } = require('./logger');

/**
 * Implementa Exponential Backoff con Jitter
 * Útil para reintentar requests que fallan con 429
 */
class ExponentialBackoff {
  constructor(options = {}) {
    this.maxRetries = options.maxRetries || 5;
    this.baseDelay = options.baseDelay || 1000; // 1 segundo
    this.maxDelay = options.maxDelay || 32000;  // 32 segundos
    this.factor = options.factor || 2;
    this.jitter = options.jitter !== false;     // true por defecto
  }

  /**
   * Ejecutar función con reintentos automáticos
   */
  async execute(fn, context = 'request') {
    let lastError;
    
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        // Intentar ejecutar
        const result = await fn();
        
        if (attempt > 0) {
          Logger.info(`[BACKOFF] ${context} exitoso después de ${attempt} reintentos`);
        }
        
        return result;

      } catch (error) {
        lastError = error;
        
        // Si es el último intento, lanzar error
        if (attempt === this.maxRetries) {
          Logger.error(`[BACKOFF] ${context} falló después de ${this.maxRetries} reintentos`);
          throw error;
        }

        // Verificar si es un error que vale la pena reintentar
        if (!this.shouldRetry(error)) {
          Logger.warn(`[BACKOFF] ${context} - error no reintentar: ${error.message}`);
          throw error;
        }

        // Calcular delay con exponential backoff
        const delay = this.calculateDelay(attempt);
        
        Logger.warn(`[BACKOFF] ${context} falló (intento ${attempt + 1}/${this.maxRetries}), reintentando en ${delay}ms...`);
        
        // Esperar antes de reintentar
        await this.wait(delay);
      }
    }

    throw lastError;
  }

  /**
   * Calcular delay con exponential backoff y jitter
   */
  calculateDelay(attempt) {
    // Exponential: baseDelay * (factor ^ attempt)
    let delay = this.baseDelay * Math.pow(this.factor, attempt);
    
    // Limitar al máximo
    delay = Math.min(delay, this.maxDelay);
    
    // Agregar jitter (aleatorización) para evitar thundering herd
    if (this.jitter) {
      // Jitter entre 0% y 100% del delay
      const jitterAmount = Math.random() * delay;
      delay = jitterAmount;
    }
    
    return Math.floor(delay);
  }

  /**
   * Determinar si vale la pena reintentar
   */
  shouldRetry(error) {
    // Errores de red/timeout siempre se reintentan
    if (error.code === 'ETIMEDOUT' || 
        error.code === 'ECONNRESET' ||
        error.code === 'ENOTFOUND') {
      return true;
    }

    // 429 (Rate Limit) - definitivamente reintentar
    if (error.message.includes('429') || 
        error.message.includes('Too Many Requests')) {
      return true;
    }

    // 503 (Service Unavailable) - reintentar
    if (error.message.includes('503')) {
      return true;
    }

    // 500, 502, 504 (Server errors) - reintentar
    if (error.message.includes('500') || 
        error.message.includes('502') ||
        error.message.includes('504')) {
      return true;
    }

    // 4xx (Client errors excepto 429) - NO reintentar
    if (error.message.match(/HTTP [4]\d{2}/)) {
      return false;
    }

    // Por defecto, reintentar
    return true;
  }

  wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = { ExponentialBackoff };