// src/utils/circuitBreaker.js
const { Logger } = require('./logger');

class CircuitBreaker {
  constructor(name, options = {}) {
    this.name = name;
    this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
    this.failures = 0;
    this.threshold = options.threshold || 5; // Fallos antes de abrir
    this.timeout = options.timeout || 60000; // 60 segundos antes de intentar de nuevo
    this.lastFailureTime = null;
    this.successThreshold = options.successThreshold || 2; // Éxitos para cerrar
    this.successCount = 0;
  }

  canExecute() {
    if (this.state === 'CLOSED') {
      return true;
    }

    if (this.state === 'OPEN') {
      const now = Date.now();
      const timeSinceLastFailure = now - this.lastFailureTime;

      if (timeSinceLastFailure >= this.timeout) {
        Logger.info(`[CIRCUIT BREAKER] ${this.name} cambiando a HALF_OPEN`);
        this.state = 'HALF_OPEN';
        this.successCount = 0;
        return true;
      }

      return false;
    }

    // HALF_OPEN - permitir intentos
    return true;
  }

  recordSuccess() {
    if (this.state === 'HALF_OPEN') {
      this.successCount++;

      if (this.successCount >= this.successThreshold) {
        Logger.info(`[CIRCUIT BREAKER] ${this.name} cambiando a CLOSED`);
        this.state = 'CLOSED';
        this.failures = 0;
        this.successCount = 0;
      }
    } else if (this.state === 'CLOSED') {
      // Reset failures on success
      this.failures = 0;
    }
  }

  recordFailure() {
    this.failures++;
    this.lastFailureTime = Date.now();

    if (this.failures >= this.threshold && this.state === 'CLOSED') {
      Logger.warn(`[CIRCUIT BREAKER] ${this.name} cambiando a OPEN después de ${this.failures} fallos`);
      this.state = 'OPEN';
    } else if (this.state === 'HALF_OPEN') {
      Logger.warn(`[CIRCUIT BREAKER] ${this.name} volviendo a OPEN`);
      this.state = 'OPEN';
      this.successCount = 0;
    }
  }
}

module.exports = { CircuitBreaker };