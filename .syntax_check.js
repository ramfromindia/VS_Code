const fs = require('fs');
const path = require('path');
const files = [
  'Text_LENGTH_Dashboard.js',
  'Text_Analytics_Dashboard.js',
  'wordFrequencyWorker.js'
];
let ok = true;
for (const f of files) {
  const p = path.join(__dirname, f);
  try {
    const src = fs.readFileSync(p, 'utf8');
    new Function(src); // parse-only
    console.log(p + ': OK');
  } catch (e) {
    ok = false;
    console.error(p + ': PARSE ERROR');
    console.error(e && e.stack ? e.stack : e.toString());
  }
}
process.exit(ok ? 0 : 1);
