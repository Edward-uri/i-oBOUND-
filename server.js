// server.js - Punto de entrada con Cluster Manager
const cluster = require('cluster');
const os = require('os');
const http = require('http');
const url = require('url');
const { Router } = require('./src/routes/router');
const { WorkerThreadPool } = require('./src/workers/workerThreadPool');
const { Logger } = require('./src/utils/logger');

const PORT = process.env.PORT || 3000;
const NUM_WORKERS = process.env.NUM_WORKERS || os.cpus().length;

if (cluster.isMaster || cluster.isPrimary) {
  // Proceso Maestro - Cluster Manager
  Logger.info(`[MASTER] Iniciando cluster con ${NUM_WORKERS} workers`);
  Logger.info(`[MASTER] PID: ${process.pid}`);

  // Crear workers
  for (let i = 0; i < NUM_WORKERS; i++) {
    const worker = cluster.fork();
    Logger.info(`[MASTER] Worker ${worker.process.pid} creado`);
  }

  // Manejar muerte de workers y reiniciarlos
  cluster.on('exit', (worker, code, signal) => {
    Logger.error(`[MASTER] Worker ${worker.process.pid} murió (${signal || code})`);
    Logger.info('[MASTER] Iniciando nuevo worker...');
    cluster.fork();
  });

  // Estadísticas cada 30 segundos
  setInterval(() => {
    const workers = Object.values(cluster.workers);
    Logger.info(`[MASTER] Workers activos: ${workers.length}`);
  }, 30000);

} else {
  // Proceso Worker - Servidor HTTP
  const router = new Router();
  const workerPool = new WorkerThreadPool(4); // Pool de 4 worker threads

  // Hacer el pool disponible globalmente para los servicios
  global.workerThreadPool = workerPool;

  const server = http.createServer(async (req, res) => {
    const parsedUrl = url.parse(req.url, true);
    const pathname = parsedUrl.pathname;
    const method = req.method;

    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }

    try {
      // Parsear body si existe
      let body = '';
      req.on('data', chunk => {
        body += chunk.toString();
      });

      req.on('end', async () => {
        try {
          req.body = body ? JSON.parse(body) : {};
        } catch (e) {
          req.body = {};
        }

        req.query = parsedUrl.query;

        // Ejecutar router
        const result = await router.handle(pathname, method, req, res);

        if (!result) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ 
            error: 'Not Found',
            path: pathname 
          }));
        }
      });

    } catch (error) {
      Logger.error(`[WORKER ${process.pid}] Error: ${error.message}`);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        error: 'Internal Server Error',
        message: error.message 
      }));
    }
  });

  server.listen(PORT, () => {
    Logger.info(`[WORKER ${process.pid}] Escuchando en puerto ${PORT}`);
  });

  // Graceful shutdown
  process.on('SIGTERM', () => {
    Logger.info(`[WORKER ${process.pid}] SIGTERM recibido, cerrando...`);
    server.close(() => {
      workerPool.shutdown();
      process.exit(0);
    });
  });
}