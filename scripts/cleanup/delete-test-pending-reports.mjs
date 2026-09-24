// Cleanup A1 — delete pending test reports created by the k6/Playwright
// test accounts (Plans/cleanup/plan.md, user-approved 2026-09-24).
//
// Two-step by design: DRY RUN by default. It prints exactly what would be
// deleted. Execute only with DELETE=1.
//
//   node scripts/cleanup/delete-test-pending-reports.mjs            # dry run
//   DELETE=1 node scripts/cleanup/delete-test-pending-reports.mjs   # execute
//
// Scope (all conditions must hold):
//   Crime.status = 'pending'
//   AND the crime was submitted by a TEST account
//       (CrimeReportsSubmitter.email in TEST_EMAILS)
//       OR its title matches a known test title pattern.
// Approved/rejected crimes, reference data, and submitter accounts are
// NEVER touched. Credentials come from db-project-backend/.env (gitignored)
// and are never printed.

import { createRequire } from "module";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const require = createRequire(path.join(repoRoot, "db-project-backend/package.json"));
const { Client } = require("pg");

// Known test identities/titles from the load-testing phases (0, 15, 16).
const TEST_EMAILS = ["gayleen680@web-library.net"];
const TEST_TITLE_PATTERNS = ["load test%", "playwright%"];

const envText = readFileSync(path.join(repoRoot, "db-project-backend/.env"), "utf8");
const match = envText.match(/^DATABASE_URL=(.+)$/m);
if (!match) {
  console.error("DATABASE_URL not found in db-project-backend/.env");
  process.exit(1);
}
const connectionString = match[1].trim().replace(/^["']|["']$/g, "");

const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
await client.connect();

const q = (text, params) => client.query(text, params);

// --- 1. Inventory before ---
const before = await q(
  `SELECT status, COUNT(*)::int AS n FROM "Crime" GROUP BY status ORDER BY status`
);
console.log("== Crime counts by status (before) ==");
console.table(before.rows);

// --- 2. Resolve target set ---
const targets = await q(
  `
  SELECT DISTINCT c.id, c.title, c.status, c."reportedAt",
         COALESCE(s.email, '(no submission link)') AS submitter_email
  FROM "Crime" c
  LEFT JOIN "CrimeSubmission" cs ON cs."CrimeId" = c.id
  LEFT JOIN "CrimeReportsSubmitter" s ON s.id = cs."submitterId"
  WHERE c.status = 'pending'
    AND (
      s.email = ANY($1)
      ${TEST_TITLE_PATTERNS.map((_, i) => `OR c.title ILIKE $${i + 2}`).join(" ")}
    )
  ORDER BY c."reportedAt"
  `,
  [TEST_EMAILS, ...TEST_TITLE_PATTERNS]
);

console.log(`\n== Target pending test reports: ${targets.rowCount} ==`);
const bySubmitter = {};
for (const r of targets.rows) bySubmitter[r.submitter_email] = (bySubmitter[r.submitter_email] || 0) + 1;
console.log(bySubmitter);

const otherPending = await q(
  `
  SELECT COUNT(*)::int AS n
  FROM "Crime" c
  LEFT JOIN "CrimeSubmission" cs ON cs."CrimeId" = c.id
  LEFT JOIN "CrimeReportsSubmitter" s ON s.id = cs."submitterId"
  WHERE c.status = 'pending'
    AND NOT (s.email = ANY($1)
      ${TEST_TITLE_PATTERNS.map((_, i) => `OR c.title ILIKE $${i + 2}`).join(" ")})
  `,
  [TEST_EMAILS, ...TEST_TITLE_PATTERNS]
);
console.log(`\nPending reports NOT matched (left untouched): ${otherPending.rows[0].n}`);

if (!process.env.DELETE) {
  console.log("\nDRY RUN — nothing deleted. Re-run with DELETE=1 to execute.");
  await client.end();
  process.exit(0);
}

// --- 3. Delete inside a transaction: submission links first, then crimes ---
await q("BEGIN");
try {
  const delSubs = await q(
    `
    DELETE FROM "CrimeSubmission" cs
    USING "Crime" c
    WHERE cs."CrimeId" = c.id AND c.status = 'pending'
      AND (
        cs."submitterId" IN (SELECT id FROM "CrimeReportsSubmitter" WHERE email = ANY($1))
        ${TEST_TITLE_PATTERNS.map((_, i) => `OR c.title ILIKE $${i + 2}`).join(" ")}
      )
    `,
    [TEST_EMAILS, ...TEST_TITLE_PATTERNS]
  );
  const delCrimes = await q(
    `
    DELETE FROM "Crime" c
    WHERE c.status = 'pending'
      AND (
        c.id IN (
          SELECT cs."CrimeId" FROM "CrimeSubmission" cs
          JOIN "CrimeReportsSubmitter" s ON s.id = cs."submitterId"
          WHERE s.email = ANY($1)
        )
        ${TEST_TITLE_PATTERNS.map((_, i) => `OR c.title ILIKE $${i + 2}`).join(" ")}
      )
    `,
    [TEST_EMAILS, ...TEST_TITLE_PATTERNS]
  );
  console.log(`\nDeleted: ${delSubs.rowCount} submission links, ${delCrimes.rowCount} pending crimes`);
  await q("COMMIT");
} catch (err) {
  await q("ROLLBACK");
  console.error("FAILED — rolled back:", err.message);
  await client.end();
  process.exit(1);
}

// --- 4. Inventory after ---
const after = await q(
  `SELECT status, COUNT(*)::int AS n FROM "Crime" GROUP BY status ORDER BY status`
);
console.log("\n== Crime counts by status (after) ==");
console.table(after.rows);

await client.end();
