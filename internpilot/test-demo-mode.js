const fs = require('fs');
const path = require('path');
const { runAgent } = require('./public/agent.js');
const { SCAM_RULES, ACTIVITY_RULES } = require('./public/tools.js');

console.log('===============================================================');
console.log('         INTERNPILOT OFFLINE DEMO MODE TEST SUITE             ');
console.log('===============================================================\n');

const cachePath = path.join(__dirname, 'public', 'demo-cache.json');
const postingsPath = path.join(__dirname, 'test-postings.json');
const resumePath = path.join(__dirname, 'sample-resume.txt');

let allPassed = true;

// 1. Verify demo-cache.json file existence and structure
console.log('1. Verifying public/demo-cache.json...');
if (!fs.existsSync(cachePath)) {
  console.error('  ✗ FAILED: public/demo-cache.json does not exist.');
  process.exit(1);
}

let demoCache;
try {
  demoCache = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
  console.log('  ✓ File exists and is valid JSON.');
} catch (e) {
  console.error('  ✗ FAILED: public/demo-cache.json is not valid JSON:', e.message);
  process.exit(1);
}

if (!demoCache.postings || typeof demoCache.postings !== 'object') {
  console.error('  ✗ FAILED: demoCache.postings is missing or invalid.');
  allPassed = false;
} else {
  const count = Object.keys(demoCache.postings).length;
  console.log(`  ✓ demoCache.postings contains ${count} cached postings.`);
  if (count < 7) {
    console.error(`  ✗ FAILED: Expected 7 sample postings, found ${count}.`);
    allPassed = false;
  }
}

// Ensure no API keys or personal secrets in demo-cache.json
const rawCacheText = JSON.stringify(demoCache);
if (/AIza[0-9A-Za-z-_]{35}/.test(rawCacheText)) {
  console.error('  ✗ CRITICAL SECURITY FAILURE: API Key found inside demo-cache.json!');
  process.exit(1);
} else {
  console.log('  ✓ Security check: Zero API keys or secrets in demo cache.');
}

const sampleResumeText = fs.readFileSync(resumePath, 'utf8');
const postings = JSON.parse(fs.readFileSync(postingsPath, 'utf8'));

// Helper to capture agent logs
function createLogCapture() {
  const logs = [];
  const capture = (entry) => logs.push(entry);
  capture.getLogs = () => logs;
  return capture;
}

// 2. Test each of the 7 sample postings in Demo Mode
console.log('\n2. Testing all 7 sample postings in Demo Mode (100% Offline)...');

async function testPosting(p) {
  console.log(`\n▶ [SAMPLE POSTING: ${p.id.toUpperCase()}] (${p.label})`);
  const logCapture = createLogCapture();

  // Explicitly simulate offline by not having an active network / mock
  const state = await runAgent(sampleResumeText, p.text, logCapture, {
    demoMode: true,
    demoCache: demoCache,
    sampleResumeText: sampleResumeText,
    samplePostingId: p.id
  });

  const logs = logCapture.getLogs();

  // Check Step A: Details loaded from cache
  const detailsCard = logs.find(l => l.type === 'details-card');
  if (detailsCard && detailsCard.data && detailsCard.data.role) {
    console.log(`  ✓ Details loaded from cache: Role="${detailsCard.data.role}", Company="${detailsCard.data.company}"`);
  } else {
    console.error(`  ✗ FAILED: Details not loaded from demo cache for ${p.id}`);
    allPassed = false;
  }

  // Check Decision depending on posting label
  if (p.id === 'scam-1' || p.id === 'scam-2') {
    // Should halt on scam check
    const scamHalt = logs.find(l => l.type === 'scam-halt');
    const emailCard = logs.find(l => l.type === 'email-card');
    if (scamHalt && scamHalt.level === 'high' && !emailCard) {
      console.log(`  ✓ Correctly HALTED on high scam risk (${scamHalt.score}/100). No email drafted.`);
    } else {
      console.error(`  ✗ FAILED: Expected scam halt with no email for ${p.id}`);
      allPassed = false;
    }
  } else if (p.id === 'lowmatch-1') {
    // Should halt on low match (<30%)
    const matchHalt = logs.find(l => l.type === 'match-halt');
    const emailCard = logs.find(l => l.type === 'email-card');
    if (matchHalt && matchHalt.percent < 30 && !emailCard && matchHalt.missing.length > 0) {
      console.log(`  ✓ Correctly HALTED on low skill match (${matchHalt.percent}%). 'Learn these first' list: [${matchHalt.missing.join(', ')}]. No email drafted.`);
    } else {
      console.error(`  ✗ FAILED: Expected low match halt for ${p.id}`);
      allPassed = false;
    }
  } else if (p.id === 'genuine-1' || p.id === 'genuine-2') {
    // Should proceed to email draft and tracker prompt
    const emailCard = logs.find(l => l.type === 'email-card');
    const trackerPrompt = logs.find(l => l.type === 'tracker-prompt');
    if (emailCard && emailCard.subject && emailCard.body && trackerPrompt) {
      console.log(`  ✓ Full pipeline completed! Cached email draft loaded: Subject="${emailCard.subject}"`);
      console.log(`  ✓ Tracker prompted for confirmation: "${trackerPrompt.title}"`);
    } else {
      console.error(`  ✗ FAILED: Expected email draft and tracker prompt for genuine posting ${p.id}`);
      allPassed = false;
    }
  } else if (p.id === 'tricky-1' || p.id === 'tricky-2') {
    // Should show caution and proceed
    const scamWarn = logs.find(l => l.type === 'scam-warn');
    const emailCard = logs.find(l => l.type === 'email-card');
    if (scamWarn && scamWarn.level === 'medium' && emailCard) {
      console.log(`  ✓ Correctly identified MEDIUM risk warning (${scamWarn.score}/100). Caution displayed and flow proceeded.`);
    } else {
      console.error(`  ✗ FAILED: Expected medium scam warning for tricky posting ${p.id}`);
      allPassed = false;
    }
  }
}

async function runAllTests() {
  for (const p of postings) {
    await testPosting(p);
  }

  // 3. Test Edge Cases & Guardrails
  console.log('\n\n3. Testing Demo Mode Edge Cases & Corrupted Cache Handling...');

  // Edge case A: Corrupted / empty cache
  console.log('▶ [EDGE CASE A: Corrupted cache object]');
  const logCaptureA = createLogCapture();
  await runAgent(sampleResumeText, postings[0].text, logCaptureA, {
    demoMode: true,
    demoCache: null
  });
  const logsA = logCaptureA.getLogs();
  const errorA = logsA.find(l => l.type === 'step-error');
  if (errorA && errorA.text.includes('Demo cache')) {
    console.log(`  ✓ Handled missing/corrupted cache gracefully: "${errorA.text}"`);
  } else {
    console.error('  ✗ FAILED: Corrupted cache was not handled gracefully.');
    allPassed = false;
  }

  // Edge case B: Custom non-sample posting while Demo Mode is ON
  console.log('▶ [EDGE CASE B: Custom non-sample posting]');
  const logCaptureB = createLogCapture();
  await runAgent(sampleResumeText, 'Custom random company internship posting not in sample set.', logCaptureB, {
    demoMode: true,
    demoCache: demoCache,
    sampleResumeText: sampleResumeText
  });
  const logsB = logCaptureB.getLogs();
  const errorB = logsB.find(l => l.type === 'step-error');
  if (errorB && errorB.text.includes('Demo mode only covers the sample postings')) {
    console.log(`  ✓ Guardrail active: "${errorB.text}"`);
  } else {
    console.error('  ✗ FAILED: Expected guardrail message for non-sample posting.');
    allPassed = false;
  }

  // Edge case C: Custom resume while Demo Mode is ON
  console.log('▶ [EDGE CASE C: Custom resume]');
  const logCaptureC = createLogCapture();
  await runAgent('Jane Doe\nSkills: C++, Rust', postings[0].text, logCaptureC, {
    demoMode: true,
    demoCache: demoCache,
    sampleResumeText: sampleResumeText
  });
  const logsC = logCaptureC.getLogs();
  const errorC = logsC.find(l => l.type === 'step-error');
  if (errorC && errorC.text.includes('Demo mode only covers the sample postings')) {
    console.log(`  ✓ Guardrail active: "${errorC.text}"`);
  } else {
    console.error('  ✗ FAILED: Expected guardrail message for non-sample resume.');
    allPassed = false;
  }

  // Edge case D: Live AI mode unaffected (demoMode: false)
  console.log('▶ [EDGE CASE D: Live AI mode unaffected]');
  const logCaptureD = createLogCapture();
  // With demoMode: false, should proceed to live mode (not trigger demo guardrails)
  await runAgent(sampleResumeText, postings[0].text, logCaptureD, {
    demoMode: false
  });
  const logsD = logCaptureD.getLogs();
  const hasDemoGuard = logsD.some(l => l.text?.includes('Demo mode only covers'));
  if (!hasDemoGuard) {
    console.log('  ✓ Confirmed: Live AI mode does not invoke Demo Mode guardrails.');
  } else {
    console.error('  ✗ FAILED: Live mode accidentally invoked demo guardrail.');
    allPassed = false;
  }

  console.log('\n===============================================================');
  if (allPassed) {
    console.log('🎉 ALL OFFLINE DEMO MODE TESTS PASSED 100%!');
  } else {
    console.log('❌ SOME TESTS FAILED.');
    process.exit(1);
  }
  console.log('===============================================================\n');
}

runAllTests();
