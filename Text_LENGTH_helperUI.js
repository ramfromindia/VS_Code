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
    const uniqueMax = [...new Set(maxWordsArr)];
    const uniqueMin = [...new Set(minWordsArr)];

    if (mostCommonWordsEl) {
        mostCommonWordsEl.textContent = uniqueMax.map(function (w) { return `${w} (${maxLen})`; }).join(', ') || 'N/A';
    }
    if (leastCommonWordsEl) {
        leastCommonWordsEl.textContent = uniqueMin.map(function (w) { return `${w} (${minLen})`; }).join(', ') || 'N/A';
    }

    if (srAnnouncer) {
        srAnnouncer.textContent = `Analysis complete. ${totalWords} ${totalWords === 1 ? 'word' : 'words'}. Longest: ${uniqueMax.join(', ')} (${maxLen}). Shortest: ${uniqueMin.join(', ')} (${minLen}).`;
    }

    if (resultsSection) resultsSection.setAttribute('aria-busy', 'false');
    if (analyzeBtnEl) {
        analyzeBtnEl.disabled = false;
        analyzeBtnEl.removeAttribute('aria-disabled');
    }
}

// Optional compatibility shims for non-module pages
try {
    if (typeof window !== 'undefined') {
        window.clearResults = clearResults;
        window.renderNoWordsFound = renderNoWordsFound;
        window.finalizeAndAnnounce = finalizeAndAnnounce;
    }
} catch (e) { /* ignore */ }
