// src/strategies/allOrNothingStrategy.js
class AllOrNothingStrategy {
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
      }
    });

    // Si alguna falló, lanzar error
    if (failed.length > 0) {
      throw new Error(`All or Nothing: ${failed.length} APIs fallaron`);
    }

    return {
      data: successful,
      successful: successful.length,
      failed: 0,
      failedAPIs: []
    };
  }
}

module.exports = { AllOrNothingStrategy };