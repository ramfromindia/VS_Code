/*
 * Text_LENGTH_workerRunner.js
 * Exports runWorker(chunks, workerUrl?) => { promise, terminate }
 * Implements robust worker creation, message handling and termination.
 */

function runWorker(chunksToProcess, workerUrl = 'textLengthWorker.js', options = {}) {
    let worker;
    let processedWords = 0;
    let remainingChunks = chunksToProcess.length;

    const p = new Promise((resolve, reject) => {
        try {
            worker = new Worker(workerUrl);
        } catch (err) {
            reject({ kind: 'creation-failure', error: err });
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
                reject({ kind: 'worker-error', error: msg.error, processedCount: processedWords });
            }
        };

        worker.onerror = function (ev) {
            try { worker.terminate(); } catch (e) {}
            reject({ kind: 'worker-runtime-error', error: ev, processedCount: processedWords });
        };

        // Send chunks to the worker
        for (let i = 0; i < chunksToProcess.length; i++) {
            try { worker.postMessage({ type: 'process', words: chunksToProcess[i] }); } catch (e) {
                try { worker.terminate(); } catch (t) {}
                reject({ kind: 'postMessage-failure', error: e, processedCount: processedWords });
                return;
            }
        }
    });

    return {
        promise: p,
        terminate: function () { try { if (worker) worker.terminate(); } catch (e) {} }
    };
}
// Expose to window for non-module inclusion (exposeToWindow provided globally)
try { if (typeof exposeToWindow === 'function') exposeToWindow('Text_LENGTH_workerRunner', 'runWorker', runWorker); } catch (e) { try { if (typeof window !== 'undefined') { window.Text_LENGTH_workerRunner = window.Text_LENGTH_workerRunner || {}; window.Text_LENGTH_workerRunner.runWorker = runWorker; } } catch (e2) {} }

// Provide a compatibility wrapper named runWorkerFallback so callers that
// expect the older name can still call the same symbol.
function runWorkerFallback(chunksToProcess, workerPath = 'textLengthWorker.js', options = {}) {
    return runWorker(chunksToProcess, workerPath, options);
}

// Also expose the compatibility alias on the window object
try { if (typeof exposeToWindow === 'function') exposeToWindow('Text_LENGTH_workerRunner', 'runWorkerFallback', runWorkerFallback); } catch (e) { try { if (typeof window !== 'undefined') { window.Text_LENGTH_workerRunner = window.Text_LENGTH_workerRunner || {}; window.Text_LENGTH_workerRunner.runWorkerFallback = runWorkerFallback; } } catch (e2) {} }
