// Aggregates k6 JSON output into per-scenario metrics for the spike test.
// Usage: node spike-phases.mjs <k6-json-file>
import fs from 'fs';
import readline from 'readline';

const file = process.argv[2];
if (!file) {
  console.error('Usage: node spike-phases.mjs <k6-json-file>');
  process.exit(1);
}

const rl = readline.createInterface({
  input: fs.createReadStream(file),
  crlfDelay: Infinity,
});

// scenario name -> array of durations; also track errors and timestamps
const byScenario = {};
let testStart = null;
let testEnd = null;

function pct(sortedArr, p) {
  if (!sortedArr.length) return null;
  const idx = Math.ceil((p / 100) * sortedArr.length) - 1;
  return sortedArr[Math.max(0, Math.min(idx, sortedArr.length - 1))];
}

rl.on('line', (line) => {
  let entry;
  try {
    entry = JSON.parse(line);
  } catch {
    return;
  }
  const d = entry.data || {};
  const tags = d.tags || {};

  if (entry.type === 'Point' && entry.metric === 'http_req_duration') {
    const scenario = tags.scenario || tags.executor || 'unknown';
    (byScenario[scenario] ||= { durations: [], failed: 0 }).durations.push(d.value);
    const ts = entry.data.time ? Date.parse(entry.data.time) : null;
    if (ts) {
      if (!testStart || ts < testStart) testStart = ts;
      if (!testEnd || ts > testEnd) testEnd = ts;
    }
  }
  if (entry.type === 'Point' && entry.metric === 'http_req_failed') {
    const scenario = tags.scenario || tags.executor || 'unknown';
    (byScenario[scenario] ||= { durations: [], failed: 0 });
    if (d.value === 1) byScenario[scenario].failed++;
  }
});

rl.on('close', () => {
  console.log(`Test wall-clock span: ${testStart && testEnd ? Math.round((testEnd - testStart) / 1000) + 's' : 'N/A'}\n`);
  console.log('scenario | requests | failures | p50 | p90 | p95 | p99 | max');
  console.log('---|---|---|---|---|---|---|---');
  for (const [name, s] of Object.entries(byScenario)) {
    s.durations.sort((a, b) => a - b);
    console.log(
      `${name} | ${s.durations.length} | ${s.failed} | ` +
      `${Math.round(pct(s.durations, 50))} | ${Math.round(pct(s.durations, 90))} | ` +
      `${Math.round(pct(s.durations, 95))} | ${Math.round(pct(s.durations, 99))} | ` +
      `${Math.round(Math.max(...s.durations))}`
    );
  }
});
