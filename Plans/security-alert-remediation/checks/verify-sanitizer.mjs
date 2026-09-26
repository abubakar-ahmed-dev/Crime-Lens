/**
 * Sanitizer remediation check (security-alert-remediation plan, item A3).
 *
 * Compares the OLD regex implementation against the NEW linear scanner:
 *   1. benign inputs -> byte-identical output
 *   2. adversarial inputs -> new implementation bounded, fast
 *   3. known-miss (`</script >`) -> new implementation strips it
 *
 * Run: node Plans/security-alert-remediation/checks/verify-sanitizer.mjs
 */

const OLD_PATTERNS = [
  /<script[^>]*>[\s\S]*?<\/script>/gi,
  /javascript:/gi,
  /on\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi,
];
const oldSanitize = (value) => {
  let out = value;
  for (const pattern of OLD_PATTERNS) {
    if (pattern.test(out)) out = out.replace(pattern, "");
  }
  return out;
};

const SCRIPT_OPEN = "<script";
const SCRIPT_CLOSE = "</script";
const isWordChar = (c) =>
  (c >= "a" && c <= "z") || (c >= "A" && c <= "Z") || (c >= "0" && c <= "9") || c === "_";
const isWhitespace = (c) => c === " " || c === "\t" || c === "\n" || c === "\r";

const stripScriptBlocks = (input) => {
  const lower = input.toLowerCase();
  let out = "";
  let cursor = 0;
  for (;;) {
    const open = lower.indexOf(SCRIPT_OPEN, cursor);
    if (open === -1) {
      out += input.slice(cursor);
      return out;
    }
    const close = lower.indexOf(SCRIPT_CLOSE, open + SCRIPT_OPEN.length);
    if (close === -1) {
      out += input.slice(cursor);
      return out;
    }
    const closeEnd = lower.indexOf(">", close);
    if (closeEnd === -1) {
      out += input.slice(cursor);
      return out;
    }
    out += input.slice(cursor, open);
    cursor = closeEnd + 1;
  }
};

const stripInlineEventHandlers = (input) => {
  let out = "";
  let i = 0;
  const n = input.length;
  while (i < n) {
    let matched = false;
    if ((input[i] === "o" || input[i] === "O") && (input[i + 1] === "n" || input[i + 1] === "N")) {
      let j = i + 2;
      while (j < n && isWordChar(input[j])) j += 1;
      let k = j;
      while (k < n && isWhitespace(input[k])) k += 1;
      if (j > i + 2 && k < n && input[k] === "=") {
        k += 1;
        while (k < n && isWhitespace(input[k])) k += 1;
        if (k < n && (input[k] === '"' || input[k] === "'")) {
          const quote = input[k];
          k += 1;
          while (k < n && input[k] !== quote) k += 1;
          if (k < n) k += 1;
          i = k;
          matched = true;
        } else {
          const valueStart = k;
          while (k < n && !isWhitespace(input[k]) && input[k] !== ">") k += 1;
          if (k > valueStart) {
            i = k;
            matched = true;
          }
        }
      }
    }
    if (!matched) {
      out += input[i];
      i += 1;
    }
  }
  return out;
};

const newSanitize = (value) => {
  let out = stripScriptBlocks(value);
  out = out.replace(/javascript:/gi, "");
  out = stripInlineEventHandlers(out);
  return out;
};

let failures = 0;
const check = (name, actual, expected) => {
  const ok = actual === expected;
  if (!ok) failures += 1;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : `  got=${JSON.stringify(actual)} want=${JSON.stringify(expected)}`}`);
};

// 1. Benign inputs: old and new must agree byte-for-byte
const benign = [
  "Bike stolen near Gulberg main boulevard",
  "Report #123 filed at 21:45 on 2026-09-26",
  "Suspect said 'javascript is slow' — no URI here",
  "Location: 31.5204, 74.3587; zone D; notes follow",
  "",
];
for (const s of benign) {
  check(`benign identical: ${JSON.stringify(s.slice(0, 30))}`, newSanitize(s), oldSanitize(s));
}

// 2. Script blocks: both strip; `</script >` fixed by new
check("script block", newSanitize("hello <script>alert(1)</script> world"), "hello  world");
check("script block uppercase", newSanitize("A<SCRIPT SRC=x>bad</SCRIPT>B"), "AB");
check("end tag with space (old miss)", newSanitize("x<script>a</script >y"), "xy");
check("unclosed script kept", newSanitize("x<script>alert(1)"), "x<script>alert(1)");

// 3. Event handlers: both strip the common forms
check("double-quoted handler", newSanitize('<img onclick="steal()">'), "<img >");
check("single-quoted handler", newSanitize("<body OnLoad='pwn()'>"), "<body >");
check("unquoted handler", newSanitize("<a onerror=boom>"), "<a >");
check("handler without value kept (matches old)", newSanitize("onclick=>"), "onclick=>");
check("'on=' with no word kept (matches old)", newSanitize("on=1"), "on=1");

// 4. javascript: URIs
check("javascript uri", newSanitize("click javascript:alert(1)"), "click alert(1)");

// 5. Adversarial timing — the ReDoS shapes CodeQL flagged
const time = (fn, s) => {
  const t0 = process.hrtime.bigint();
  fn(s);
  return Number(process.hrtime.bigint() - t0) / 1e6;
};
const attacks = {
  "script prefix ×40k": "<script" + "a".repeat(40000),
  "open markers ×40k": "<script>".repeat(40000),
  "handler-echo ×40k": ("on" + "n".repeat(30) + "=").repeat(40000),
  "unterminated attr ×40k": "onclick=".repeat(40000),
};
for (const [name, s] of Object.entries(attacks)) {
  const oldMs = time(oldSanitize, s);
  const newMs = time(newSanitize, s);
  const ok = newMs < 50;
  if (!ok) failures += 1;
  console.log(
    `${ok ? "PASS" : "FAIL"}  timing ${name}: old=${oldMs.toFixed(1)}ms new=${newMs.toFixed(1)}ms (len=${s.length})`
  );
}

console.log(failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
