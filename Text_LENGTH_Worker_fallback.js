// Thin wrapper for backward compatibility. The canonical implementation
// lives in Text_LENGTH_workerRunner.js; this module simply re-exports
// the runner under the legacy name `runWorkerFallback` so dynamic imports
// or older callers keep working without code duplication.

export { runWorker as runWorkerFallback } from './Text_LENGTH_workerRunner.js';

// Note: window exposure is handled by Text_LENGTH_workerRunner.js so there's
// no need to duplicate it here.
