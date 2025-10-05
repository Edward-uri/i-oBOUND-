// src/controllers/healthController.js
class HealthController {
  async check(req, res) {
    const health = {
      status: 'OK',
      timestamp: new Date().toISOString(),
      workerId: process.pid,
      uptime: process.uptime(),
      memory: process.memoryUsage()
    };

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(health));
  }
}

module.exports = { HealthController };