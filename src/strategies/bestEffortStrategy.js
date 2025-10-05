// src/strategies/bestEffortStrategy.js
const { Logger } = require('../utils/logger');

class BestEffortStrategy {
  async aggregate(results) {
    const successful = [];
    const failed = [];

    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        successful.push(result.value);
      } else {
        failed.push({
          index,
          reason: result.reason.message
        });
        Logger.warn(`[STRATEGY] API ${index} falló: ${result.reason.message}`);
      }
    });

    return {
      data: successful,
      successful: successful.length,
      failed: failed.length,
      failedAPIs: failed
    };
  }
}

module.exports = { BestEffortStrategy };