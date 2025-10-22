/*
 * Text_LENGTH_tokenize.js
 * Export a single function `tokenize(input) => string[]` which normalizes
 * typographic apostrophes and tokenizes text using a Unicode-aware pattern
 * with an ASCII fallback. Also attaches the function to
 * `window.Text_LENGTH_tokenize.tokenize` for backwards compatibility when
 * scripts are not loaded as modules.
 */

export function tokenize(input) {
    if (typeof input !== 'string') input = String(input ?? '');

    // Normalize typographic apostrophes to straight ASCII apostrophe
    input = input.replace(/[’‘]/g, "'");

    // Build a word pattern. Prefer Unicode property escapes if supported,
    // otherwise fall back to an ASCII-safe pattern.
    let wordPattern;
    try {
        new RegExp("\\p{L}", "u");
        wordPattern = /[\p{L}\p{N}]+(?:['-][\p{L}\p{N}]+)*/gu;
    } catch (e) {
        wordPattern = /[A-Za-z0-9]+(?:['-][A-Za-z0-9]+)*/g;
    }

    return input.match(wordPattern) ?? [];
}

// Attach to window for legacy (non-module) usage
try {
    if (typeof window !== 'undefined') {
        window.Text_LENGTH_tokenize = window.Text_LENGTH_tokenize || {};
        window.Text_LENGTH_tokenize.tokenize = tokenize;
    }
} catch (e) {
    // ignore (safe guard for non-browser environments)
}
