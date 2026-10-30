const { scamCheck, matchSkills, extractSkills } = require('./public/tools.js');
const { runAgent } = require('./public/agent.js');

console.log('===============================================================');
console.log('       INTERNPILOT DYNAMIC RESUME & JOB POSTING TEST           ');
console.log('===============================================================\n');

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ ${message}`);
    passed++;
  } else {
    console.error(`  ✗ FAILED: ${message}`);
    failed++;
  }
}

// -------------------------------------------------------------
// Test 1: Dynamic Custom Resume Skill Extraction
// -------------------------------------------------------------
console.log('▶ [TEST 1] Testing Dynamic Custom Resume Parsing & Skill Alignment...');
const customMentorResume = `
DR. ARJUN PATEL
Lead Data Architect & Research Mentor
Skills: Python, SQL, PostgreSQL, PyTorch, Docker, Kubernetes, AWS, Machine Learning, Git.
Experience: Mentored 50+ students in deep learning pipelines and database scaling.
`;

const extractedMentorSkills = extractSkills(customMentorResume);
assert(
  extractedMentorSkills.includes('python') &&
  extractedMentorSkills.includes('sql') &&
  extractedMentorSkills.includes('postgresql') &&
  extractedMentorSkills.includes('pytorch') &&
  extractedMentorSkills.includes('docker') &&
  extractedMentorSkills.includes('kubernetes') &&
  extractedMentorSkills.includes('aws') &&
  extractedMentorSkills.includes('git'),
  'Extracted all 8 skills accurately from custom mentor resume.'
);

// -------------------------------------------------------------
// Test 2: Dynamic Skill Matching against Arbitrary Job Posting
// -------------------------------------------------------------
console.log('\n▶ [TEST 2] Testing Dynamic Skill Matching against Arbitrary Job Posting...');
const customJobPosting = `
CloudScale Innovations is seeking a Backend Engineering Intern.
Requirements: Python, PostgreSQL, Docker, AWS, and Git version control.
Stipend: ₹30,000/month. Send resume to jobs@cloudscale.io.
`;

const matchResult = matchSkills(customMentorResume, customJobPosting);
assert(
  matchResult.percent === 100,
  `Calculated 100% skill match (Matched: ${matchResult.matched.join(', ')}).`
);
assert(
  matchResult.missing.length === 0,
  'Zero missing skills identified.'
);

// -------------------------------------------------------------
// Test 3: Scam Check on Genuine Custom Job with Salary / Stipend
// -------------------------------------------------------------
console.log('\n▶ [TEST 3] Testing Scam Check on Custom Posting with Salary Mention...');
const scamCheckGenuine = scamCheck(customJobPosting);
assert(
  scamCheckGenuine.riskScore === 0 && scamCheckGenuine.level === 'low',
  'Clean custom posting correctly scored 0/100 (LOW risk) with ₹30,000 stipend mention.'
);

// -------------------------------------------------------------
// Test 4: Scam Check on Tricky Custom Job Demanding Registration Fee
// -------------------------------------------------------------
console.log('\n▶ [TEST 4] Testing Scam Check on Tricky Custom Posting with Fee Request...');
const customSuspiciousPosting = `
Global Talent Network announces direct selection with no interview!
Earn up to ₹40,000 per month from home. Limited seats available!
All selected candidates must pay a registration fee of ₹2,000 for verification.
Contact via telegram only: @globaltalent_hr
`;

const scamCheckSuspicious = scamCheck(customSuspiciousPosting);
assert(
  scamCheckSuspicious.riskScore >= 60 && scamCheckSuspicious.level === 'high',
  `Suspicious custom posting correctly flagged as HIGH risk (${scamCheckSuspicious.riskScore}/100 pts).`
);
assert(
  scamCheckSuspicious.reasons.some(r => r.rule === 'Asks for money'),
  'Triggered "Asks for money" (40 pts).'
);
assert(
  scamCheckSuspicious.reasons.some(r => r.rule === 'Contact only on WhatsApp or Telegram'),
  'Triggered "Contact only on WhatsApp or Telegram" (15 pts).'
);

// -------------------------------------------------------------
// Test 5: End-to-End Decision Pipeline with Custom Data & Overrides
// -------------------------------------------------------------
console.log('\n▶ [TEST 5] Testing End-to-End Agent Execution with Custom Data & Metadata Overrides...');
const logs = [];
function logger(entry) {
  logs.push(entry);
}

// Mock AI reader for offline harness
global.readPosting = async () => ({
  company: "AutoDetected Corp",
  role: "AutoDetected Intern",
  requiredSkills: ["python", "docker"],
  deadline: "2026-12-15",
  contactEmail: "careers@autodetected.com"
});

global.draftEmail = async (resume, details) => ({
  subject: `Application for ${details.role} - Dr. Arjun Patel`,
  body: `Dear Hiring Team at ${details.company},\n\nI am writing to express my interest in the ${details.role} position. With my background in Python and Docker, I am excited about the opportunity.\n\nBest regards,\nDr. Arjun Patel`
});

runAgent(customMentorResume, customJobPosting, logger, {
  customCompany: "CloudScale Innovations",
  customRole: "Backend Engineering Intern"
}).then(state => {
  assert(
    state.details.company === "CloudScale Innovations",
    'Metadata override successfully applied for Company ("CloudScale Innovations").'
  );
  assert(
    state.details.role === "Backend Engineering Intern",
    'Metadata override successfully applied for Role ("Backend Engineering Intern").'
  );
  assert(
    state.scam.level === "low",
    'Scam check level evaluated as LOW.'
  );
  assert(
    state.match.percent === 100,
    'Skill match percentage evaluated as 100%.'
  );
  assert(
    state.email !== null && state.email.subject.includes("Backend Engineering Intern"),
    'Custom email drafted with overridden role.'
  );

  console.log('\n===============================================================');
  console.log(`TOTAL: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log('===============================================================');

  if (failed > 0) {
    process.exit(1);
  } else {
    console.log('All dynamic analysis tests passed successfully!\n');
    process.exit(0);
  }
}).catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
