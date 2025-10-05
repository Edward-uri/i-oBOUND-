// src/strategies/aggregationStrategyFactory.js
const { BestEffortStrategy } = require('./bestEffortStrategy');
const { AllOrNothingStrategy } = require('./allOrNothingStrategy');
const { CachedFallbackStrategy } = require('./cachedFallbackStrategy');

class AggregationStrategyFactory {
  constructor() {
    this.strategies = {
      'best-effort': BestEffortStrategy,
      'all-or-nothing': AllOrNothingStrategy,
      'cached-fallback': CachedFallbackStrategy
    };
  }

  createStrategy(type) {
    const StrategyClass = this.strategies[type];
    
    if (!StrategyClass) {
      throw new Error(`Unknown strategy type: ${type}`);
    }

    return new StrategyClass();
  }
}

module.exports = { AggregationStrategyFactory };