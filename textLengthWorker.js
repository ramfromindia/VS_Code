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
  const isClassic = (typeof importScripts === 'function');
  if (!isClassic) {
    try {
      // dynamic import works in module workers; this lets the worker
      // optionally share code with other ES modules (e.g. tokenizers).
      // eslint-disable-next-line no-unused-vars
      const helpers = await import('./Text_LENGTH_tokenize.js').catch(() => null);
    } catch (e) {
      // Fallback to internal implementation
    }
  }

  // Helper function to track min/max words and lengths
  function updateMinMax(word, len, minTracker, maxTracker) {
    if (len > maxTracker.len) {
      maxTracker.len = len;
      maxTracker.words.length = 0;
      maxTracker.words.push(word);
    } else if (len === maxTracker.len) {
      maxTracker.words.push(word);
    }

    if (len < minTracker.len) {
      minTracker.len = len;
      minTracker.words.length = 0;
      minTracker.words.push(word);
    } else if (len === minTracker.len) {
      minTracker.words.push(word);
    }
  }

  // Helper function to populate extras maps
  function populateExtras(word, len, maps) {
    try {
      if (!maps.wordToLen.has(word)) {
        maps.wordToLen.set(word, len);
      }
      let s = maps.lenToWords.get(len);
      if (!s) {
        s = new Set();
        maps.lenToWords.set(len, s);
      }
      s.add(word);
      maps.freqMap.set(word, (maps.freqMap.get(word) || 0) + 1);
    } catch (e) {
      // ignore Map/Set errors in constrained environments
    }
  }

  // Internal processor — identical logic to previous worker: compute per-word
  // lengths (Unicode code point aware), chunk min/max and arrays of words.
  function processChunk(words, includeExtras) {
    const items = new Array(words.length);
    const minTracker = { len: Infinity, words: [] };
    const maxTracker = { len: 0, words: [] };

    // Only create Map/Set/frequency helpers when requested to reduce work
    const maps = includeExtras ? {
      wordToLen: new Map(),
      lenToWords: new Map(), // len -> Set(words)
      freqMap: new Map()
    } : null;

    for (let i = 0; i < words.length; i++) {
      const w = words[i];
      const len = Array.from(w).length; // Unicode code-point aware
      items[i] = { word: w, len };

      updateMinMax(w, len, minTracker, maxTracker);

      if (includeExtras) {
        populateExtras(w, len, maps);
      }
    }

    // Serialize extras to plain arrays for maximum compatibility across contexts
    // Only serialize extras when requested
    const result = {
      items,
      minLen: minTracker.len === Infinity ? 0 : minTracker.len,
      minWords: minTracker.words,
      maxLen: maxTracker.len,
      maxWords: maxTracker.words
    };

    if (includeExtras) {
      const minUniqueWords = Array.from(maps.lenToWords.get(minTracker.len) || []);
      const maxUniqueWords = Array.from(maps.lenToWords.get(maxTracker.len) || []);
      const lenToWordsEntries = Array.from(maps.lenToWords.entries()).map(([l, set]) => [l, Array.from(set)]);
      const freqEntries = Array.from(maps.freqMap.entries());
      result.minUniqueWords = minUniqueWords;
      result.maxUniqueWords = maxUniqueWords;
      result.lenToWordsEntries = lenToWordsEntries;
      result.freqEntries = freqEntries;
    }

    return result;
  }

  // Message handler — same shape as before
  self.onmessage = function (ev) {
    const msg = ev.data || {};
    try {
      if (msg.type === 'process' && Array.isArray(msg.words)) {
        // Respect the extras flag (only compute/send extras when requested)
        const includeExtras = !!msg.extras;
        const result = processChunk(msg.words, includeExtras);
        self.postMessage(Object.assign({ type: 'result' }, result));
      }
    } catch (err) {
      self.postMessage({ type: 'error', error: String(err) });
    }
  };

})();
