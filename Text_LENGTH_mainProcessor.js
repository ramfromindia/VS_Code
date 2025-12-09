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
      try { if (typeof window !== 'undefined') { window.__TextLength_abortMainProcessing = function () { aborted = true; }; } } catch (e) {}

      function processChunk(start, end) {
        for (let k = start; k < end; k++) {
          const word = words[k];
          const len = getWordLen(word);
          const li = document.createElement('li');
          li.textContent = `${word} (${len})`;
          frag.appendChild(li);

          if (len > globalState.globalMax) {
            globalState.globalMax = len;
            globalState.globalMaxWords.length = 0;
            globalState.globalMaxWords.push(word);
          } else if (len === globalState.globalMax) {
            globalState.globalMaxWords.push(word);
          }

          if (len < globalState.globalMin) {
            globalState.globalMin = len;
            globalState.globalMinWords.length = 0;
            globalState.globalMinWords.push(word);
          } else if (len === globalState.globalMin) {
            globalState.globalMinWords.push(word);
          }
        }
      }

      function maintainMaps(from, to) {
        if (!globalState.wordToLen) { return; }
        try {
          for (let j = Math.max(startIndex, 0); j < to; j++) {
            const w = words[j];
            const l = getWordLen(w);
            if (!globalState.wordToLen.has(w)) { globalState.wordToLen.set(w, l); }
            let s = globalState.lenToWords.get(l);
            if (!s) { s = new Set(); globalState.lenToWords.set(l, s); }
            s.add(w);
            if (globalState.freqMap) {
              try { globalState.freqMap.set(w, (globalState.freqMap.get(w) || 0) + 1); } catch (e) { /* ignore per-entry errors */ }
            }
          }
        } catch (e) { /* ignore Map/Set failures */ }
      }

      function tryExpose() {
        if (!wordLengthsEl || frag.childNodes.length === 0) { return; }
        try {
          if (typeof exposeToWindow === 'function') {
            exposeToWindow('Text_LENGTH_mainProcessor', 'createAsyncProcessor', createAsyncProcessor);
            return;
          }
        } catch (e) { /* fallthrough to fallback */ }
        try {
          if (typeof window !== 'undefined') {
            window.Text_LENGTH_mainProcessor = window.Text_LENGTH_mainProcessor || {};
            window.Text_LENGTH_mainProcessor.createAsyncProcessor = createAsyncProcessor;
          }
        } catch (e) { /* ignore */ }
      }

      function clearAbortHandle() {
        try { if (typeof window !== 'undefined') { window.__TextLength_abortMainProcessing = null; } } catch (e) {}
      }

      function step() {
        if (aborted) { clearAbortHandle(); resolve(); return; }
        const end = Math.min(i + batchSize, words.length);
        processChunk(i, end);
        maintainMaps(i, end);
        tryExpose();
        i = end;

        if (i < words.length) {
          if (typeof requestIdleCallback === 'function') {
            requestIdleCallback(step, { timeout: 50 });
          } else {
            setTimeout(step, delay);
          }
        } else {
          if (wordLengthsEl && frag.childNodes.length > 0) { wordLengthsEl.appendChild(frag); }
          clearAbortHandle();
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
