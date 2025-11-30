// Small helper to safely attach symbols to the global window namespace
// Usage: exposeToWindow('Text_LENGTH_namespace', 'key', value')
function exposeToWindow(ns, key, value) {
  try {
    if (typeof window !== 'undefined') {
      window[ns] = window[ns] || {};
      window[ns][key] = value;
    }
  } catch (e) { /* ignore errors when attaching to window */ }
}

// Make available as a global function for non-module script loading.
try { if (typeof window !== 'undefined') {window.exposeToWindow = exposeToWindow;} } catch (e) {}

// Also keep a namespaced copy to avoid collisions in some environments.
try { if (typeof window !== 'undefined') {window.Text_LENGTH_expose = window.Text_LENGTH_expose || {};} window.Text_LENGTH_expose.exposeToWindow = exposeToWindow; } catch (e) {}
