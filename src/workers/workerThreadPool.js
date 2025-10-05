// src/workers/workerThreadPool.js
const { Worker } = require('worker_threads');
const path = require('path');
const { Logger } = require('../utils/logger');

class WorkerThreadPool {
  constructor(size = 4) {
    this.size = size;
    this.workers = [];
    this.availableWorkers = [];
    this.taskQueue = [];
    this.workerScript = path.join(__dirname, 'dataProcessor.js');

    this.initialize();
  }

  initialize() {
    for (let i = 0; i < this.size; i++) {
      const worker = new Worker(this.workerScript);
      
      worker.on('error', (error) => {
        Logger.error(`[WORKER THREAD ${worker.threadId}] Error: ${error.message}`);
      });

      worker.on('exit', (code) => {
        if (code !== 0) {
          Logger.error(`[WORKER THREAD ${worker.threadId}] Salió con código ${code}`);
          // Remover de la lista de workers
          this.workers = this.workers.filter(w => w !== worker);
          this.availableWorkers = this.availableWorkers.filter(w => w !== worker);
        }
      });

      this.workers.push(worker);
      this.availableWorkers.push(worker);
    }

    Logger.info(`[WORKER POOL] Inicializado con ${this.size} worker threads`);
  }

  execute(task) {
    return new Promise((resolve, reject) => {
      const job = { task, resolve, reject };

      if (this.availableWorkers.length > 0) {
        this.runTask(job);
      } else {
        // Encolar tarea si no hay workers disponibles
        this.taskQueue.push(job);
        Logger.info(`[WORKER POOL] Tarea encolada. Cola: ${this.taskQueue.length}`);
      }
    });
  }

  runTask(job) {
    const worker = this.availableWorkers.shift();
    
    const messageHandler = (result) => {
      // Worker terminó, devolverlo al pool
      this.availableWorkers.push(worker);
      worker.removeListener('message', messageHandler);
      worker.removeListener('error', errorHandler);
      
      job.resolve(result);

      // Procesar siguiente tarea en cola
      if (this.taskQueue.length > 0) {
        const nextJob = this.taskQueue.shift();
        this.runTask(nextJob);
      }
    };

    const errorHandler = (error) => {
      this.availableWorkers.push(worker);
      worker.removeListener('message', messageHandler);
      worker.removeListener('error', errorHandler);
      
      job.reject(error);

      if (this.taskQueue.length > 0) {
        const nextJob = this.taskQueue.shift();
        this.runTask(nextJob);
      }
    };

    worker.once('message', messageHandler);
    worker.once('error', errorHandler);
    worker.postMessage(job.task);
  }

  shutdown() {
    Logger.info('[WORKER POOL] Cerrando worker threads...');
    this.workers.forEach(worker => {
      worker.terminate();
    });
    this.workers = [];
    this.availableWorkers = [];
    this.taskQueue = [];
  }

  getStats() {
    return {
      totalWorkers: this.size,
      availableWorkers: this.availableWorkers.length,
      queuedTasks: this.taskQueue.length,
      busyWorkers: this.size - this.availableWorkers.length
    };
  }
}

module.exports = { WorkerThreadPool };