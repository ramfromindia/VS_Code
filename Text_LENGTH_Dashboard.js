const analyzeBtn = document.getElementById('analyzeBtn');
const form = document.getElementById('analyzeForm');
const wordLengthsEl = document.getElementById('wordLengths'); // now a <ul>
const mostCommonWordsEl = document.getElementById('mostCommonWords'); // visual summary region
const leastCommonWordsEl = document.getElementById('leastCommonWords'); // visual summary region
const resultsSection = document.getElementById('results'); // used for aria-busy
const srAnnouncer = document.getElementById('sr-announcer'); // single, atomic announcer

/* Autofocus management: focus the main textarea on initial page load for better UX
   but avoid forcing the on-screen keyboard on mobile devices. Use preventScroll
   where available and fall back gracefully for older browsers. */
document.addEventListener('DOMContentLoaded', () => {
    const ta = document.getElementById('inputText');
    if (!ta) return;

    // Basic mobile detection: avoid opening the virtual keyboard automatically
    const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

    if (!isMobile) {
        try {
            ta.focus({ preventScroll: true });
        } catch (e) {
            // Older browsers may not support the options object
            ta.focus();
        }
    }
});


form?.addEventListener('submit', function (e) { e.preventDefault(); analyzeWordLengths(); });


function analyzeWordLengths() {
    let input = document.getElementById('inputText').value ?? '';

    // Signal that results are being prepared so assistive technologies
    // know the region is busy. Also prevent duplicate submits by disabling the button.
    resultsSection?.setAttribute('aria-busy', 'true');
    if (analyzeBtn) {
        analyzeBtn.disabled = true;
        analyzeBtn.setAttribute?.('aria-disabled', 'true');
    }

    // Normalize typographic apostrophes to straight ASCII apostrophe
    input = input.replace(/[’‘]/g, "'");

    // Build a word pattern. Prefer Unicode property escapes if supported,
    // otherwise fall back to an ASCII-safe pattern to avoid runtime SyntaxError
    // on older browsers (older Edge/IE). The fallback supports letters/digits
    // in the ASCII range and still preserves internal hyphens/apostrophes.
    let wordPattern;
    try {
        new RegExp("\\p{L}", "u");
        wordPattern = /[\p{L}\p{N}]+(?:['-][\p{L}\p{N}]+)*/gu;
    } catch (e) {
        wordPattern = /[A-Za-z0-9]+(?:['-][A-Za-z0-9]+)*/g;
    }

    // Tokenize on main thread, then send chunks to the worker for processing.
    const words = input.match(wordPattern) ?? [];
    // Clear previous results (visual only).
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

    let remaining = chunks.length;

    // Create worker and wire message handler
    let worker;
    try {
        worker = new Worker('textLengthWorker.js');
    } catch (err) {
        // If Worker not available, fall back to synchronous processing with minimal logic change.
        console.warn('Web Worker unavailable, falling back to main-thread processing.', err);
        // process synchronously using same algorithm as before
        for (let i = 0; i < words.length; i++) {
            const word = words[i];
            const len = Array.from(word).length;
            const li = document.createElement('li');
            li.textContent = `${word} (${len})`;
            frag.appendChild(li);

            if (len > globalMax) {
                globalMax = len; globalMaxWords.length = 0; globalMaxWords.push(word);
            } else if (len === globalMax) {
                globalMaxWords.push(word);
            }
            if (len < globalMin) {
                globalMin = len; globalMinWords.length = 0; globalMinWords.push(word);
            } else if (len === globalMin) {
                globalMinWords.push(word);
            }
        }
        // Append results and finalize
        wordLengthsEl?.appendChild(frag);
        finalizeAndAnnounce(words.length, globalMin, globalMinWords, globalMax, globalMaxWords);
        return;
    }

    worker.onmessage = function (ev) {
        const msg = ev.data || {};
        if (msg.type === 'result') {
            // Append list items for this chunk
            const items = msg.items || [];
            for (let i = 0; i < items.length; i++) {
                const it = items[i];
                const li = document.createElement('li');
                li.textContent = `${it.word} (${it.len})`;
                frag.appendChild(li);
            }

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

            remaining -= 1;
            if (remaining <= 0) {
                // All chunks processed
                wordLengthsEl?.appendChild(frag);
                // Terminate worker for cleanup
                try { worker.terminate(); } catch (e) { /* ignore */ }
                finalizeAndAnnounce(words.length, globalMin, globalMinWords, globalMax, globalMaxWords);
            }
        } else if (msg.type === 'error') {
            console.error('Worker error:', msg.error);
            // fallback: terminate worker and sync process the rest (simpler fallback path)
            try { worker.terminate(); } catch (e) {}
            // process synchronously remaining chunks (rare path)
            // flatten remaining chunks into a single array slice and process
            const processedCount = words.length - (remaining * CHUNK_SIZE);
            for (let i = processedCount; i < words.length; i++) {
                const word = words[i];
                const len = Array.from(word).length;
                const li = document.createElement('li');
                li.textContent = `${word} (${len})`;
                frag.appendChild(li);
                if (len > globalMax) { globalMax = len; globalMaxWords.length = 0; globalMaxWords.push(word); }
                else if (len === globalMax) { globalMaxWords.push(word); }
                if (len < globalMin) { globalMin = len; globalMinWords.length = 0; globalMinWords.push(word); }
                else if (len === globalMin) { globalMinWords.push(word); }
            }
            wordLengthsEl?.appendChild(frag);
            finalizeAndAnnounce(words.length, globalMin, globalMinWords, globalMax, globalMaxWords);
        }
    };

    // Send each chunk to the worker
    for (let i = 0; i < chunks.length; i++) {
        worker.postMessage({ type: 'process', words: chunks[i] });
    }

    // Finalize: update the textual summaries and announcer, and re-enable UI
    function finalizeAndAnnounce(totalWords, minLen, minWordsArr, maxLen, maxWordsArr) {
        // Deduplicate while preserving order
        const uniqueMax = [...new Set(maxWordsArr)];
        const uniqueMin = [...new Set(minWordsArr)];

        (mostCommonWordsEl) && (mostCommonWordsEl.textContent = uniqueMax.map(function (w) { return `${w} (${maxLen})`; }).join(', ') || 'N/A');
        (leastCommonWordsEl) && (leastCommonWordsEl.textContent = uniqueMin.map(function (w) { return `${w} (${minLen})`; }).join(', ') || 'N/A');

        if (srAnnouncer) {
            srAnnouncer.textContent = `Analysis complete. ${totalWords} ${totalWords === 1 ? 'word' : 'words'}. Longest: ${uniqueMax.join(', ')} (${maxLen}). Shortest: ${uniqueMin.join(', ')} (${minLen}).`;
        }

        resultsSection?.setAttribute('aria-busy', 'false');
        if (analyzeBtn) {
            analyzeBtn.disabled = false;
            analyzeBtn.removeAttribute?.('aria-disabled');
        }
    }
}

function clearResults() {
    // Clear list items and status text safely
    if (wordLengthsEl) {
        while (wordLengthsEl.firstChild) wordLengthsEl.removeChild(wordLengthsEl.firstChild);
    }
    if (mostCommonWordsEl) mostCommonWordsEl.textContent = '';
    if (leastCommonWordsEl) leastCommonWordsEl.textContent = '';
    // Clear announcer as well to avoid stale text being read on focus
    if (srAnnouncer) srAnnouncer.textContent = '';
}

function renderNoWordsFound() {
    if (wordLengthsEl) {
        const li = document.createElement('li');
        li.textContent = 'No words found.';
        wordLengthsEl.appendChild(li);
    }
    if (mostCommonWordsEl) mostCommonWordsEl.textContent = 'N/A';
    if (leastCommonWordsEl) leastCommonWordsEl.textContent = 'N/A';
    // Announce the empty result to screen readers via the single announcer
    if (srAnnouncer) srAnnouncer.textContent = 'No words found.';
}
