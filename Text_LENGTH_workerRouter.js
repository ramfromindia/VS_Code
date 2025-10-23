/*
 * Text_LENGTH_workerRouter.js
 * Encapsulates logic to obtain a worker-runner that conforms to the
 * { promise, terminate } contract. Prefers window-attached runner,
 * then dynamic import of Text_LENGTH_workerRunner.js, then fallback module.
 */

export async function getWorkerRunner(chunks, options = {}) {
    try {
        if (typeof window !== 'undefined' && window.Text_LENGTH_workerRunner && typeof window.Text_LENGTH_workerRunner.runWorker === 'function') {
            return window.Text_LENGTH_workerRunner.runWorker(chunks, undefined, options);
        }
    } catch (e) { /* ignore */ }

    try {
        const mod = await import('./Text_LENGTH_workerRunner.js');
        if (mod && typeof mod.runWorker === 'function') return mod.runWorker(chunks, undefined, options);
    } catch (e) { /* ignore */ }

    try {
        const mod = await import('./Text_LENGTH_Worker_fallback.js');
        if (mod && typeof mod.runWorkerFallback === 'function') return mod.runWorkerFallback(chunks, undefined, options);
    } catch (e) { /* ignore */ }

    return {
        promise: Promise.reject({ kind: 'creation-failure', error: new Error('Worker fallback module unavailable') }),
        terminate: function () {}
    };
}

// Expose to window for legacy usage
try {
    if (typeof window !== 'undefined') {
        window.Text_LENGTH_workerRouter = window.Text_LENGTH_workerRouter || {};
        window.Text_LENGTH_workerRouter.getWorkerRunner = getWorkerRunner;
    }
} catch (e) { /* ignore */ }
