/*
 * Text_LENGTH_mainProcessor.js
 * Exports createAsyncProcessor(words, frag, globalState, options)
 * This encapsulates the cooperative main-thread processing logic so the
 * dashboard can offload rendering and state updates to a dedicated module.
 */

// rely on global exposeToWindow (set by Text_LENGTH_expose.js)

export function createAsyncProcessor(words, frag, globalState, options = {}) {
    const getWordLen = (options && typeof options.getWordLen === 'function') ? options.getWordLen : (w) => Array.from(w).length;
    const wordLengthsEl = (options && options.wordLengthsEl) || (typeof document !== 'undefined' ? document.getElementById('wordLengths') : null);

    return function processAsyncFromIndex(startIndex, batchSize = 200, delay = 0) {
        return new Promise((resolve) => {
            let i = startIndex;
            let aborted = false;
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

                    if (len > globalState.globalMax) { globalState.globalMax = len; globalState.globalMaxWords.length = 0; globalState.globalMaxWords.push(word); }
                    else if (len === globalState.globalMax) { globalState.globalMaxWords.push(word); }
                    if (len < globalState.globalMin) { globalState.globalMin = len; globalState.globalMinWords.length = 0; globalState.globalMinWords.push(word); }
                    else if (len === globalState.globalMin) { globalState.globalMinWords.push(word); }
                }

                // Maintain Maps for faster unique-word grouping and lookups where available
                try {
                    for (let j = Math.max(startIndex, 0); j < end; j++) {
                        const w = words[j];
                        const l = getWordLen(w);
                        if (!globalState.wordToLen) break; // if maps not present, skip
                        if (!globalState.wordToLen.has(w)) globalState.wordToLen.set(w, l);
                        let s = globalState.lenToWords.get(l);
                        if (!s) { s = new Set(); globalState.lenToWords.set(l, s); }
                        s.add(w);
                        // Maintain frequency counts (increment per occurrence) when requested
                        if (globalState.freqMap) {
                            try {
                                globalState.freqMap.set(w, (globalState.freqMap.get(w) || 0) + 1);
                            } catch (e2) { /* ignore per-entry errors */ }
                        }
                    }
                } catch (e) { /* ignore Map/Set failures */ }

                if (wordLengthsEl && frag.childNodes.length > 0) {
                try { if (typeof exposeToWindow === 'function') exposeToWindow('Text_LENGTH_mainProcessor', 'createAsyncProcessor', createAsyncProcessor); } catch (e) { try { if (typeof window !== 'undefined') { window.Text_LENGTH_mainProcessor = window.Text_LENGTH_mainProcessor || {}; window.Text_LENGTH_mainProcessor.createAsyncProcessor = createAsyncProcessor; } } catch (e2) {} }
                }

                if (i < words.length) {
                    if (typeof requestIdleCallback === 'function') {
                        requestIdleCallback(step, { timeout: 50 });
                    } else {
                        setTimeout(step, delay);
                    }
                } else {
                    if (wordLengthsEl && frag.childNodes.length > 0) wordLengthsEl.appendChild(frag);
                    try { if (typeof window !== 'undefined') window.__TextLength_abortMainProcessing = null; } catch (e) {}
                    resolve();
                }
            }
            step();
        });
    };
}
// Optional compatibility shim for legacy non-module pages
try {
    if (typeof window !== 'undefined') {
        window.Text_LENGTH_mainProcessor = window.Text_LENGTH_mainProcessor || {};
        window.Text_LENGTH_mainProcessor.createAsyncProcessor = createAsyncProcessor;
    }
} catch (e) { /* ignore */ }
