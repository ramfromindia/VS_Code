import { tokenize as tokenizeImport } from './Text_LENGTH_tokenize.js';
import { createAsyncProcessor as createAsyncProcessorImport } from './Text_LENGTH_mainProcessor.js';
import { clearResults, renderNoWordsFound, finalizeAndAnnounce, showProgress, hideProgress } from './Text_LENGTH_helperUI.js';
import { getWorkerRunner as getWorkerRunnerImport } from './Text_LENGTH_workerRouter.js';

const analyzeBtn = document.getElementById('analyzeBtn');
const form = document.getElementById('analyzeForm');
const wordLengthsEl = document.getElementById('wordLengths'); // now a <ul>
const mostCommonWordsEl = document.getElementById('mostCommonWords'); // visual summary region
const leastCommonWordsEl = document.getElementById('leastCommonWords'); // visual summary region
const resultsSection = document.getElementById('results'); // used for aria-busy
const srAnnouncer = document.getElementById('sr-announcer'); // single, atomic announcer
const includeExtrasEl = document.getElementById('includeExtras');

/* Autofocus and small UI helper functions were moved to
   Text_LENGTH_helperUI.js to keep dashboard logic focused on processing.
   That file exposes: clearResults, renderNoWordsFound, finalizeAndAnnounce
   and also performs the initial textarea focus on DOMContentLoaded. */


form?.addEventListener('submit', function (e) { e.preventDefault(); analyzeWordLengths(); });


async function analyzeWordLengths() {
  const input = document.getElementById('inputText').value ?? '';

  // helper: Unicode code-point aware length
  const getWordLen = (w) => Array.from(w).length;

  // --- small helpers to improve readability ---
  function setupUIState() {
    resultsSection?.setAttribute('aria-busy', 'true');
    if (analyzeBtn) {
      analyzeBtn.disabled = true;
      analyzeBtn.setAttribute('aria-disabled', 'true');
    }
  }

  function teardownPreviousRun() {
    try {
      if (typeof window !== 'undefined' && window.__TextLength_currentRunner && typeof window.__TextLength_currentRunner.terminate === 'function') {
        try { window.__TextLength_currentRunner.terminate(); } catch (e) {}
      }
    } catch (e) {}
    try { if (typeof window !== 'undefined') {window.__TextLength_currentRunner = null;} } catch (e) {}
    try {
      if (typeof window !== 'undefined' && typeof window.__TextLength_abortMainProcessing === 'function') {
        try { window.__TextLength_abortMainProcessing(); } catch (e) {}
      }
    } catch (e) {}
    try { if (typeof window !== 'undefined') {window.__TextLength_abortMainProcessing = null;} } catch (e) {}
  }

  // Attempt to use the imported tokenize module if available; otherwise
  // fall back to an inline tokenizer for maximum robustness.
  async function getTokens(s) {
    try {
      if (typeof tokenizeImport === 'function') {return tokenizeImport(s);}
    } catch (e) { /* ignore */ }

    // Inline fallback (same logic as previous implementation)
    s = s.replace(/[’‘]/g, '\'');
    let wordPattern;
    try { new RegExp('\\p{L}', 'u'); wordPattern = /[\p{L}\p{N}]+(?:['-][\p{L}\p{N}]+)*/gu; } catch (e) { wordPattern = /[A-Za-z0-9]+(?:['-][A-Za-z0-9]+)*/g; }
    return s.match(wordPattern) ?? [];
  }

  // Chunk helper
  function chunkArray(arr, size) {
    const out = [];
    for (let i = 0; i < arr.length; i += size) {out.push(arr.slice(i, i + size));}
    return out;
  }

  // Cooperative async processing: prefer external module, fallback to inline
  async function resolveCreateAsyncProcessor(words, frag, globalState) {
    // Prefer imported module
    try {
      if (typeof createAsyncProcessorImport === 'function') {
        return createAsyncProcessorImport(words, frag, globalState, { getWordLen, wordLengthsEl });
      }
    } catch (e) { /* ignore */ }

    // Inline fallback (same behavior as before)
    return (function _inlineCreate(wordsLocal, fragLocal, globalStateLocal) {
      return function processAsyncFromIndex(startIndex, batchSize = 200, delay = 0) {
        return new Promise((resolve) => {
          let i = startIndex;
          let aborted = false;
          try { if (typeof window !== 'undefined') {window.__TextLength_abortMainProcessing = function () { aborted = true; };} } catch (e) {}

          function step() {
            if (aborted) { try { if (typeof window !== 'undefined') {window.__TextLength_abortMainProcessing = null;} } catch (e) {} resolve(); return; }
            const end = Math.min(i + batchSize, wordsLocal.length);
            for (; i < end; i++) {
              const word = wordsLocal[i];
              const len = getWordLen(word);
              const li = document.createElement('li');
              li.textContent = `${word} (${len})`;
              fragLocal.appendChild(li);

              if (len > globalStateLocal.globalMax) { globalStateLocal.globalMax = len; globalStateLocal.globalMaxWords.length = 0; globalStateLocal.globalMaxWords.push(word); } else if (len === globalStateLocal.globalMax) { globalStateLocal.globalMaxWords.push(word); }
              if (len < globalStateLocal.globalMin) { globalStateLocal.globalMin = len; globalStateLocal.globalMinWords.length = 0; globalStateLocal.globalMinWords.push(word); } else if (len === globalStateLocal.globalMin) { globalStateLocal.globalMinWords.push(word); }
            }

            // Maintain Maps and frequency counts when extras are requested
            try {
              for (let j = Math.max(startIndex, 0); j < end; j++) {
                const w = wordsLocal[j];
                const l = getWordLen(w);
                if (!globalStateLocal.wordToLen) {break;}
                if (!globalStateLocal.wordToLen.has(w)) {globalStateLocal.wordToLen.set(w, l);}
                let s = globalStateLocal.lenToWords.get(l);
                if (!s) { s = new Set(); globalStateLocal.lenToWords.set(l, s); }
                s.add(w);
                if (globalStateLocal.freqMap) {
                  try {
                    globalStateLocal.freqMap.set(w, (globalStateLocal.freqMap.get(w) || 0) + 1);
                  } catch (e2) { /* ignore per-entry errors */ }
                }
              }
            } catch (e) { /* ignore Map/Set failures */ }

            if (wordLengthsEl && fragLocal.childNodes.length > 0) {
              wordLengthsEl.appendChild(fragLocal);
            }

            if (i < wordsLocal.length) {
              if (typeof requestIdleCallback === 'function') {
                requestIdleCallback(step, { timeout: 50 });
              } else {
                setTimeout(step, delay);
              }
            } else {
              if (wordLengthsEl && fragLocal.childNodes.length > 0) {wordLengthsEl.appendChild(fragLocal);}
              try { if (typeof window !== 'undefined') {window.__TextLength_abortMainProcessing = null;} } catch (e) {}
              resolve();
            }
          }
          step();
        });
      };
    }(words, frag, globalState));
  }

  // Prefer external worker runner module if available; delegate to workerRouter
  async function resolveGetWorkerRunner(chunks, options = {}) {
    try {
      if (typeof getWorkerRunnerImport === 'function') {return getWorkerRunnerImport(chunks, options);}
    } catch (e) { /* ignore */ }

    // Fall back to legacy window-attached symbols if present
    try {
      if (typeof window !== 'undefined' && window.Text_LENGTH_workerRouter && typeof window.Text_LENGTH_workerRouter.getWorkerRunner === 'function') {
        return window.Text_LENGTH_workerRouter.getWorkerRunner(chunks, options);
      }
    } catch (e) { /* ignore */ }

    try {
      if (typeof window !== 'undefined' && window.Text_LENGTH_workerRunner && typeof window.Text_LENGTH_workerRunner.runWorker === 'function') {
        return window.Text_LENGTH_workerRunner.runWorker(chunks, undefined, options);
      }
    } catch (e) { /* ignore */ }

    try {
      if (typeof window !== 'undefined' && window.Text_LENGTH_workerRunner && typeof window.Text_LENGTH_workerRunner.runWorkerFallback === 'function') {
        return window.Text_LENGTH_workerRunner.runWorkerFallback(chunks, undefined, options);
      }
    } catch (e) { /* ignore */ }

    return {
      promise: Promise.reject(new Error(JSON.stringify({ kind: 'creation-failure', error: new Error('Worker fallback module unavailable') }))),
      terminate: function () {}
    };
  }

  // --- begin orchestrator ---
  setupUIState();
  // Show the JS-driven progress bar while worker/fallback processing runs
  try { if (typeof showProgress === 'function') {showProgress();} } catch (e) {}
  teardownPreviousRun();

  const words = await getTokens(input);
  clearResults();

  if (!words.length) {
    renderNoWordsFound();
    return;
  }

  const CHUNK_SIZE = 1000;
  const chunks = chunkArray(words, CHUNK_SIZE);

  const frag = document.createDocumentFragment();
  const includeExtrasRequested = !!(includeExtrasEl && includeExtrasEl.checked);
  const globalState = (function () {
    const base = { globalMin: Infinity, globalMax: 0, globalMinWords: [], globalMaxWords: [] };
    if (includeExtrasRequested) {
      base.wordToLen = new Map();
      base.lenToWords = new Map();
      base.freqMap = new Map();
    }
    try { if (typeof window !== 'undefined') {window.__TextLength_globalState = base;} } catch (e) {}
    return base;
  }());

  const remainingChunks = chunks.length;
  let processedWords = 0;

  const processAsyncFromIndex = await resolveCreateAsyncProcessor(words, frag, globalState);

  const WORKER_TIMEOUT_MS = 4000;

  function workerMessageHandler(msg) {
    if (!msg) {return;}
    try { if (typeof window !== 'undefined' && window.__TextLength_currentRunner !== runner) {return;} } catch (e) { }
    if (msg.type === 'result') {
      const items = msg.items || [];
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        const li = document.createElement('li');
        li.textContent = `${it.word} (${it.len})`;
        frag.appendChild(li);

        // keep Maps in sync with worker results for fast lookups
        try {
          if (!globalState.wordToLen.has(it.word)) {globalState.wordToLen.set(it.word, it.len);}
          let s = globalState.lenToWords.get(it.len);
          if (!s) { s = new Set(); globalState.lenToWords.set(it.len, s); }
          s.add(it.word);
        } catch (e) { /* ignore Map/Set failures */ }
      }

      processedWords += items.length;

      if (typeof msg.maxLen === 'number') {
        if (msg.maxLen > globalState.globalMax) {
          globalState.globalMax = msg.maxLen; globalState.globalMaxWords.length = 0; Array.prototype.push.apply(globalState.globalMaxWords, msg.maxWords || []);
        } else if (msg.maxLen === globalState.globalMax) {
          Array.prototype.push.apply(globalState.globalMaxWords, msg.maxWords || []);
        }
      }
      if (typeof msg.minLen === 'number') {
        if (msg.minLen < globalState.globalMin) {
          globalState.globalMin = msg.minLen; globalState.globalMinWords.length = 0; Array.prototype.push.apply(globalState.globalMinWords, msg.minWords || []);
        } else if (msg.minLen === globalState.globalMin) {
          Array.prototype.push.apply(globalState.globalMinWords, msg.minWords || []);
        }
      }

      // Consume worker-provided extras (serialized Maps/sets) when available
      try {
        if (includeExtrasRequested) {
          if (Array.isArray(msg.minUniqueWords)) {
            globalState.globalMinWords = msg.minUniqueWords.slice();
          }
          if (Array.isArray(msg.maxUniqueWords)) {
            globalState.globalMaxWords = msg.maxUniqueWords.slice();
          }

          if (Array.isArray(msg.lenToWordsEntries) && globalState.lenToWords) {
            msg.lenToWordsEntries.forEach(function (entry) {
              try {
                const lenKey = Number(entry[0]);
                const arr = Array.isArray(entry[1]) ? entry[1] : [];
                let s = globalState.lenToWords.get(lenKey);
                if (!s) { s = new Set(); globalState.lenToWords.set(lenKey, s); }
                for (let k = 0; k < arr.length; k++) {
                  const w = arr[k];
                  s.add(w);
                  if (globalState.wordToLen && !globalState.wordToLen.has(w)) {globalState.wordToLen.set(w, lenKey);}
                }
              } catch (e) { /* ignore per-entry errors */ }
            });
          }

          if (Array.isArray(msg.freqEntries) && globalState.freqMap) {
            msg.freqEntries.forEach(function (pair) {
              try {
                const w = pair[0];
                const cnt = Number(pair[1]) || 0;
                globalState.freqMap.set(w, (globalState.freqMap.get(w) || 0) + cnt);
              } catch (e) { /* ignore per-entry errors */ }
            });
          }
        }
      } catch (e) { /* ignore extras parsing errors */ }
    } else if (msg.type === 'error') {
      console.error('Worker error:', msg.error);
    }
  }

  const runner = await resolveGetWorkerRunner(chunks, { onMessage: workerMessageHandler, includeExtras: includeExtrasRequested });
  try { if (typeof window !== 'undefined') {window.__TextLength_currentRunner = runner;} } catch (e) {}

  runner.promise = runner.promise.catch(async (err) => {
    if (err && err.kind === 'creation-failure') {
      const warn = document.createElement('div');
      warn.textContent = 'Web Worker unavailable ¼ falling back to main-thread processing.';
      warn.setAttribute('role', 'status');
      warn.classList.add('worker-warning');
      if (resultsSection) {resultsSection.insertBefore(warn, resultsSection.firstChild);}
      if (srAnnouncer) {srAnnouncer.textContent = 'Worker unavailable; running analysis on the main thread.';}
      setTimeout(function () { try { if (warn && warn.parentNode) {warn.parentNode.removeChild(warn);} } catch (e) {} }, 4000);
      await processAsyncFromIndex(0);
      return { fallbackHandled: true };
    }
    throw err;
  });

  const timeoutPromise = new Promise((resolve) => {
    setTimeout(() => resolve({ timedOut: true, processedCount: words.length - (remainingChunks * CHUNK_SIZE) }), WORKER_TIMEOUT_MS);
  });

  return Promise.race([runner.promise, timeoutPromise])
    .then(async (result) => {
      if (result && result.fallbackHandled) {return;}

      if (result && result.timedOut) {
        runner.terminate();
        const alreadyProcessed = result.processedCount || 0;
        await processAsyncFromIndex(alreadyProcessed);
      } else {
        wordLengthsEl?.appendChild(frag);
      }
    })
    .catch(async (err) => {
      console.error('Worker failed or rejected:', err);
      const processedCount = (err && err.processedCount) ? err.processedCount : processedWords;
      await processAsyncFromIndex(processedCount);
    })
    .finally(() => {
      finalizeAndAnnounce(words.length, globalState.globalMin, globalState.globalMinWords, globalState.globalMax, globalState.globalMaxWords);
    });
    
}

// Helper UI implementations were moved to Text_LENGTH_helperUI.js

// Expose analyzeWordLengths to the global scope for older test harnesses
// that call it as a plain global function (the dashboard is authored as
// an ES module). This is a safe, idempotent attach.
try {
  if (typeof window !== 'undefined' && typeof analyzeWordLengths === 'function') {
    window.analyzeWordLengths = analyzeWordLengths;
  }
} catch (e) { /* ignore */ }
