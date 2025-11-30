/*
 * Text_LENGTH_workerRunner.js
 * Exports runWorker(chunks, workerUrl?) => { promise, terminate }
 * Implements robust worker creation, message handling and termination.
 */

export function runWorker(chunksToProcess, workerUrl = 'textLengthWorker.js', options = {}) {
  let worker;
  let processedWords = 0;
  let remainingChunks = chunksToProcess.length;

  const p = new Promise((resolve, reject) => {
    // Prefer module-type workers (allows using import inside workers).
    // Fall back to classic workers if module workers are unsupported.
    try {
      try {
        const moduleUrl = new URL(workerUrl, import.meta.url);
        worker = new Worker(moduleUrl, { type: 'module' });
      } catch (moduleErr) {
        // Module worker creation failed (older browser or worker script not resolvable)
        try {
          worker = new Worker(workerUrl);
        } catch (classicErr) {
          // Both attempts failed — reject with the original module error for debugging
          reject(new Error(JSON.stringify({ kind: 'creation-failure', error: moduleErr || classicErr })));
          return;
        }
      }
    } catch (err) {
      reject(new Error(JSON.stringify({ kind: 'creation-failure', error: err })));
      return;
    }

    worker.onmessage = function (ev) {
      const msg = ev.data || {};
      // Let caller render/merge item-level data if they provided a handler
      try {
        if (options && typeof options.onMessage === 'function') {
          try { options.onMessage(msg); } catch (e) { /* caller handler error should not break worker flow */ }
        }
      } catch (e) { /* ignore */ }

      if (msg.type === 'result') {
        processedWords += (msg.items && msg.items.length) ? msg.items.length : 0;
        remainingChunks -= 1;
        if (remainingChunks <= 0) {
          try { worker.terminate(); } catch (e) { /* ignore */ }
          resolve({ processedCount: processedWords });
        }
      } else if (msg.type === 'error') {
        try { worker.terminate(); } catch (e) {}
        reject(new Error(JSON.stringify({ kind: 'worker-error', error: msg.error, processedCount: processedWords })));
      }
    };

    worker.onerror = function (ev) {
      try { worker.terminate(); } catch (e) {}
      reject(new Error(JSON.stringify({ kind: 'worker-runtime-error', error: ev, processedCount: processedWords })));
    };

    // Send chunks to the worker
    for (let i = 0; i < chunksToProcess.length; i++) {
      try {
        // includeExtras is optional; pass through to worker so it can avoid
        // computing extra structures unless requested.
        const includeExtras = options && options.includeExtras === true;
        worker.postMessage({ type: 'process', words: chunksToProcess[i], extras: includeExtras });
      } catch (e) {
        try { worker.terminate(); } catch (t) {}
        reject(new Error(JSON.stringify({ kind: 'postMessage-failure', error: e, processedCount: processedWords })));
        return;
      }
    }
  });

  return {
    promise: p,
    terminate: function () { try { if (worker) {worker.terminate();} } catch (e) {} }
  };
}
// Optional compatibility shim
try {
  if (typeof window !== 'undefined') {
    window.Text_LENGTH_workerRunner = window.Text_LENGTH_workerRunner || {};
    window.Text_LENGTH_workerRunner.runWorker = runWorker;
  }
} catch (e) { /* ignore */ }

export function runWorkerFallback(chunksToProcess, workerPath = 'textLengthWorker.js', options = {}) {
  return runWorker(chunksToProcess, workerPath, options);
}

try {
  if (typeof window !== 'undefined') {
    window.Text_LENGTH_workerRunner = window.Text_LENGTH_workerRunner || {};
    window.Text_LENGTH_workerRunner.runWorkerFallback = runWorkerFallback;
  }
} catch (e) { /* ignore */ }
