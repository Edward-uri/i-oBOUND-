

const https = require('https');
const http = require('http');
const { URL } = require('url');
const { CircuitBreaker } = require('../utils/circuitBreaker');
const { Logger } = require('../utils/logger');
const { getRateLimiter } = require('../utils/rateLimiter');
const { ExponentialBackoff } = require('../utils/exponentialBackoff');
const { getRequestCache } = require('../utils/requestCache');

class BaseAPIClient {
  constructor(config) {
    this.name = config.name;
    this.url = config.url;
    this.parser = config.parser || (data => data);
    this.circuitBreaker = new CircuitBreaker(this.name);
    this.cacheTTL = config.cacheTTL || 60000; // 60 segundos por defecto
    
    // Connection pooling con agentes HTTP
    this.httpAgent = new http.Agent({
      keepAlive: true,
      maxSockets: 10,
      keepAliveMsecs: 30000
    });
    
    this.httpsAgent = new https.Agent({
      keepAlive: true,
      maxSockets: 10,
      keepAliveMsecs: 30000
    });

    // Rate limiter compartido
    this.rateLimiter = getRateLimiter();
    
    // Exponential backoff para reintentos
    this.backoff = new ExponentialBackoff({
      maxRetries: 3,
      baseDelay: 1000,
      maxDelay: 10000
    });

    // Cache compartido
    this.cache = getRequestCache();
  }

  async fetch() {
    // Verificar circuit breaker
    if (!this.circuitBreaker.canExecute()) {
      Logger.warn(`[API CLIENT] Circuit breaker OPEN para ${this.name}, intentando caché...`);
      
      // Intentar obtener de caché (incluso si está expirado)
      const cached = this.cache.get(this.cache.generateKey(this.name));
      if (cached) {
        return {
          source: this.name,
          data: cached,
          timestamp: new Date().toISOString(),
          fromCache: true,
          stale: true
        };
      }
      
      throw new Error(`Circuit breaker OPEN for ${this.name}`);
    }

    try {
      // Usar cache con coalescing (evita requests duplicados)
      const result = await this.cache.coalesce(
        this.name,
        () => this.fetchWithRateLimitAndRetry(),
        {},
        this.cacheTTL
      );

      this.circuitBreaker.recordSuccess();
      
      return {
        source: this.name,
        data: result.data.data,
        timestamp: result.data.timestamp,
        fromCache: result.fromCache,
        cacheAge: result.cacheAge
      };
      
    } catch (error) {
      this.circuitBreaker.recordFailure();
      Logger.error(`[API CLIENT] ${this.name} falló: ${error.message}`);
      throw error;
    }
  }

  async fetchWithRateLimitAndRetry() {
    // Rate limiting + exponential backoff
    return await this.rateLimiter.execute(
      this.name,
      () => this.backoff.execute(
        () => this.makeRequest(),
        this.name
      )
    );
  }

  makeRequest() {
    return new Promise((resolve, reject) => {
      const parsedUrl = new URL(this.url);
      const protocol = parsedUrl.protocol === 'https:' ? https : http;
      const agent = parsedUrl.protocol === 'https:' ? this.httpsAgent : this.httpAgent;

      const options = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port,
        path: parsedUrl.pathname + parsedUrl.search,
        method: 'GET',
        agent: agent,
        headers: {
          'User-Agent': 'Node.js API Aggregator',
          'Accept': 'application/json'
        }
      };

      const req = protocol.request(options, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          try {
            if (res.statusCode >= 200 && res.statusCode < 300) {
              const parsed = JSON.parse(data);
              resolve(parsed);
            } else {
              reject(new Error(`HTTP ${res.statusCode}`));
            }
          } catch (error) {
            reject(new Error('Invalid JSON response'));
          }
        });
      });

      req.on('error', (error) => {
        reject(error);
      });

      req.setTimeout(4000, () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });

      req.end();
    });
  }
}

module.exports = { BaseAPIClient };