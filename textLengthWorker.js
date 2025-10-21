// Worker: receives messages of the form { type: 'process', words: [...] }
// For each chunk it computes: per-word lengths (counting Unicode code points),
// chunk min/max lengths and arrays of words achieving them. Then posts back a
// message { type: 'result', items: [{word,len},...], minLen, minWords, maxLen, maxWords }

self.onmessage = function (ev) {
    const msg = ev.data || {};
    try {
        if (msg.type === 'process' && Array.isArray(msg.words)) {
            const words = msg.words;
            const items = new Array(words.length);
            let minLen = Infinity, maxLen = 0;
            const minWords = [];
            const maxWords = [];

            for (let i = 0; i < words.length; i++) {
                const w = words[i];
                const len = Array.from(w).length;
                items[i] = { word: w, len };

                if (len > maxLen) {
                    maxLen = len;
                    maxWords.length = 0; maxWords.push(w);
                } else if (len === maxLen) {
                    maxWords.push(w);
                }

                if (len < minLen) {
                    minLen = len;
                    minWords.length = 0; minWords.push(w);
                } else if (len === minLen) {
                    minWords.push(w);
                }
            }

            self.postMessage({ type: 'result', items: items, minLen: minLen === Infinity ? 0 : minLen, minWords: minWords, maxLen, maxWords });
        }
    } catch (err) {
        self.postMessage({ type: 'error', error: String(err) });
    }
};
