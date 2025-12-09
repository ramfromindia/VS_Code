/*
 * Text_LENGTH_workerRouter.js
 * Encapsulates logic to obtain a worker-runner that conforms to the
 * { promise, terminate } contract. Prefers window-attached runner,
 * then dynamic import of Text_LENGTH_workerRunner.js, then fallback module.
 */

// rely on global exposeToWindow (set by Text_LENGTH_expose.js)

export async function getWorkerRunner(chunks, options = {}) {
  // Prefer module-exported router if imported; otherwise fall back to
  // window-attached legacy runner symbols (compatibility mode).
  try {
    if (typeof getWorkerRunner === 'function' && getWorkerRunner !== arguments.callee) {
      // if this function was imported and is being called, just continue
    }
  } catch (e) { /* ignore */ }

  try {
    if (typeof window !== 'undefined' && window.Text_LENGTH_workerRunner && typeof window.Text_LENGTH_workerRunner.runWorker === 'function') {
      return window.Text_LENGTH_workerRunner.runWorker(chunks, undefined, options);
    }
  } catch (e) { /* ignore */ }

  try {
    if (typeof window !== 'undefined' && window.Text_LENGTH_workerRunner && typeof window.Text_LENGTH_workerRunner.runWorkerFallback === 'function') {
      return window.Text_LENGTH_workerRunner.runWorkerFallback(chunks, undefined, options);
    }
  } catch (e) { /* ignore */ }

  return {
    promise: Promise.reject(new Error(JSON.stringify({ kind: 'creation-failure', error: new Error('Worker fallback module unavailable') }))),
    terminate: function () { /* intentionally empty - conforms to { promise, terminate } contract */ }
  };
}

// Optional compatibility shim
try {
  if (typeof window !== 'undefined') {
    window.Text_LENGTH_workerRouter = window.Text_LENGTH_workerRouter || {};
    window.Text_LENGTH_workerRouter.getWorkerRunner = getWorkerRunner;
  }
} catch (e) { /* ignore */ }
