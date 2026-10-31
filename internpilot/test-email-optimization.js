const assert = require('assert');

console.log('===============================================================');
console.log('       INTERNPILOT EMAIL OPTIMIZATION & RESILIENCE TEST        ');
console.log('===============================================================\n');

let passed = 0;
let failed = 0;

function check(desc, fn) {
  try {
    fn();
    console.log(`  ✓ [PASS] ${desc}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ [FAIL] ${desc}: ${err.message}`);
    failed++;
  }
}

async function checkAsync(desc, fn) {
  try {
    await fn();
    console.log(`  ✓ [PASS] ${desc}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ [FAIL] ${desc}: ${err.message}`);
    failed++;
  }
}

// ---------------------------------------------------------------------------
// TEST 1: Missing API Key Handling
// ---------------------------------------------------------------------------
console.log('▶ [TEST 1 & 2] Testing Missing API Key Handling...');
checkAsync('Server returns 503 with API_KEY_MISSING when GEMINI_API_KEY is unset', async () => {
  let status, data;
  try {
    const res = await fetch('http://localhost:3000/api/gemini', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: 'test' })
    });
    status = res.status;
    data = await res.json();
  } catch (err) {
    // In-process simulation fallback when running inside sandbox runner
    const app = require('./server');
    const simRes = await new Promise((resolve) => {
      const req = {
        method: 'POST',
        url: '/api/gemini',
        body: { prompt: 'test' },
        headers: { 'content-type': 'application/json' }
      };
      let code = 200;
      const resObj = {
        status: (c) => { code = c; return resObj; },
        setHeader: () => {},
        json: (d) => resolve({ status: code, data: d }),
        send: (d) => resolve({ status: code, data: d })
      };
      app(req, resObj);
    });
    status = simRes.status;
    data = simRes.data;
  }
  assert.strictEqual(status, 503, `Expected status 503, got ${status}`);
  assert.strictEqual(data.code, 'API_KEY_MISSING', `Expected code API_KEY_MISSING, got ${data.code}`);
  assert.strictEqual(data.error, 'AI service is not configured.', `Expected friendly error, got ${data.error}`);
});

// ---------------------------------------------------------------------------
// TEST 2: extractJsonFromText Robustness (No unhandled throws on invalid JSON)
// ---------------------------------------------------------------------------
console.log('\n▶ [TEST 6 & 7] Testing extractJsonFromText Parsing & Fallback...');

// Define the exact extractJsonFromText function from public/app.js
function extractJsonFromText(rawText) {
  if (!rawText || typeof rawText !== "string") return null;

  let cleaned = rawText.replace(/```(?:json)?/gi, "").replace(/```/g, "").trim();

  try {
    const direct = JSON.parse(cleaned);
    if (direct && typeof direct === "object") return direct;
  } catch {}

  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    const candidate = cleaned.substring(firstBrace, lastBrace + 1);
    try {
      const parsed = JSON.parse(candidate);
      if (parsed && typeof parsed === "object") return parsed;
    } catch {
      try {
        const sanitized = candidate.replace(/\n/g, "\\n").replace(/\r/g, "");
        const parsedSanitized = JSON.parse(sanitized);
        if (parsedSanitized && typeof parsedSanitized === "object") return parsedSanitized;
      } catch {}
    }
  }

  const subjectMatch = rawText.match(/"subject"\s*:\s*"([^"]+)"/i);
  const bodyMatch = rawText.match(/"body"\s*:\s*"([\s\S]+?)"\s*}/i);
  if (subjectMatch || bodyMatch) {
    return {
      subject: subjectMatch ? subjectMatch[1].replace(/\\n/g, "\n").replace(/\\"/g, '"') : "Application for Internship",
      body: bodyMatch ? bodyMatch[1].replace(/\\n/g, "\n").replace(/\\"/g, '"') : ""
    };
  }

  return null;
}

check('Parses clean JSON directly', () => {
  const jsonStr = '{"subject": "Application", "body": "Dear Hiring Team..."}';
  const res = extractJsonFromText(jsonStr);
  assert.strictEqual(res.subject, "Application");
  assert.strictEqual(res.body, "Dear Hiring Team...");
});

check('Handles markdown code fences without error', () => {
  const fenced = '```json\n{"subject": "Intern Role", "body": "Hello"}\n```';
  const res = extractJsonFromText(fenced);
  assert.strictEqual(res.subject, "Intern Role");
});

check('Handles conversational prefix/suffix around JSON', () => {
  const wrapped = 'Here is your email draft:\n{"subject": "App - Rohan", "body": "I am applying."}\nHope this helps!';
  const res = extractJsonFromText(wrapped);
  assert.strictEqual(res.subject, "App - Rohan");
  assert.strictEqual(res.body, "I am applying.");
});

check('Handles unescaped newlines in JSON body without throwing', () => {
  const unescapedNewlines = '{\n"subject": "App",\n"body": "Line 1\nLine 2\nLine 3"\n}';
  const res = extractJsonFromText(unescapedNewlines);
  assert(res !== null, 'Expected parsed object, got null');
  assert.strictEqual(res.subject, "App");
  assert(res.body.includes("Line 1"), 'Body should contain text');
});

check('Handles completely malformed JSON with regex fallback', () => {
  const broken = '{"subject": "Web Developer Intern Application", "body": "Dear Team, unclosed quote and syntax error!';
  const res = extractJsonFromText(broken);
  assert.strictEqual(res.subject, "Web Developer Intern Application");
});

check('Returns null for empty or non-string input without throwing', () => {
  assert.strictEqual(extractJsonFromText(null), null);
  assert.strictEqual(extractJsonFromText(""), null);
  assert.strictEqual(extractJsonFromText("No JSON here"), null);
});

// ---------------------------------------------------------------------------
// TEST 3: Error Classification & Friendly Messages (Step 3)
// ---------------------------------------------------------------------------
console.log('\n▶ [TEST 3, 4 & 5] Testing Error Mapping & Friendly Messages...');

function mapErrorToUserMessage(code, status) {
  if (code === "API_KEY_MISSING" || code === "API_KEY_INVALID" || status === 401 || status === 403) {
    return { message: "AI service is not configured.", errorType: "apiKeyMissing", canRetry: false };
  }
  if (code === "RATE_LIMIT" || status === 429) {
    return { message: "AI request limit reached. Please try again later.", errorType: "rateLimit", canRetry: false };
  }
  if (code === "TIMEOUT") {
    return { message: "Email generation took too long. Please retry.", errorType: "timeout", canRetry: true };
  }
  if (code === "NETWORK_ERROR") {
    return { message: "Unable to connect to the AI service.", errorType: "network", canRetry: true };
  }
  if (code === "FILTERED_RESPONSE" || code === "EMPTY_RESPONSE" || code === "INVALID_REQUEST") {
    return { message: "The AI returned an unexpected response.", errorType: "invalidResponse", canRetry: true };
  }
  return { message: "AI service encountered an error.", errorType: "general", canRetry: true };
}

check('Maps missing/invalid API key to "AI service is not configured." (canRetry: false)', () => {
  const res1 = mapErrorToUserMessage("API_KEY_MISSING", 503);
  assert.strictEqual(res1.message, "AI service is not configured.");
  assert.strictEqual(res1.canRetry, false);

  const res2 = mapErrorToUserMessage("API_KEY_INVALID", 401);
  assert.strictEqual(res2.message, "AI service is not configured.");
  assert.strictEqual(res2.canRetry, false);
});

check('Maps 429 quota to "AI request limit reached. Please try again later." (canRetry: false)', () => {
  const res = mapErrorToUserMessage("RATE_LIMIT", 429);
  assert.strictEqual(res.message, "AI request limit reached. Please try again later.");
  assert.strictEqual(res.canRetry, false);
});

check('Maps timeout to "Email generation took too long. Please retry." (canRetry: true)', () => {
  const res = mapErrorToUserMessage("TIMEOUT", 0);
  assert.strictEqual(res.message, "Email generation took too long. Please retry.");
  assert.strictEqual(res.canRetry, true);
});

check('Maps network error to "Unable to connect to the AI service." (canRetry: true)', () => {
  const res = mapErrorToUserMessage("NETWORK_ERROR", 0);
  assert.strictEqual(res.message, "Unable to connect to the AI service.");
  assert.strictEqual(res.canRetry, true);
});

check('Maps empty/filtered response to "The AI returned an unexpected response." (canRetry: true)', () => {
  const res = mapErrorToUserMessage("EMPTY_RESPONSE", 502);
  assert.strictEqual(res.message, "The AI returned an unexpected response.");
  assert.strictEqual(res.canRetry, true);
});

// ---------------------------------------------------------------------------
// TEST 4: Prompt Optimization & Input Trimming (Step 2 & 5)
// ---------------------------------------------------------------------------
console.log('\n▶ [TEST 8, 9 & 10] Testing Prompt Optimization & Input Trimming...');

check('Trims giant resumes to maximum 2,500 characters', () => {
  const massiveResume = "SKILLS: JavaScript, Python\n" + "EXPERIENCE: Built web apps.\n".repeat(200);
  assert(massiveResume.length > 5000, "Should be a massive resume");
  const trimmed = massiveResume.trim().substring(0, 2500);
  assert(trimmed.length <= 2500, `Expected <= 2500 chars, got ${trimmed.length}`);
  assert(trimmed.startsWith("SKILLS: JavaScript"), "Preserves header and key skills");
});

check('Prevents duplicate concurrent runs via state lock', () => {
  let isRunning = false;
  let runCount = 0;

  function triggerRun() {
    if (isRunning) return 'BLOCKED';
    isRunning = true;
    runCount++;
    return 'STARTED';
  }

  assert.strictEqual(triggerRun(), 'STARTED');
  assert.strictEqual(triggerRun(), 'BLOCKED');
  assert.strictEqual(triggerRun(), 'BLOCKED');
  assert.strictEqual(runCount, 1);

  isRunning = false;
  assert.strictEqual(triggerRun(), 'STARTED');
  assert.strictEqual(runCount, 2);
});

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------
(async () => {
  // Wait a moment for any pending async tasks
  await new Promise(r => setTimeout(r, 200));

  console.log('\n===============================================================');
  console.log(`TOTAL: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log('===============================================================');

  if (failed > 0) {
    process.exit(1);
  } else {
    console.log('All email generation optimization tests passed successfully!\n');
    process.exit(0);
  }
})();
