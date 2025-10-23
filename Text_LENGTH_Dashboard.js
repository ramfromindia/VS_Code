const analyzeBtn = document.getElementById('analyzeBtn');
const form = document.getElementById('analyzeForm');
const wordLengthsEl = document.getElementById('wordLengths'); // now a <ul>
const mostCommonWordsEl = document.getElementById('mostCommonWords'); // visual summary region
const leastCommonWordsEl = document.getElementById('leastCommonWords'); // visual summary region
const resultsSection = document.getElementById('results'); // used for aria-busy
const srAnnouncer = document.getElementById('sr-announcer'); // single, atomic announcer

/* Autofocus and small UI helper functions were moved to
   Text_LENGTH_helperUI.js to keep dashboard logic focused on processing.
   That file exposes: clearResults, renderNoWordsFound, finalizeAndAnnounce
   and also performs the initial textarea focus on DOMContentLoaded. */


form?.addEventListener('submit', function (e) { e.preventDefault(); analyzeWordLengths(); });


async function analyzeWordLengths() {
    let input = document.getElementById('inputText').value ?? '';

    // helper: Unicode code-point aware length
    const getWordLen = (w) => Array.from(w).length;

    // Signal that results are being prepared so assistive technologies
    // know the region is busy. Also prevent duplicate submits by disabling the button.
    resultsSection?.setAttribute('aria-busy', 'true');
    if (analyzeBtn) {
        analyzeBtn.disabled = true;
        analyzeBtn.setAttribute('aria-disabled', 'true');
    }

    // If a previous worker/processing run is still active, terminate/abort it so
    // we don't get cross-run messages or DOM updates.
    try {
        if (typeof window !== 'undefined' && window.__TextLength_currentRunner && typeof window.__TextLength_currentRunner.terminate === 'function') {
            try { window.__TextLength_currentRunner.terminate(); } catch (e) {}
        }
    } catch (e) {}
    try { if (typeof window !== 'undefined') window.__TextLength_currentRunner = null; } catch (e) {}
    try {
        if (typeof window !== 'undefined' && typeof window.__TextLength_abortMainProcessing === 'function') {
            try { window.__TextLength_abortMainProcessing(); } catch (e) {}
        }
    } catch (e) {}
    try { if (typeof window !== 'undefined') window.__TextLength_abortMainProcessing = null; } catch (e) {}

    // Attempt to use the external tokenize module if available. This uses
    // a dynamic import where supported; otherwise falls back to a local
    // implementation (keeps behavior identical to previous single-file code).
    async function getTokens(s) {
        // Prefer window-attached module (if loader included it)
        try {
            if (typeof window !== 'undefined' && window.Text_LENGTH_tokenize && typeof window.Text_LENGTH_tokenize.tokenize === 'function') {
                return window.Text_LENGTH_tokenize.tokenize(s);
            }
        } catch (e) { /* ignore */ }

        // Try dynamic import (when script served as module)
        try {
            const mod = await import('./Text_LENGTH_tokenize.js');
            if (mod && typeof mod.tokenize === 'function') return mod.tokenize(s);
        } catch (e) {
            // dynamic import failed — fall back to local
        }

        // Local fallback: normalize apostrophes and tokenization (identical logic)
        s = s.replace(/[’‘]/g, "'");
        let wordPattern;
        try { new RegExp("\\p{L}", "u"); wordPattern = /[\p{L}\p{N}]+(?:['-][\p{L}\p{N}]+)*/gu; }
        catch (e) { wordPattern = /[A-Za-z0-9]+(?:['-][A-Za-z0-9]+)*/g; }
        return s.match(wordPattern) ?? [];
    }

    // Tokenize on main thread, then send chunks to the worker for processing.
    const words = await getTokens(input);
    // Clear previous results (visual only). Implementation moved to Text_LENGTH_helperUI.js
    clearResults();

    if (!words.length) {
        renderNoWordsFound();
        return;
    }

    // Chunking strategy: send moderate-sized chunks to the worker to avoid
    // large messages while keeping overhead low. Tunable size depending on use-case.
    const CHUNK_SIZE = 1000; // words per chunk (adjustable)
    function chunkArray(arr, size) {
        const out = [];
        for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
        return out;
    }

    const chunks = chunkArray(words, CHUNK_SIZE);

    // Aggregation state
    const frag = document.createDocumentFragment();
    let globalMin = Infinity, globalMax = 0;
    const globalMinWords = [];
    const globalMaxWords = [];

    // Number of chunks remaining (kept in outer scope so timeout/fallback can read it)
    let remainingChunks = chunks.length;
    // Accurate count of how many words have been processed (worker results)
    let processedWords = 0;

    // Helper: cooperative async processing so main thread isn't blocked
    function processAsyncFromIndex(startIndex, batchSize = 200, delay = 0) {
        return new Promise((resolve) => {
            let i = startIndex;
            let aborted = false;
            // expose an abort function for this run so subsequent runs can cancel it
            try { if (typeof window !== 'undefined') window.__TextLength_abortMainProcessing = function () { aborted = true; }; } catch (e) {}

            function step() {
                if (aborted) { try { if (typeof window !== 'undefined') window.__TextLength_abortMainProcessing = null; } catch (e) {} ; resolve(); return; }
                const end = Math.min(i + batchSize, words.length);
                for (; i < end; i++) {
                    const word = words[i];
                    const len = getWordLen(word);
                    const li = document.createElement('li');
                    li.textContent = `${word} (${len})`;
                    frag.appendChild(li);

                    if (len > globalMax) { globalMax = len; globalMaxWords.length = 0; globalMaxWords.push(word); }
                    else if (len === globalMax) { globalMaxWords.push(word); }
                    if (len < globalMin) { globalMin = len; globalMinWords.length = 0; globalMinWords.push(word); }
                    else if (len === globalMin) { globalMinWords.push(word); }
                }

                // Append partial results periodically to avoid huge DOM ops each tick.
                if (wordLengthsEl && frag.childNodes.length > 0) {
                    wordLengthsEl.appendChild(frag);
                }

                if (i < words.length) {
                    if (typeof requestIdleCallback === 'function') {
                        requestIdleCallback(step, { timeout: 50 });
                    } else {
                        setTimeout(step, delay);
                    }
                } else {
                    // Ensure any remaining fragment is appended
                    if (wordLengthsEl && frag.childNodes.length > 0) wordLengthsEl.appendChild(frag);
                    try { if (typeof window !== 'undefined') window.__TextLength_abortMainProcessing = null; } catch (e) {}
                    resolve();
                }
            }
            step();
        });
    }

    // Prefer external worker runner module if available, otherwise fall back
    // to the inline implementation below (which keeps original behavior).
    async function getWorkerRunner(chunks, options = {}) {
        // If a window-provided runner exists, use it
        try {
            if (typeof window !== 'undefined' && window.Text_LENGTH_workerRunner && typeof window.Text_LENGTH_workerRunner.runWorker === 'function') {
                return window.Text_LENGTH_workerRunner.runWorker(chunks, undefined, options);
            }
        } catch (e) { /* ignore */ }

        // Try dynamic import
        try {
            const mod = await import('./Text_LENGTH_workerRunner.js');
            if (mod && typeof mod.runWorker === 'function') return mod.runWorker(chunks, undefined, options);
        } catch (e) {
            // import failed; fall back
        }

        // Inline fallback moved to external module for maintainability. Try dynamic
        // import of the fallback, otherwise fall back to the old inline behavior.
        try {
            const mod = await import('./Text_LENGTH_Worker_fallback.js');
            if (mod && typeof mod.runWorkerFallback === 'function') {
                return mod.runWorkerFallback(chunks, undefined, options);
            }
        } catch (e) {
            // import failed — fall back to inline old behavior below
        }

        // The fallback implementation was moved to `Text_LENGTH_Worker_fallback.js`.
        // If that dynamic import failed earlier, signal a creation-failure so the
        // higher-level logic will fall back to the main-thread processing.
        return {
            promise: Promise.reject({ kind: 'creation-failure', error: new Error('Worker fallback module unavailable') }),
            terminate: function () {}
        };
    }

    // finalizeAndAnnounce implementation moved to Text_LENGTH_helperUI.js

    // Attempt to run worker processing and fall back to async main-thread processing on failure or timeout
    const WORKER_TIMEOUT_MS = 4000; // tuneable timeout
    // Handler to process worker messages and keep aggregation/rendering identical
    function workerMessageHandler(msg) {
        if (!msg) return;
        // Ensure we're only handling messages for the currently active runner
        try { if (typeof window !== 'undefined' && window.__TextLength_currentRunner !== runner) return; } catch (e) { }
        if (msg.type === 'result') {
            const items = msg.items || [];
            for (let i = 0; i < items.length; i++) {
                const it = items[i];
                const li = document.createElement('li');
                li.textContent = `${it.word} (${it.len})`;
                frag.appendChild(li);
            }

            // Update processed words count accurately (use items length)
            processedWords += items.length;

            // Merge chunk min/max into global min/max while preserving first-seen order
            if (typeof msg.maxLen === 'number') {
                if (msg.maxLen > globalMax) {
                    globalMax = msg.maxLen; globalMaxWords.length = 0; Array.prototype.push.apply(globalMaxWords, msg.maxWords || []);
                } else if (msg.maxLen === globalMax) {
                    Array.prototype.push.apply(globalMaxWords, msg.maxWords || []);
                }
            }
            if (typeof msg.minLen === 'number') {
                if (msg.minLen < globalMin) {
                    globalMin = msg.minLen; globalMinWords.length = 0; Array.prototype.push.apply(globalMinWords, msg.minWords || []);
                } else if (msg.minLen === globalMin) {
                    Array.prototype.push.apply(globalMinWords, msg.minWords || []);
                }
            }
        } else if (msg.type === 'error') {
            console.error('Worker error:', msg.error);
        }
    }

    const runner = await getWorkerRunner(chunks, { onMessage: workerMessageHandler });
    try { if (typeof window !== 'undefined') window.__TextLength_currentRunner = runner; } catch (e) {}

    // Wrap the runner.promise to handle creation-failure in-place so Promise.race
    // doesn't immediately reject and cause duplicate fallback work.
    runner.promise = runner.promise.catch(async (err) => {
        if (err && err.kind === 'creation-failure') {
            const warn = document.createElement('div');
            warn.textContent = 'Web Worker unavailable  falling back to main-thread processing.';
            warn.setAttribute('role', 'status');
            warn.classList.add('worker-warning');
            if (resultsSection) resultsSection.insertBefore(warn, resultsSection.firstChild);
            if (srAnnouncer) srAnnouncer.textContent = 'Worker unavailable; running analysis on the main thread.';
            setTimeout(function () { try { if (warn && warn.parentNode) warn.parentNode.removeChild(warn); } catch (e) {} }, 4000);
            await processAsyncFromIndex(0);
            // Signal to the rest of the flow that the fallback already handled work.
            return { fallbackHandled: true };
        }
        // Re-throw other errors so the outer catch can handle them.
        throw err;
    });

    // Race the worker against a timeout — if timeout wins, terminate worker and fallback
    const timeoutPromise = new Promise((resolve) => {
        setTimeout(() => resolve({ timedOut: true, processedCount: words.length - (remainingChunks * CHUNK_SIZE) }), WORKER_TIMEOUT_MS);
    });

    Promise.race([runner.promise, timeoutPromise])
        .then(async (result) => {
            // If the wrapped promise signalled that fallback already handled the work,
            // stop here to avoid duplicate processing.
            if (result && result.fallbackHandled) return;

            if (result && result.timedOut) {
                // Worker didn't finish in time — terminate and fallback asynchronously
                runner.terminate();
                const alreadyProcessed = result.processedCount || 0;
                await processAsyncFromIndex(alreadyProcessed);
            } else {
                // Worker finished successfully; append the fragment
                wordLengthsEl?.appendChild(frag);
            }
        })
        .catch(async (err) => {
            // Worker failed; fall back to async main-thread processing for remainder
            console.error('Worker failed or rejected:', err);
            const processedCount = (err && err.processedCount) ? err.processedCount : processedWords;
            await processAsyncFromIndex(processedCount);
        })
        .finally(() => {
            finalizeAndAnnounce(words.length, globalMin, globalMinWords, globalMax, globalMaxWords);
        });
}

// Helper UI implementations were moved to Text_LENGTH_helperUI.js
