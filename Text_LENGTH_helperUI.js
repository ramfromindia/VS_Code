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
    if (!ta) return;
    const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    if (!isMobile) {
        try { ta.focus({ preventScroll: true }); } catch (e) { ta.focus(); }
    }
});

export function clearResults() {
    if (wordLengthsEl) {
        while (wordLengthsEl.firstChild) wordLengthsEl.removeChild(wordLengthsEl.firstChild);
    }
    if (mostCommonWordsEl) mostCommonWordsEl.textContent = '';
    if (leastCommonWordsEl) leastCommonWordsEl.textContent = '';
    if (srAnnouncer) srAnnouncer.textContent = '';
}

export function renderNoWordsFound() {
    if (wordLengthsEl) {
        const li = document.createElement('li');
        li.textContent = 'No words found.';
        wordLengthsEl.appendChild(li);
    }
    if (mostCommonWordsEl) mostCommonWordsEl.textContent = 'N/A';
    if (leastCommonWordsEl) leastCommonWordsEl.textContent = 'N/A';
    if (srAnnouncer) srAnnouncer.textContent = 'No words found.';
}

export function finalizeAndAnnounce(totalWords, minLen, minWordsArr, maxLen, maxWordsArr) {
    // Build clean, unique, sorted arrays for longest/shortest words.
    // Normalize by trimming and string-coercing entries, then dedupe.
    function _toStringTrimmed(v) { return (typeof v === 'string') ? v.trim() : String(v ?? ''); }
    function _uniqueSortedFromIterable(it) {
        const arr = Array.from(it || []);
        const cleaned = arr.map(_toStringTrimmed).filter(Boolean);
        return Array.from(new Set(cleaned)).sort((a, b) => a.localeCompare(b));
    }

    // Prefer reading unique lists from global state if available; otherwise use
    // the arrays passed in. This avoids repeated typeof/window checks.
    let uniqueMax, uniqueMin;
    const gs = (typeof window !== 'undefined' && window.__TextLength_globalState) ? window.__TextLength_globalState : null;
    if (gs && gs.lenToWords instanceof Map) {
        uniqueMax = _uniqueSortedFromIterable(gs.lenToWords.get(maxLen));
        uniqueMin = _uniqueSortedFromIterable(gs.lenToWords.get(minLen));
    } else {
        uniqueMax = _uniqueSortedFromIterable(maxWordsArr);
        uniqueMin = _uniqueSortedFromIterable(minWordsArr);
    }

    // Prepare default display strings; we'll override them below if frequency
    // data is available. Assign to DOM only once to avoid redundant writes.
    let displayMost = uniqueMax.map(function (w) { return `${w} (${maxLen})`; }).join(', ') || 'N/A';
    let displayLeast = uniqueMin.map(function (w) { return `${w} (${minLen})`; }).join(', ') || 'N/A';
    let srText = `Analysis complete. ${totalWords} ${totalWords === 1 ? 'word' : 'words'}. Longest: ${uniqueMax.join(', ')} (${maxLen}). Shortest: ${uniqueMin.join(', ')} (${minLen}).`;

    // If frequency data exists in global state, prefer to include counts and
    // populate the unique lists with words that occur exactly once.
    try {
        const freqMap = gs && gs.freqMap;
        if (freqMap && typeof freqMap.get === 'function') {
            const filterUniqueByCount = (arr) => Array.isArray(arr) ? arr.filter(function (w) { try { return freqMap.get(w) === 1; } catch (e) { return false; } }) : [];

            const filteredMax = filterUniqueByCount(uniqueMax);
            const filteredMin = filterUniqueByCount(uniqueMin);

            // Show counts alongside words when possible
            const summaryMax = uniqueMax;
            const summaryMin = uniqueMin;

            displayMost = summaryMax.length ? summaryMax.map(function (w) { return (typeof freqMap.has === 'function' && freqMap.has(w)) ? `${w} (${maxLen}) — ${freqMap.get(w)}` : `${w} (${maxLen})`; }).join(', ') : 'N/A';
            displayLeast = summaryMin.length ? summaryMin.map(function (w) { return (typeof freqMap.has === 'function' && freqMap.has(w)) ? `${w} (${minLen}) — ${freqMap.get(w)}` : `${w} (${minLen})`; }).join(', ') : 'N/A';

            if (uniqueMaxListEl) uniqueMaxListEl.textContent = (filteredMax.length ? filteredMax.join(', ') : 'N/A');
            if (uniqueMinListEl) uniqueMinListEl.textContent = (filteredMin.length ? filteredMin.join(', ') : 'N/A');

            // SR announcer with counts where available
            const maxAnn = summaryMax.map(function (w) { return (typeof freqMap.has === 'function' && freqMap.has(w)) ? `${w} (${freqMap.get(w)})` : w; }).join(', ') || 'N/A';
            const minAnn = summaryMin.map(function (w) { return (typeof freqMap.has === 'function' && freqMap.has(w)) ? `${w} (${freqMap.get(w)})` : w; }).join(', ') || 'N/A';
            srText = `Analysis complete. ${totalWords} ${totalWords === 1 ? 'word' : 'words'}. Longest: ${maxAnn} (${maxLen}). Shortest: ${minAnn} (${minLen}).`;

            // Top frequencies (if freqMap entries available)
            if (topFrequenciesEl && typeof freqMap.entries === 'function') {
                try {
                    const arr = Array.from(freqMap.entries()).sort((a, b) => b[1] - a[1]);
                    const top = arr.slice(0, 10).map(([w, c]) => `${w}: ${c}`);
                    topFrequenciesEl.textContent = top.length ? top.join(', ') : 'N/A';
                } catch (e) { /* ignore frequency rendering errors */ }
            }
        } else {
            // No freqMap: ensure unique lists still show cleaned values
            if (uniqueMaxListEl) uniqueMaxListEl.textContent = (uniqueMax.length ? uniqueMax.join(', ') : 'N/A');
            if (uniqueMinListEl) uniqueMinListEl.textContent = (uniqueMin.length ? uniqueMin.join(', ') : 'N/A');
        }
    } catch (e) { /* ignore extras rendering errors */ }

    if (mostCommonWordsEl) mostCommonWordsEl.textContent = displayMost;
    if (leastCommonWordsEl) leastCommonWordsEl.textContent = displayLeast;
    if (srAnnouncer) srAnnouncer.textContent = srText;

    if (resultsSection) resultsSection.setAttribute('aria-busy', 'false');
    if (analyzeBtnEl) {
        analyzeBtnEl.disabled = false;
        analyzeBtnEl.removeAttribute('aria-disabled');
    }

    // Hide progress UI when the run completes (if available)
    try { if (typeof hideProgress === 'function') hideProgress(); } catch (e) {}
}

// --------- lightweight JS-driven progress animation API ---------
// The progress UI is intentionally driven by JS (requestAnimationFrame)
// so the animation can be subtle and non-blocking. The fill will
// advance progressively toward a capped value while processing is
// ongoing and will animate to 100% on completion.

let _progressState = {
    active: false,
    rafId: null,
    current: 0,
    targetCap: 85, // max percent while processing (until finalization)
};

function _setFill(percent) {
    const fill = document.getElementById('progress-bar-fill');
    const container = document.getElementById('progress-bar');
    if (!fill || !container) return;
    fill.style.width = Math.max(0, Math.min(100, percent)) + '%';
    fill.setAttribute('aria-valuenow', Math.round(percent));
}

function _animateToTarget() {
    const container = document.getElementById('progress-bar');
    if (!container) return;
    const fill = document.getElementById('progress-bar-fill');
    if (!_progressState.active) return;

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
        if (!container) return;
        container.style.display = 'block';
        container.setAttribute('aria-hidden', 'false');
        _progressState.active = true;
        _progressState.current = 2; // start visible but small
        _setFill(_progressState.current);
        if (_progressState.rafId) cancelAnimationFrame(_progressState.rafId);
        _progressState.rafId = requestAnimationFrame(_animateToTarget);
    } catch (e) { /* ignore */ }
}

export function hideProgress() {
    try {
        const container = document.getElementById('progress-bar');
        const fill = document.getElementById('progress-bar-fill');
        if (!container || !fill) return;
        // Stop the ongoing animation
        _progressState.active = false;
        if (_progressState.rafId) { cancelAnimationFrame(_progressState.rafId); _progressState.rafId = null; }

        // Animate quickly to 100% then fade out the bar
        let start = null;
        const startVal = _progressState.current || 0;
        const duration = 220; // ms
        function finishAnim(ts) {
            if (!start) start = ts;
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
        window.showProgress = showProgress;
        window.hideProgress = hideProgress;

        // UI helpers
        window.clearResults = clearResults;
        window.renderNoWordsFound = renderNoWordsFound;
        window.finalizeAndAnnounce = finalizeAndAnnounce;
    }
} catch (e) { /* ignore */ }
