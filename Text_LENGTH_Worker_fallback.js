// Thin wrapper for backward compatibility. When included as a non-module
// script we expose a runWorkerFallback function that delegates to the
// canonical implementation on window.Text_LENGTH_workerRunner.runWorker.

export function runWorkerFallback(chunksToProcess, workerPath = 'textLengthWorker.js', options = {}) {
	try {
		if (typeof window !== 'undefined' && window.Text_LENGTH_workerRunner && typeof window.Text_LENGTH_workerRunner.runWorker === 'function') {
			return window.Text_LENGTH_workerRunner.runWorker(chunksToProcess, workerPath, options);
		}
	} catch (e) { /* ignore */ }
	return {
		promise: Promise.reject({ kind: 'creation-failure', error: new Error('Worker runner unavailable') }),
		terminate: function () {}
	};
}

// Optional compatibility shim
try {
	if (typeof window !== 'undefined') {
		window.Text_LENGTH_Worker_fallback = window.Text_LENGTH_Worker_fallback || {};
		window.Text_LENGTH_Worker_fallback.runWorkerFallback = runWorkerFallback;
	}
} catch (e) { /* ignore */ }
