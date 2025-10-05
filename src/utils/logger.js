// src/utils/logger.js
const fs = require('fs');
const path = require('path');

class Logger {
  static observers = [];
  static logFile = path.join(__dirname, '../../logs/app.log');

  static subscribe(observer) {
    this.observers.push(observer);
  }

  static notify(level, message) {
    this.observers.forEach(observer => {
      observer.update(level, message);
    });
  }

  static log(level, message) {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [${level}] ${message}`;

    // Console
    console.log(logMessage);

    // Notificar observers
    this.notify(level, message);

    // Escribir a archivo (asíncrono, no bloqueante)
    this.writeToFile(logMessage);
  }

  static writeToFile(message) {
    const logsDir = path.dirname(this.logFile);
    
    // Crear directorio si no existe
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }

    fs.appendFile(this.logFile, message + '\n', (err) => {
      if (err) {
        console.error('Error escribiendo log:', err);
      }
    });
  }

  static info(message) {
    this.log('INFO', message);
  }

  static warn(message) {
    this.log('WARN', message);
  }

  static error(message) {
    this.log('ERROR', message);
  }

  static debug(message) {
    if (process.env.DEBUG === 'true') {
      this.log('DEBUG', message);
    }
  }
}

// Observer ejemplo para métricas
class MetricsObserver {
  constructor() {
    this.metrics = {
      info: 0,
      warn: 0,
      error: 0
    };
  }

  update(level, message) {
    if (this.metrics[level.toLowerCase()] !== undefined) {
      this.metrics[level.toLowerCase()]++;
    }
  }

  getMetrics() {
    return this.metrics;
  }
}

module.exports = { Logger, MetricsObserver };