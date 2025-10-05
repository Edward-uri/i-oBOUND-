// src/workers/dataProcessor.js
const { parentPort } = require('worker_threads');

// Este worker procesa y agrega datos de múltiples APIs
parentPort.on('message', (task) => {
  try {
    const { type, data } = task;

    switch (type) {
      case 'aggregate':
        const result = aggregateData(data);
        parentPort.postMessage(result);
        break;

      case 'transform':
        const transformed = transformData(data);
        parentPort.postMessage(transformed);
        break;

      case 'filter':
        const filtered = filterData(data, task.criteria);
        parentPort.postMessage(filtered);
        break;

      default:
        parentPort.postMessage(data);
    }
  } catch (error) {
    parentPort.postMessage({ error: error.message });
  }
});

function aggregateData(dataArray) {
  // Procesar y agregar datos de múltiples fuentes
  const aggregated = {
    totalSources: dataArray.length,
    timestamp: new Date().toISOString(),
    summary: {},
    allData: []
  };

  dataArray.forEach(item => {
    const { source, data, timestamp } = item;
    
    // Agregar a resumen por fuente
    aggregated.summary[source] = {
      receivedAt: timestamp,
      dataKeys: Object.keys(data)
    };

    // Combinar todos los datos
    aggregated.allData.push({
      source,
      ...data
    });
  });

  // Calcular algunas estadísticas
  aggregated.stats = calculateStats(aggregated.allData);

  return aggregated;
}

function transformData(data) {
  // Transformar datos (ejemplo: normalizar estructuras)
  return data.map(item => {
    return {
      ...item,
      processed: true,
      processedAt: new Date().toISOString()
    };
  });
}

function filterData(data, criteria) {
  // Filtrar datos según criterios
  if (!criteria) return data;

  return data.filter(item => {
    for (const [key, value] of Object.entries(criteria)) {
      if (item[key] !== value) return false;
    }
    return true;
  });
}

function calculateStats(dataArray) {
  // Calcular estadísticas básicas
  return {
    totalItems: dataArray.length,
    sources: [...new Set(dataArray.map(item => item.source))],
    hasUsers: dataArray.some(item => item.users),
    hasPosts: dataArray.some(item => item.posts),
    hasFacts: dataArray.some(item => item.catFact || item.dogFacts)
  };
}