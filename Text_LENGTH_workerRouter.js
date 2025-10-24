/*
 * Text_LENGTH_workerRouter.js
 * Encapsulates logic to obtain a worker-runner that conforms to the
 * { promise, terminate } contract. Prefers window-attached runner,
 * then dynamic import of Text_LENGTH_workerRunner.js, then fallback module.
 */

// rely on global exposeToWindow (set by Text_LENGTH_expose.js)

async function getWorkerRunner(chunks, options = {}) {
    try {
        if (typeof window !== 'undefined' && window.Text_LENGTH_workerRunner && typeof window.Text_LENGTH_workerRunner.runWorker === 'function') {
            return window.Text_LENGTH_workerRunner.runWorker(chunks, undefined, options);
        }
    } catch (e) { /* ignore */ }

    // If workerRunner is not available on the window, try the compatibility alias
    try {
        if (typeof window !== 'undefined' && window.Text_LENGTH_workerRunner && typeof window.Text_LENGTH_workerRunner.runWorkerFallback === 'function') {
            return window.Text_LENGTH_workerRunner.runWorkerFallback(chunks, undefined, options);
        }
    } catch (e) { /* ignore */ }

    return {
        promise: Promise.reject({ kind: 'creation-failure', error: new Error('Worker fallback module unavailable') }),
        terminate: function () {}
    };
}

// Expose to window for legacy usage (use helper to keep logic consistent)
try { if (typeof exposeToWindow === 'function') exposeToWindow('Text_LENGTH_workerRouter', 'getWorkerRunner', getWorkerRunner); } catch (e) { try { if (typeof window !== 'undefined') { window.Text_LENGTH_workerRouter = window.Text_LENGTH_workerRouter || {}; window.Text_LENGTH_workerRouter.getWorkerRunner = getWorkerRunner; } } catch (e2) {} }
