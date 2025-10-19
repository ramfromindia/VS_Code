const analyzeBtn = document.getElementById('analyzeBtn');
const form = document.getElementById('analyzeForm');
const wordLengthsEl = document.getElementById('wordLengths'); // now a <ul>
const mostCommonWordsEl = document.getElementById('mostCommonWords'); // role=status
const leastCommonWordsEl = document.getElementById('leastCommonWords'); // role=status

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

// Wire events: use the form's submit event as the single source of truth.
// The button in the form is a submit button, so pressing Enter in the textarea
// or clicking the button both trigger this handler. This avoids double
// invocation that can happen when both the button click and form submit
// separately call the same function.
if (form) form.addEventListener('submit', function (e) { e.preventDefault(); analyzeWordLengths(); });


function analyzeWordLengths() {
    let input = document.getElementById('inputText').value || '';

    // Normalize typographic apostrophes to straight ASCII apostrophe
    input = input.replace(/[’‘]/g, "'");

    // Build a word pattern. Prefer Unicode property escapes if supported,
    // otherwise fall back to an ASCII-safe pattern to avoid runtime SyntaxError
    // on older browsers (older Edge/IE). The fallback supports letters/digits
    // in the ASCII range and still preserves internal hyphens/apostrophes.
    let wordPattern;
    try {
    // Test whether the environment supports \p{L} in RegExp (Unicode property escapes).
    // Construct the regex using the string form so the parser doesn't see an unsupported
    // \p escape at parse-time. Using a literal like /\p{L}/u would cause a SyntaxError
    // on older engines that don't support Unicode property escapes, so we build it at
    // runtime: if this throws, the engine lacks \p support and we fall back to ASCII.
    new RegExp("\\p{L}", "u");
        wordPattern = /[\p{L}\p{N}]+(?:['-][\p{L}\p{N}]+)*/gu;
    } catch (e) {
        // Fallback for environments without Unicode property escape support.
        // Note: fallback won't match non-Latin scripts correctly, but avoids
        // a hard crash and keeps functionality for ASCII, apostrophes, and hyphens.
        wordPattern = /[A-Za-z0-9]+(?:['-][A-Za-z0-9]+)*/g;
    }
    const words = input.match(wordPattern) || [];
    // Clear previous results
    clearResults();

    if (!words.length) {
        renderNoWordsFound();
        return;
    }

    let minLen = Infinity, maxLen = 0;
    let minWords = [], maxWords = [];
    let wordLengthsStr = '';
	const wordsLength = words.length;

    for (let i = 0; i < wordsLength; i++) {
        const word = words[i];
        // Count Unicode code points so characters like emoji are counted as one
        const len = Array.from(word).length;

        // Build list item for the <ul>
        const li = document.createElement('li');
        li.textContent = `${word} (${len})`;
        wordLengthsEl.appendChild(li);

        if (len > maxLen) {
            maxLen = len;
            maxWords = [word];
        } else if (len === maxLen) {
            maxWords.push(word);
        }
        if (len < minLen) {
            minLen = len;
            minWords = [word];
        } else if (len === minLen) {
            minWords.push(word);
        }
    }

    // Deduplicate words while preserving first-seen order
    const uniqueMax = [...new Set(maxWords)];
    const uniqueMin = [...new Set(minWords)];

    // Update status regions (role=status + aria-live will announce changes)
    mostCommonWordsEl.textContent = uniqueMax.map(function (w) { return `${w} (${maxLen})`; }).join(', ');
    leastCommonWordsEl.textContent = uniqueMin.map(function (w) { return `${w} (${minLen})`; }).join(', ');
}

function clearResults() {
    // Clear list items and status text safely
    if (wordLengthsEl) {
        while (wordLengthsEl.firstChild) wordLengthsEl.removeChild(wordLengthsEl.firstChild);
    }
    if (mostCommonWordsEl) mostCommonWordsEl.textContent = '';
    if (leastCommonWordsEl) leastCommonWordsEl.textContent = '';
}

function renderNoWordsFound() {
    if (wordLengthsEl) {
        const li = document.createElement('li');
        li.textContent = 'No words found.';
        wordLengthsEl.appendChild(li);
    }
    if (mostCommonWordsEl) mostCommonWordsEl.textContent = 'N/A';
    if (leastCommonWordsEl) leastCommonWordsEl.textContent = 'N/A';
}
