// Universal worker compatible with both module-type workers and classic
// dedicated workers. When run as a module worker it may dynamically import
// utilities; when run as a classic worker it falls back to an internal
// implementation (no static `import`/`export` so the same file works both ways).

(async function () {
    'use strict';

    // Optionally attempt to load helper utilities when running as a module
    // worker. `importScripts` exists only in classic worker contexts, so
    // when it's undefined we are likely in a module worker and can use
    // dynamic import(). Any failure here is non-fatal; worker has an
    // internal implementation as a fallback.
    let helpers = null;
    const isClassic = (typeof importScripts === 'function');
    if (!isClassic) {
        try {
            // dynamic import works in module workers; this lets the worker
            // optionally share code with other ES modules (e.g. tokenizers).
            helpers = await import('./Text_LENGTH_tokenize.js').catch(() => null);
        } catch (e) {
            helpers = null;
        }
    }

    // Internal processor — identical logic to previous worker: compute per-word
    // lengths (Unicode code point aware), chunk min/max and arrays of words.
    function processChunk(words) {
        const items = new Array(words.length);
        let minLen = Infinity, maxLen = 0;
        const minWords = [];
        const maxWords = [];

        // Map/Set helpers for efficient grouping and counting inside the worker
        const wordToLen = new Map();
        const lenToWords = new Map(); // len -> Set(words)
        const freqMap = new Map();

        for (let i = 0; i < words.length; i++) {
            const w = words[i];
            const len = Array.from(w).length; // Unicode code-point aware
            items[i] = { word: w, len };

            if (len > maxLen) {
                maxLen = len; maxWords.length = 0; maxWords.push(w);
            } else if (len === maxLen) {
                maxWords.push(w);
            }

            if (len < minLen) {
                minLen = len; minWords.length = 0; minWords.push(w);
            } else if (len === minLen) {
                minWords.push(w);
            }

            // Populate maps/sets (kept inside worker to avoid extra main-thread work)
            try {
                if (!wordToLen.has(w)) wordToLen.set(w, len);
                let s = lenToWords.get(len);
                if (!s) { s = new Set(); lenToWords.set(len, s); }
                s.add(w);
                freqMap.set(w, (freqMap.get(w) || 0) + 1);
            } catch (e) { /* ignore Map/Set errors in constrained environments */ }
        }

        // Serialize extras to plain arrays for maximum compatibility across contexts
        const minUniqueWords = Array.from(lenToWords.get(minLen) || []);
        const maxUniqueWords = Array.from(lenToWords.get(maxLen) || []);
        const lenToWordsEntries = Array.from(lenToWords.entries()).map(([l, set]) => [l, Array.from(set)]);
        const freqEntries = Array.from(freqMap.entries());

        return {
            items,
            minLen: minLen === Infinity ? 0 : minLen,
            minWords,
            maxLen,
            maxWords,
            // non-breaking extras (serialized forms)
            minUniqueWords,
            maxUniqueWords,
            lenToWordsEntries,
            freqEntries
        };
    }

    // Message handler — same shape as before
    self.onmessage = function (ev) {
        const msg = ev.data || {};
        try {
            if (msg.type === 'process' && Array.isArray(msg.words)) {
                // If helpers were loaded and they export specialized logic we
                // could use them here. For now, processChunk is sufficient and
                // avoids coupling; helpers may be used for future extensions.
                const result = processChunk(msg.words);
                self.postMessage(Object.assign({ type: 'result' }, result));
            }
        } catch (err) {
            self.postMessage({ type: 'error', error: String(err) });
        }
    };

})();
