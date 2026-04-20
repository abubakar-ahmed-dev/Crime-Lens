// utils/fileParser.js
import { parse } from "fast-csv";

/**
 * Convert CSV header to canonical key
 */
function toCanonicalKey(h) {
  if (!h) return h;
  const s = h.replace(/^\uFEFF/, '').trim();
  const map = {
    'crimetypeid': 'crimeTypeId',
    'crimetype': 'crimeTypeId',
    'crime_type_id': 'crimeTypeId',
    'crime type id': 'crimeTypeId',
    'zoneid': 'zoneId',
    'zone_id': 'zoneId',
    'zone id': 'zoneId',
    'reportedat': 'reportedAt',
    'incidentdate': 'incidentDate',
  };
  const key = s.toLowerCase().replace(/[\s_-]+/g, '');
  return map[key] || s.replace(/\s+/g, '').replace(/_+/g, '');
}

/**
 * parseCSVBuffer
 * @param {Buffer} buffer - req.file.buffer from multer.memoryStorage
 * @param {Object} options
 *   options.requiredFields = [ 'title', 'crimeTypeId', 'incidentDate', 'reportedAt', 'latitude', 'longitude', 'zoneId' ]
 * @returns {Promise<{rows: Array, parseInvalids: Array, total: number}>}
 */
export function parseCSVBuffer(buffer, options = {}) {
  const requiredFields = options.requiredFields || [
    "title",
    "crimeTypeId",
    "incidentDate",
    "reportedAt",
    "latitude",
    "longitude",
  ];

  return new Promise((resolve, reject) => {
    const rows = [];
    const parseInvalids = [];
    let total = 0;

    const stream = parse({ headers: true, trim: true, ignoreEmpty: true })
      .on("error", (err) => reject(err))
      .on("headers", (headers) => {
        // build header map for canonicalization
        stream.headerMap = {};
        headers.forEach((h) => {
          const canonical = toCanonicalKey(h);
          stream.headerMap[h] = canonical;
        });
      })
      .on("data", (rawRow) => {
        total += 1;
        // normalize row keys using headerMap
        const row = {};
        for (const key of Object.keys(rawRow)) {
          const canonical = (stream.headerMap && stream.headerMap[key]) || key;
          row[canonical] = rawRow[key];
        }

        // required fields presence check
        const missing = requiredFields.filter((f) => {
          const v = (row[f] ?? "").toString().trim();
          return v === "";
        });

        if (missing.length) {
          parseInvalids.push({ row, reason: `Missing fields: ${missing.join(",")}` });
          return;
        }

        rows.push(row);
      })
      .on("end", () => resolve({ rows, parseInvalids, total }));

    stream.write(buffer);
    stream.end();
  });
}
