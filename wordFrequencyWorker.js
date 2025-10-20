
// Listen for messages from the main thread
self.onmessage = function(e) {
  // Receive the sanitized array of words from the main script
  const words = e.data;

  // Create a Map to store word frequencies
  const freqMap = new Map();

  // Count occurrences of each word
  for (const word of words) {
    freqMap.set(word, (freqMap.get(word) ?? 0) + 1);
  }

  // Convert map to array and sort by frequency descending
  const sortedArr = Array.from(freqMap.entries()).sort((a, b) => b[1] - a[1]);

  // Send the sorted array of [word, count] pairs back to the main thread
  self.postMessage(sortedArr);
};
