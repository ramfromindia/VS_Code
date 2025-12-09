/* Text_LENGTH_helperUI.js
   Helper UI functions extracted from Text_LENGTH_Dashboard.js
   - clearResults
   - renderNoWordsFound
   - finalizeAndAnnounce
   - initial focus management on DOMContentLoaded

   This file is intentionally a plain browser script (non-module) so the
   functions below are available globally for the main dashboard script.
*/

// Helper UI functions exported as an ES module. Also provide compatibility
// shims that attach the same functions to window for legacy scripts.

const getEl = (id) => document.getElementById(id);

const analyzeBtnEl = getEl('analyzeBtn');
const wordLengthsEl = getEl('wordLengths');
const mostCommonWordsEl = getEl('mostCommonWords');
const leastCommonWordsEl = getEl('leastCommonWords');
const resultsSection = getEl('results');
const srAnnouncer = getEl('sr-announcer');
const uniqueMaxListEl = getEl('uniqueMaxList');
const uniqueMinListEl = getEl('uniqueMinList');
const topFrequenciesEl = getEl('topFrequencies');

// Autofocus management: focus the textarea on load but avoid forcing
// the on-screen keyboard on mobile devices.
document.addEventListener('DOMContentLoaded', () => {
  const ta = getEl('inputText');
  if (!ta) {return;}
  const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  if (!isMobile) {
    try { ta.focus({ preventScroll: true }); } catch (e) { ta.focus(); }
  }
});

export function clearResults() {
  if (wordLengthsEl) {
    while (wordLengthsEl.firstChild) {wordLengthsEl.removeChild(wordLengthsEl.firstChild);}
  }
  if (mostCommonWordsEl) {mostCommonWordsEl.textContent = '';}
  if (leastCommonWordsEl) {leastCommonWordsEl.textContent = '';}
  if (srAnnouncer) {srAnnouncer.textContent = '';}
}

export function renderNoWordsFound() {
  if (wordLengthsEl) {
    const li = document.createElement('li');
    li.textContent = 'No words found.';
    wordLengthsEl.appendChild(li);
  }
  if (mostCommonWordsEl) {mostCommonWordsEl.textContent = 'N/A';}
  if (leastCommonWordsEl) {leastCommonWordsEl.textContent = 'N/A';}
  if (srAnnouncer) {srAnnouncer.textContent = 'No words found.';}
}

// Helper: normalize a value to a trimmed string
function _toStringTrimmed(v) { return (typeof v === 'string') ? v.trim() : String(v ?? ''); }

// Helper: produce a unique sorted array from an iterable
function _uniqueSortedFromIterable(it) {
  const arr = Array.from(it || []);
  const cleaned = arr.map(_toStringTrimmed).filter(Boolean);
  return Array.from(new Set(cleaned)).sort((a, b) => a.localeCompare(b));
}

// Helper: build default display strings and SR text
function _buildDefaultDisplays(uniqueMax, uniqueMin, maxLen, minLen, totalWords) {
  const displayMost = uniqueMax.map(function (w) { return `${w} (${maxLen})`; }).join(', ') || 'N/A';
  const displayLeast = uniqueMin.map(function (w) { return `${w} (${minLen})`; }).join(', ') || 'N/A';
  const srText = `Analysis complete. ${totalWords} ${totalWords === 1 ? 'word' : 'words'}. Longest: ${uniqueMax.join(', ')} (${maxLen}). Shortest: ${uniqueMin.join(', ')} (${minLen}).`;
  return { displayMost, displayLeast, srText };
}

// Helper: search outward from startLen to find nearest unique words with count===1
function _findNearestUnique(opts) {
  const { lenToWordsMap, freqMapLocal, startLen, lowBound, highBound, step } = opts || {};
  if (!lenToWordsMap || typeof lenToWordsMap.get !== 'function') { return { len: startLen, words: [] }; }
  for (let l = startLen; (step < 0 ? l >= lowBound : l <= highBound); l += step) {
    try {
      const s = lenToWordsMap.get(l);
      if (!s) { continue; }
      const arr = Array.from(s).map(_toStringTrimmed).filter(Boolean);
      const uniques = arr.filter(function (w) { try { return freqMapLocal.get(w) === 1; } catch (e) { return false; } });
      if (uniques.length) { return { len: l, words: uniques }; }
    } catch (e) { /* ignore per-bucket errors and continue searching */ }
  }
  return { len: startLen, words: [] };
}

// Render the top frequencies into the UI
function _renderTopFrequencies(freqMap) {
  if (!topFrequenciesEl || typeof freqMap.entries !== 'function') { return; }
  try {
    const arr = Array.from(freqMap.entries()).sort((a, b) => b[1] - a[1]);
    const top = arr.slice(0, 10).map(([w, c]) => `${w}: ${c}`);
    topFrequenciesEl.textContent = top.length ? top.join(', ') : 'N/A';
  } catch (e) { /* ignore frequency rendering errors */ }
}

// Compute display strings and render per-frequency UI parts. Returns the
// displayMost/displayLeast/srText values for consumption by the caller.
function _computeAndRenderDisplays({ gs, uniqueMax, uniqueMin, maxLen, minLen, totalWords }) {
  try {
    const freqMap = gs && gs.freqMap;
    if (freqMap && typeof freqMap.get === 'function') {
      return _renderWithFreqMap({ gs, uniqueMax, uniqueMin, maxLen, minLen, totalWords, freqMap });
    }

    if (uniqueMaxListEl) { uniqueMaxListEl.textContent = (uniqueMax.length ? uniqueMax.join(', ') : 'N/A'); }
    if (uniqueMinListEl) { uniqueMinListEl.textContent = (uniqueMin.length ? uniqueMin.join(', ') : 'N/A'); }
    return _buildDefaultDisplays(uniqueMax, uniqueMin, maxLen, minLen, totalWords);
  } catch (e) {
    return _buildDefaultDisplays(uniqueMax, uniqueMin, maxLen, minLen, totalWords);
  }
}

// Small helpers used by frequency-aware rendering
function _filterUniqueByCount(arr, freqMap) {
  return Array.isArray(arr) ? arr.filter(w => { try { return freqMap.get(w) === 1; } catch (e) { return false; } }) : [];
}

function _formatWithCounts(arr, len, freqMap) {
  return arr.length ? arr.map(w => (typeof freqMap.has === 'function' && freqMap.has(w)) ? `${w} (${len}) — ${freqMap.get(w)}` : `${w} (${len})`).join(', ') : 'N/A';
}

function _buildAnnList(arr, freqMap) {
  return arr.map(w => (typeof freqMap.has === 'function' && freqMap.has(w)) ? `${w} (${freqMap.get(w)})` : w).join(', ') || 'N/A';
}

// Frequency-aware rendering split out to reduce complexity of callers
function _renderWithFreqMap({ gs, uniqueMax, uniqueMin, maxLen, minLen, totalWords, freqMap }) {
  const filteredMax = _filterUniqueByCount(uniqueMax, freqMap);
  const filteredMin = _filterUniqueByCount(uniqueMin, freqMap);

  const displayMost = _formatWithCounts(uniqueMax, maxLen, freqMap);
  const displayLeast = _formatWithCounts(uniqueMin, minLen, freqMap);
  _setNearestUniqueListMax({ gs, freqMap, maxLen, minLen, filteredMax });
  _setNearestUniqueListMin({ gs, freqMap, maxLen, minLen, filteredMin });

  const maxAnn = _buildAnnList(uniqueMax, freqMap);
  const minAnn = _buildAnnList(uniqueMin, freqMap);
  const srText = `Analysis complete. ${totalWords} ${totalWords === 1 ? 'word' : 'words'}. Longest: ${maxAnn} (${maxLen}). Shortest: ${minAnn} (${minLen}).`;

  _renderTopFrequencies(freqMap);
  return { displayMost, displayLeast, srText };
}

function _setNearestUniqueListMax({ gs, freqMap, maxLen, minLen, filteredMax }) {
  const nearestMax = _findNearestUnique({ lenToWordsMap: gs && gs.lenToWords, freqMapLocal: freqMap, startLen: maxLen, lowBound: (typeof gs?.globalMin === 'number' ? gs.globalMin : minLen), highBound: (typeof gs?.globalMax === 'number' ? gs.globalMax : maxLen), step: -1 });
  if (uniqueMaxListEl) { uniqueMaxListEl.textContent = (nearestMax.words.length ? nearestMax.words.join(', ') : (Array.isArray(filteredMax) && filteredMax.length ? filteredMax.join(', ') : 'N/A')); }
}

function _setNearestUniqueListMin({ gs, freqMap, maxLen, minLen, filteredMin }) {
  const nearestMin = _findNearestUnique({ lenToWordsMap: gs && gs.lenToWords, freqMapLocal: freqMap, startLen: minLen, lowBound: (typeof gs?.globalMin === 'number' ? gs.globalMin : minLen), highBound: (typeof gs?.globalMax === 'number' ? gs.globalMax : maxLen), step: 1 });
  if (uniqueMinListEl) { uniqueMinListEl.textContent = (nearestMin.words.length ? nearestMin.words.join(', ') : (Array.isArray(filteredMin) && filteredMin.length ? filteredMin.join(', ') : 'N/A')); }
}

function _finalizeAndAnnounceImpl({ totalWords, minLen, minWordsArr, maxLen, maxWordsArr }) {
  const gs = (typeof window !== 'undefined' && window.__TextLength_globalState) ? window.__TextLength_globalState : null;

  const uniqueMax = (function () {
    try { return (gs && gs.lenToWords instanceof Map) ? _uniqueSortedFromIterable(gs.lenToWords.get(maxLen)) : _uniqueSortedFromIterable(maxWordsArr); } catch (e) { return _uniqueSortedFromIterable(maxWordsArr); }
  }());

  const uniqueMin = (function () {
    try { return (gs && gs.lenToWords instanceof Map) ? _uniqueSortedFromIterable(gs.lenToWords.get(minLen)) : _uniqueSortedFromIterable(minWordsArr); } catch (e) { return _uniqueSortedFromIterable(minWordsArr); }
  }());

  const defaults = _buildDefaultDisplays(uniqueMax, uniqueMin, maxLen, minLen, totalWords);
  let displayMost = defaults.displayMost;
  let displayLeast = defaults.displayLeast;
  let srText = defaults.srText;

  try {
    const computed = _computeAndRenderDisplays({ gs, uniqueMax, uniqueMin, maxLen, minLen, totalWords });
    if (computed) {
      displayMost = computed.displayMost;
      displayLeast = computed.displayLeast;
      srText = computed.srText;
    }
  } catch (e) { /* ignore extras rendering errors */ }

  if (mostCommonWordsEl) { mostCommonWordsEl.textContent = displayMost; }
  if (leastCommonWordsEl) { leastCommonWordsEl.textContent = displayLeast; }
  if (srAnnouncer) { srAnnouncer.textContent = srText; }

  if (resultsSection) { resultsSection.setAttribute('aria-busy', 'false'); }
  if (analyzeBtnEl) { analyzeBtnEl.disabled = false; analyzeBtnEl.removeAttribute('aria-disabled'); }

  try { if (typeof hideProgress === 'function') { hideProgress(); } } catch (e) {}
}

export function finalizeAndAnnounce(totalWords, minLen, minWordsArr, maxLen, maxWordsArr) {
  try { _finalizeAndAnnounceImpl({ totalWords, minLen, minWordsArr, maxLen, maxWordsArr }); } catch (e) { /* ignore */ }
}

// --------- lightweight JS-driven progress animation API ---------
// The progress UI is intentionally driven by JS (requestAnimationFrame)
// so the animation can be subtle and non-blocking. The fill will
// advance progressively toward a capped value while processing is
// ongoing and will animate to 100% on completion.

const _progressState = {
  active: false,
  rafId: null,
  current: 0,
  targetCap: 85 // max percent while processing (until finalization)
};

function _setFill(percent) {
  const fill = document.getElementById('progress-bar-fill');
  const container = document.getElementById('progress-bar');
  if (!fill || !container) {return;}
  fill.style.width = `${Math.max(0, Math.min(100, percent))}%`;
  fill.setAttribute('aria-valuenow', Math.round(percent));
}

function _animateToTarget() {
  const container = document.getElementById('progress-bar');
  if (!container) {return;}
  if (!_progressState.active) {return;}

  // Gradually nudge current toward targetCap using eased step
  const step = (target, current) => current + (target - current) * 0.08 + 0.1;
  const next = step(_progressState.targetCap, _progressState.current);
  _progressState.current = Math.min(_progressState.targetCap, next);
  _setFill(_progressState.current);

  _progressState.rafId = requestAnimationFrame(_animateToTarget);
}

export function showProgress() {
  try {
    const container = document.getElementById('progress-bar');
    if (!container) {return;}
    container.style.display = 'block';
    container.setAttribute('aria-hidden', 'false');
    _progressState.active = true;
    _progressState.current = 2; // start visible but small
    _setFill(_progressState.current);
    if (_progressState.rafId) {cancelAnimationFrame(_progressState.rafId);}
    _progressState.rafId = requestAnimationFrame(_animateToTarget);
  } catch (e) { /* ignore */ }
}

export function hideProgress() {
  try {
    const container = document.getElementById('progress-bar');
    const fill = document.getElementById('progress-bar-fill');
    if (!container || !fill) {return;}
    // Stop the ongoing animation
    _progressState.active = false;
    if (_progressState.rafId) { cancelAnimationFrame(_progressState.rafId); _progressState.rafId = null; }

    // Animate quickly to 100% then fade out the bar
    let start = null;
    const startVal = _progressState.current || 0;
    const duration = 220; // ms
    function finishAnim(ts) {
      if (!start) {start = ts;}
      const elapsed = ts - start;
      const p = Math.min(1, elapsed / duration);
      const v = startVal + (100 - startVal) * p;
      _setFill(v);
      if (p < 1) {
        requestAnimationFrame(finishAnim);
        return;
      }
      // after a short delay hide the bar and reset
      setTimeout(function () {
        try { container.style.display = 'none'; } catch (e) {}
        try { _setFill(0); _progressState.current = 0; } catch (e) {}
        container.setAttribute('aria-hidden', 'true');
      }, 160);
    }
    requestAnimationFrame(finishAnim);
  } catch (e) { /* ignore */ }
}

// Optional compatibility shims for non-module pages — attach all helpers
try {
  if (typeof window !== 'undefined') {
    // progress API
    window.onprogress = showProgress;
    window.hideProgress = hideProgress;

    // UI helpers
    window.clearResults = clearResults;
    window.renderNoWordsFound = renderNoWordsFound;
    window.finalizeAndAnnounce = finalizeAndAnnounce;
  }
} catch (e) { /* ignore */ }
