// Fallback worker runner moved out of the main dashboard for maintainability.
// Exports a runWorkerFallback function that mirrors the original inline
// runner contract: returns { promise, terminate } and forwards worker
// messages to an optional onMessage callback provided in options.

export function runWorkerFallback(chunksToProcess, workerPath = 'textLengthWorker.js', options = {}) {
    let worker;
    const onMessageCb = options && typeof options.onMessage === 'function' ? options.onMessage : null;

    const p = new Promise((resolve, reject) => {
        try {
            worker = new Worker(workerPath);
        } catch (err) {
            reject({ kind: 'creation-failure', error: err });
            return;
        }

        let processedWords = 0;
        let chunksProcessed = 0;

        worker.onmessage = function (ev) {
            const msg = ev.data || {};

            // Forward the raw message to the caller if they requested message callbacks
            try { if (onMessageCb) onMessageCb(msg); } catch (e) { /* swallow handler errors */ }

            if (msg.type === 'result') {
                const items = msg.items || [];
                processedWords += items.length;
                // Count one processed chunk per result message (matches previous contract)
                chunksProcessed += 1;
                if (chunksProcessed >= chunksToProcess.length) {
                    try { worker.terminate(); } catch (e) { /* ignore */ }
                    resolve({ processedCount: processedWords });
                }
            } else if (msg.type === 'error') {
                try { worker.terminate(); } catch (e) { /* ignore */ }
                reject({ kind: 'worker-error', error: msg.error, processedCount: processedWords });
            }
        };

        worker.onerror = function (ev) {
            try { worker.terminate(); } catch (e) { /* ignore */ }
            reject({ kind: 'worker-runtime-error', error: ev, processedCount: processedWords });
        };

        // Send each chunk to the worker
        for (let i = 0; i < chunksToProcess.length; i++) {
            try { worker.postMessage({ type: 'process', words: chunksToProcess[i] }); } catch (e) {
                try { worker.terminate(); } catch (t) { /* ignore */ }
                reject({ kind: 'postMessage-failure', error: e, processedCount: processedWords });
                return;
            }
        }
    });

    return {
        promise: p,
        terminate: function () { try { if (worker) worker.terminate(); } catch (e) { /* ignore */ } }
    };
}
