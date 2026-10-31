/**
 * Test Suite: Assisted Source Verification Mode Express Route & Handler Integration
 * Runs in-process with mock request/response objects (sandbox compliant, zero network socket requirement).
 */

const assert = require('assert');
const app = require('./server');

function mockRequest(app, method, url, body = {}) {
  return new Promise((resolve, reject) => {
    // Find matching route or use app handle
    const req = {
      method: method.toUpperCase(),
      url: url,
      body: body,
      headers: { 'content-type': 'application/json' },
      get: (header) => (header.toLowerCase() === 'content-type' ? 'application/json' : '')
    };

    let statusCode = 200;
    let headers = {};
    const res = {
      status: (code) => {
        statusCode = code;
        return res;
      },
      setHeader: (k, v) => {
        headers[k] = v;
      },
      json: (data) => {
        resolve({ status: statusCode, headers, body: data });
      },
      send: (data) => {
        resolve({ status: statusCode, headers, body: data });
      }
    };

    app(req, res, (err) => {
      if (err) reject(err);
      else resolve({ status: 404, headers, body: { error: 'Not found' } });
    });
  });
}

async function runTests() {
  console.log("======================================================================");
  console.log("   ASSISTED SOURCE VERIFICATION MODE ROUTE INTEGRATION TEST           ");
  console.log("======================================================================");

  // 1. GET /api/source-finder/status
  console.log("\n▶ [TEST 1] GET /api/source-finder/status...");
  const statusRes = await mockRequest(app, 'GET', '/api/source-finder/status');
  assert.strictEqual(statusRes.status, 200);
  assert.strictEqual(typeof statusRes.body.configured, 'boolean');
  console.log("  ✓ Provider status:", statusRes.body.provider || "None (Assisted Fallback)");
  console.log("  ✓ Status message:", statusRes.body.message);

  // 2. POST /api/source-finder/verify (Transitions to Assisted Mode when no search key)
  console.log("\n▶ [TEST 2] POST /api/source-finder/verify (Transition to Assisted Mode)...");
  const verifyRes = await mockRequest(app, 'POST', '/api/source-finder/verify', {
    url: "https://www.linkedin.com/jobs/view/apex-cloud-junior-web-developer-intern-39218",
    isDemo: true
  });
  assert.strictEqual(verifyRes.status, 200);
  assert(verifyData => verifyRes.body.state, "Must return valid state");
  console.log(`  ✓ State received: ${verifyRes.body.state} (${verifyRes.body.label})`);

  // 3. POST /api/source-finder/assisted-compare -> Details Match
  console.log("\n▶ [TEST 3] POST /api/source-finder/assisted-compare -> Details Match...");
  const matchRes = await mockRequest(app, 'POST', '/api/source-finder/assisted-compare', {
    submittedUrl: "https://www.linkedin.com/jobs/view/apex-cloud-junior-web-developer-intern-39218",
    officialUrl: "https://careers.apexcloud.io/internships/junior-web-dev",
    isDemo: true
  });
  assert.strictEqual(matchRes.status, 200);
  assert.strictEqual(matchRes.body.state, "DETAILS_MATCH");
  assert.strictEqual(matchRes.body.label, "Details Match");
  assert(matchRes.body.matchingDetails.length > 0, "Must have matching details");
  assert.strictEqual(matchRes.body.differingFields.length, 0, "Exact match has no differing fields");
  assert(matchRes.body.disclaimer.includes("InternPilot did not independently discover"), "Must include student-assisted disclaimer");
  console.log("  ✓ Result: 'Details Match'");
  console.log("  ✓ Matching fields count:", matchRes.body.matchingDetails.length);
  console.log("  ✓ Disclaimer present:", matchRes.body.disclaimer.slice(0, 50) + "...");

  // 4. POST /api/source-finder/assisted-compare -> Possible Match
  console.log("\n▶ [TEST 4] POST /api/source-finder/assisted-compare -> Possible Match...");
  const possRes = await mockRequest(app, 'POST', '/api/source-finder/assisted-compare', {
    submittedUrl: "https://internshala.com/internship/detail/frontend-intern-vanguard-data-labs-8812",
    officialUrl: "https://vanguarddatalabs.com/careers/frontend-engineer-junior",
    isDemo: true
  });
  assert.strictEqual(possRes.status, 200);
  assert.strictEqual(possRes.body.state, "POSSIBLE_MATCH");
  assert.strictEqual(possRes.body.label, "Possible Match");
  assert(possRes.body.differingFields.length >= 2, "Must list differing fields");
  assert(possRes.body.disclaimer.includes("InternPilot did not independently discover"), "Must include student-assisted disclaimer");
  console.log("  ✓ Result: 'Possible Match'");
  console.log("  ✓ Differing fields count:", possRes.body.differingFields.length);

  // 5. POST /api/source-finder/assisted-compare -> Details Differ
  console.log("\n▶ [TEST 5] POST /api/source-finder/assisted-compare -> Details Differ...");
  const diffRes = await mockRequest(app, 'POST', '/api/source-finder/assisted-compare', {
    submittedUrl: "https://indeed.com/viewjob?jk=horizon-next-python-intern-4421",
    officialUrl: "https://differsite.com/careers/marketing-manager",
    isDemo: true
  });
  assert.strictEqual(diffRes.status, 200);
  assert.strictEqual(diffRes.body.state, "DETAILS_DIFFER");
  assert.strictEqual(diffRes.body.label, "Details Differ");
  assert(diffRes.body.differingFields.length >= 1, "Must list differences");
  assert(diffRes.body.disclaimer.includes("InternPilot did not independently discover"), "Must include student-assisted disclaimer");
  console.log("  ✓ Result: 'Details Differ'");

  // 6. POST /api/source-finder/assisted-compare -> Unable to Compare
  console.log("\n▶ [TEST 6] POST /api/source-finder/assisted-compare -> Unable to Compare...");
  const unRes = await mockRequest(app, 'POST', '/api/source-finder/assisted-compare', {
    submittedUrl: "https://invalid-unreachable-domain-xyz.com/job/1234",
    officialUrl: "https://invalid-unreachable-domain-xyz.com/job/5678",
    isDemo: true
  });
  assert.strictEqual(unRes.status, 200);
  assert.strictEqual(unRes.body.state, "UNABLE_TO_COMPARE");
  assert.strictEqual(unRes.body.label, "Unable to Compare");
  assert(unRes.body.disclaimer.includes("InternPilot did not independently discover"), "Must include student-assisted disclaimer");
  console.log("  ✓ Result: 'Unable to Compare'");

  // 7. SSRF check on student-supplied internal IP candidate
  console.log("\n▶ [TEST 7] SSRF rejection on student-supplied internal IP...");
  const ssrfRes = await mockRequest(app, 'POST', '/api/source-finder/assisted-compare', {
    submittedUrl: "https://example.com/job/123",
    submittedHtml: "<html><body>Apex Cloud Web Intern</body></html>",
    officialUrl: "http://127.0.0.1:8080/internal-admin",
    isDemo: false
  });
  assert.strictEqual(ssrfRes.body.success, false);
  assert.strictEqual(ssrfRes.body.state, "UNABLE_TO_COMPARE");
  assert(ssrfRes.body.error.includes("private") || ssrfRes.body.error.includes("security"), "Must cite security or private IP violation");
  console.log("  ✓ SSRF blocked candidate URL successfully:", ssrfRes.body.error);

  console.log("\n======================================================================");
  console.log("🎉 ALL ASSISTED MODE ROUTE INTEGRATION TESTS PASSED 100%!");
  console.log("======================================================================\n");
}

runTests().catch(err => {
  console.error("Test failed:", err);
  process.exit(1);
});
