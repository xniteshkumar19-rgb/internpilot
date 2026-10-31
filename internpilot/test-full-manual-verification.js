const http = require('http');
const path = require('path');
const fs = require('fs');

const app = require('./server.js');
const {
  scamCheck,
  extractSkills,
  analyzeCareerMatch,
  matchSkills,
  findEvidenceInResume,
  extractResponsibilitiesAndQualifications,
  computeActivity,
  PROJECT_BLUEPRINTS,
  PARTIAL_MATCH_MAP
} = require('./public/tools.js');

console.log("======================================================================");
console.log("       INTERNPILOT FINAL SYSTEM-WIDE VERIFICATION AUDIT               ");
console.log("======================================================================\n");

let passed = 0;
let total = 0;

function assert(condition, testName) {
  total++;
  if (condition) {
    console.log(`  ✓ [PASS] ${testName}`);
    passed++;
  } else {
    console.error(`  ✗ [FAIL] ${testName}`);
  }
}

async function runAudit() {
  // -------------------------------------------------------------
  // 1. BACKEND ROUTE & SERVER LOGIC VERIFICATION (IN-MEMORY)
  // -------------------------------------------------------------
  console.log("▶ [CHECK 1] In-Memory Backend Route & File Serving Verification...");

  function simulateRoute(app, method, url, body = null) {
    return new Promise((resolve, reject) => {
      const { EventEmitter } = require('events');
      const req = new EventEmitter();
      req.method = method;
      req.url = url;
      req.headers = { 'content-type': 'application/json' };
      req.body = body;

      const res = {
        statusCode: 200,
        headers: {},
        setHeader(k, v) { this.headers[k] = v; },
        status(code) { this.statusCode = code; return this; },
        json(data) {
          resolve({ status: this.statusCode, data });
        },
        send(data) {
          resolve({ status: this.statusCode, data });
        }
      };

      app.handle(req, res, (err) => {
        if (err) reject(err);
        else resolve({ status: res.statusCode, data: null });
      });
    });
  }

  // A. Healthcheck /api
  const apiRes = await simulateRoute(app, 'GET', '/api');
  assert(apiRes.status === 200 && apiRes.data.status === 'ok' && apiRes.data.service === 'InternPilot API', "GET /api returns healthy status and service signature");

  // B. Test Postings
  const postingsRes = await simulateRoute(app, 'GET', '/api/test-postings');
  const postingsData = JSON.parse(postingsRes.data);
  assert(postingsRes.status === 200 && Array.isArray(postingsData) && postingsData.length === 7, `GET /api/test-postings returns 7 sample postings (Got: ${postingsData.length})`);

  // C. Sample Resume
  const resumeRes = await simulateRoute(app, 'GET', '/api/sample-resume');
  assert(resumeRes.status === 200 && resumeRes.data.includes("ROHAN SHARMA"), "GET /api/sample-resume returns Rohan Sharma's sample resume");

  // D. Parse Resume Endpoint (Simulating text extraction)
  const parseRes = await simulateRoute(app, 'POST', '/api/parse-resume', {
    filename: 'resume.txt',
    fileData: Buffer.from("PRIYA PATEL\nSkills: Python, Machine Learning, SQL").toString('base64'),
    fileType: 'text/plain'
  });
  assert(parseRes.status === 200 && parseRes.data.text.includes("PRIYA PATEL"), "POST /api/parse-resume successfully parses base64 text payload");

  // E. Static Demo Cache File Exists
  const cacheFile = fs.readFileSync(path.join(__dirname, 'public', 'demo-cache.json'), 'utf8');
  const cacheData = JSON.parse(cacheFile);
  assert(cacheData.postings && Object.keys(cacheData.postings).length === 7, "public/demo-cache.json contains complete 7-posting demo cache");

  console.log("\n----------------------------------------------------------------------\n");

  // -------------------------------------------------------------
  // 2. FRONTEND ASSETS & ELEMENT ID INTEGRITY
  // -------------------------------------------------------------
  console.log("▶ [CHECK 2] Frontend HTML/CSS/JS Contract & Element ID Verification...");
  const indexHtml = fs.readFileSync(path.join(__dirname, 'public', 'index.html'), 'utf8');
  const trackerHtml = fs.readFileSync(path.join(__dirname, 'public', 'tracker.html'), 'utf8');
  const appJs = fs.readFileSync(path.join(__dirname, 'public', 'app.js'), 'utf8');

  // Verify all contract IDs and classes across the pages
  assert(indexHtml.includes('id="resume"'), 'index.html preserves id="resume"');
  assert(indexHtml.includes('id="posting"'), 'index.html preserves id="posting"');
  assert(indexHtml.includes('id="run"'), 'index.html preserves id="run"');
  assert(indexHtml.includes('id="log"'), 'index.html preserves id="log"');
  assert(indexHtml.includes('id="results"'), 'index.html preserves id="results"');
  assert(indexHtml.includes('id="progress"'), 'index.html preserves id="progress"');
  assert(/\bclass="[^"]*\breveal\b[^"]*"/.test(indexHtml), 'index.html preserves class="reveal" for smooth scroll entrance');
  assert(trackerHtml.includes('tracker-body') || trackerHtml.includes('id="tracker-list"'), 'tracker.html preserves tracker container');
  assert(appJs.includes('step') && appJs.includes('log-step'), 'app.js preserves timeline step rendering');

  // Check dark navy / teal CSS tokens
  const styleCss = fs.readFileSync(path.join(__dirname, 'public', 'style.css'), 'utf8');
  assert(styleCss.includes('--teal: #2dd4bf;') || styleCss.includes('#2dd4bf'), "style.css preserves core teal accent (#2dd4bf)");
  assert(styleCss.includes('--bg: #0a0f1d;') || styleCss.includes('#0a0f1d'), "style.css preserves dark navy background (#0a0f1d)");
  assert(styleCss.includes('.careermatch-gap-bar'), "style.css contains Skill Gap breakdown bar styles");
  assert(styleCss.includes('.comp-filter-tabs'), "style.css contains interactive competency filter tabs");
  assert(styleCss.includes('.posting-intel-grid'), "style.css contains responsibilities & qualifications intel styles");

  console.log("\n----------------------------------------------------------------------\n");

  // -------------------------------------------------------------
  // 3. SCORING & WEIGHTED FORMULA CHECK (MANUAL VERIFICATION)
  // -------------------------------------------------------------
  console.log("▶ [CHECK 3] Mathematical Audit of Weighted Matching Formula...");

  // DevOps Combination Manual Calculation:
  // 4 Required skills: Linux, Docker, Git, Cloud -> weight 2.0 each = 8.0 max
  // 2 Preferred skills: AWS, Python -> weight 1.0 each = 2.0 max
  // Total max = 10.0 points
  // Candidate has: Linux, Docker, Git, Cloud, AWS (4 required matched + 1 preferred matched)
  // Earned points = (4 * 2.0) + (1 * 1.0) = 8.0 + 1.0 = 9.0 points
  // Mathematical expectation: 9.0 / 10.0 = 90% exactly.

  const devopsResume = `
ALEX CHEN - Infrastructure Engineer
Skills: Linux, Docker, Git, Cloud, C++, AWS
Experience: Managed Linux container clusters with Docker and Git version control on AWS.
  `;
  const devopsJob = `
Cloud Operations Intern
Responsibilities:
- Deploy Linux microservices with Docker.
- Automate Git deployment pipelines to cloud clusters.
Qualifications:
- Linux system familiarity.
Required Skills: Linux, Docker, Git, Cloud
Preferred Skills: AWS, Python
  `;

  const cmDevops = analyzeCareerMatch(devopsResume, devopsJob);
  assert(cmDevops.percent === 90, `DevOps test produces exact 90% score (Got: ${cmDevops.percent}%)`);
  assert(cmDevops.scoreBreakdown.includes("Earned 9.0 / 10.0 points"), `Score breakdown sentence reports exact earned points (9.0 / 10.0)`);
  assert(cmDevops.requiredSkills.length === 4, `Identifies exactly 4 required skills (Got: ${cmDevops.requiredSkills.length})`);
  assert(cmDevops.preferredSkills.length === 2, `Identifies exactly 2 preferred skills (Got: ${cmDevops.preferredSkills.length})`);
  assert(cmDevops.matched.length === 5, `Identifies exactly 5 matched competencies (Got: ${cmDevops.matched.length})`);
  assert(cmDevops.missing.length === 1 && cmDevops.missing[0].name === "python", `Identifies Python as the 1 missing gap`);

  console.log("\n----------------------------------------------------------------------\n");

  // -------------------------------------------------------------
  // 4. PARTIAL MATCH GROUNDING & RESUME SNIPPET PROOF
  // -------------------------------------------------------------
  console.log("▶ [CHECK 4] Partial Match Grounding & Verification...");

  const feResume = `
ROHAN SHARMA
Skills: JavaScript, HTML, CSS, React, Git
Projects:
- Student Study Tracker: Built modular user interface with vanilla JavaScript and DOM APIs.
  `;
  const quote = findEvidenceInResume(feResume, "javascript");
  assert(quote !== null && quote.includes("JavaScript"), `findEvidenceInResume extracts genuine quote: "${quote}"`);

  const cmFE = analyzeCareerMatch(feResume, `
Web Engineering Intern
Required Skills: JavaScript, TypeScript, React
Preferred Skills: Next.js
  `);

  const tsPartial = cmFE.partial.find(s => s.name === "typescript");
  assert(tsPartial !== undefined, "TypeScript identified as partial match");
  assert(tsPartial && tsPartial.credit === 0.5, "Partial match receives 0.5x credit");
  assert(tsPartial && tsPartial.foundationEvidence.includes("Resume proof"), "Partial match cites grounded 'Resume proof'");
  assert(tsPartial && tsPartial.resumeSnippet && tsPartial.resumeSnippet.includes("JavaScript"), "Partial match includes exact verified resume snippet");

  console.log("\n----------------------------------------------------------------------\n");

  // -------------------------------------------------------------
  // 5. SECURITY GATE & AGENT DECISIONS (SCAM & LOW MATCH)
  // -------------------------------------------------------------
  console.log("▶ [CHECK 5] Agent Security Decision Gates...");

  // High-Risk Scam (scam-1 from canonical test suite)
  const scamJobText = "QuickCareer Global Services: Urgent opening! Limited seats available for immediate direct selection. 100% placement guaranteed. Candidates must pay a mandatory registration fee of Rs 1,500. WhatsApp only: +91 98765 43210.";
  const scamEval = scamCheck(scamJobText);
  assert(scamEval.level === "high" && scamEval.riskScore >= 60, `Scam check halts high-risk posting (Score: ${scamEval.riskScore}/100)`);
  assert(scamEval.reasons.some(r => r.rule.includes("money")), `Triggers 'Asks for money' rule`);

  // Low Match Posting
  const lowMatchJob = `
AI Research Intern
Required Skills: PyTorch, TensorFlow, Statistics, SQL
Preferred Skills: Kubernetes
  `;
  const cmLow = analyzeCareerMatch(feResume, lowMatchJob);
  assert(cmLow.percent !== null && cmLow.percent < 30, `Frontend candidate against ML research produces low match: ${cmLow.percent}% (< 30%)`);
  assert(cmLow.missing.length >= 3, `Identifies key missing competencies for personalized roadmap`);

  console.log("\n----------------------------------------------------------------------\n");

  // -------------------------------------------------------------
  // 6. DOMAIN PROJECT RECOMMENDATION ADAPTIVITY
  // -------------------------------------------------------------
  console.log("▶ [CHECK 6] Domain Project Blueprint Relevance...");

  // Web Role -> Web projects
  assert(cmFE.projects.some(p => p.skillsCovered.includes("React") || p.skillsCovered.includes("TypeScript")), "Frontend job recommends frontend/web student portfolio projects");

  // ML Role -> ML projects
  const dataResume = `
PRIYA PATEL
Skills: Python, Machine Learning, Statistics, Pandas, SQL
Projects: Trained gradient boosting classifiers in Python.
  `;
  const cmML = analyzeCareerMatch(dataResume, `
Machine Learning Intern
Required Skills: Python, Machine Learning, Statistics
  `);
  assert(cmML.projects.some(p => p.skillsCovered.includes("Machine Learning") || p.skillsCovered.includes("Python")), "ML job recommends data analytics / machine learning projects");

  console.log("\n----------------------------------------------------------------------\n");

  // -------------------------------------------------------------
  // 7. PRIVACY & ZERO EXPOSURE AUDIT
  // -------------------------------------------------------------
  console.log("▶ [CHECK 7] Zero API Key & Private Data Leakage Audit...");

  const clientFiles = [
    fs.readFileSync(path.join(__dirname, 'public', 'app.js'), 'utf8'),
    fs.readFileSync(path.join(__dirname, 'public', 'agent.js'), 'utf8'),
    fs.readFileSync(path.join(__dirname, 'public', 'tools.js'), 'utf8'),
    fs.readFileSync(path.join(__dirname, 'public', 'index.html'), 'utf8'),
    fs.readFileSync(path.join(__dirname, 'public', 'demo-cache.json'), 'utf8')
  ];

  for (const code of clientFiles) {
    assert(!code.includes("AIzaSy"), "Zero hardcoded Google API keys in client-side code");
    assert(!code.includes("process.env.GEMINI_API_KEY"), "GEMINI_API_KEY is not directly referenced in client scripts");
  }

  console.log("\n======================================================================");
  console.log(`TOTAL AUDIT CHECKS: ${total} | PASSED: ${passed} | FAILED: ${total - passed}`);
  console.log("======================================================================\n");

  if (passed === total) {
    console.log("🎉 ALL SYSTEM-WIDE VERIFICATION CHECKS PASSED 100%!");
    process.exit(0);
  } else {
    console.error("❌ AUDIT FAILURES DETECTED.");
    process.exit(1);
  }
}

runAudit().catch(err => {
  console.error("Fatal error during audit:", err);
  process.exit(1);
});
