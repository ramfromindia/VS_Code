// Small helper to safely attach symbols to the global window namespace
// Usage: exposeToWindow('Text_LENGTH_namespace', 'key', value)
export function exposeToWindow(ns, key, value) {
    try {
        if (typeof window !== 'undefined') {
            window[ns] = window[ns] || {};
            window[ns][key] = value;
        }
    } catch (e) { /* ignore errors when attaching to window */ }
}
