// Aggregates k6 JSON output into per-endpoint metrics.
// Usage: node aggregate-results.js <k6-json-file>
import fs from 'fs';
import readline from 'readline';

const file = process.argv[2];
if (!file) {
  console.error('Usage: node aggregate-results.js <k6-json-file>');
  process.exit(1);
}

const rl = readline.createInterface({
  input: fs.createReadStream(file),
  crlfDelay: Infinity,
});

// name -> array of durations
const byEndpointDuration = {};
const statusByEndpoint = {};

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
    // Group by path only — strip query strings and BASE_URL prefix
    const raw = tags.name || tags.url || 'unknown';
    const name = raw.replace(/^https?:\/\/[^/]+/, '').replace(/\?.*$/, '') || '/';
    (byEndpointDuration[name] ||= []).push(d.value);
  }
  if (entry.type === 'Point' && entry.metric === 'http_req_failed' && tags.name) {
    const raw = tags.name;
    const name = raw.replace(/^https?:\/\/[^/]+/, '').replace(/\?.*$/, '') || '/';
    (statusByEndpoint[name] ||= { fails: 0, total: 0 });
    statusByEndpoint[name].total++;
    if (d.value === 1) statusByEndpoint[name].fails++;
  }
});

rl.on('close', () => {
  const rows = Object.entries(byEndpointDuration).map(([name, vals]) => {
    vals.sort((a, b) => a - b);
    const st = statusByEndpoint[name] || { fails: 0, total: vals.length };
    return {
      endpoint: name,
      count: vals.length,
      p50: Math.round(pct(vals, 50)),
      p95: Math.round(pct(vals, 95)),
      p99: Math.round(pct(vals, 99)),
      max: Math.round(Math.max(...vals)),
      errRatePct: st.total ? ((st.fails / st.total) * 100).toFixed(2) : '0.00',
    };
  });

  rows.sort((a, b) => b.p95 - a.p95);
  console.log('endpoint | count | p50 | p95 | p99 | max | err%');
  console.log('---|---|---|---|---|---|---');
  for (const r of rows) {
    console.log(`${r.endpoint} | ${r.count} | ${r.p50} | ${r.p95} | ${r.p99} | ${r.max} | ${r.errRatePct}`);
  }
});
