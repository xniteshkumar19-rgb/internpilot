/**
 * Integration Test for all 3 Agent Paths:
 * 1. Scam Posting: halts with red warning & safety tips, no email drafted; resume via "Continue anyway".
 * 2. Low Match Posting: halts with "Learn these first" missing skills list, no email drafted; resume via "Draft anyway".
 * 3. Genuine Posting: passes scam check & skill match, reaches email draft, prompts tracker, saves ONLY on Yes.
 */

const fs = require('fs');
const path = require('path');
const { scamCheck, matchSkills, saveApplication, loadApplications } = require('./public/tools.js');
const { runAgent } = require('./public/agent.js');

// Mock localStorage for Node test environment
const mockStorage = {};
global.localStorage = {
  getItem: (key) => mockStorage[key] || null,
  setItem: (key, val) => { mockStorage[key] = String(val); },
  removeItem: (key) => { delete mockStorage[key]; },
  clear: () => { Object.keys(mockStorage).forEach(k => delete mockStorage[k]); }
};

// Mock readPosting & draftEmail for offline test harness
global.readPosting = async (text) => {
  if (text.includes("Apex Cloud Technologies")) {
    return {
      role: "Junior Web Developer Intern",
      company: "Apex Cloud Technologies",
      requiredSkills: ["html", "css", "javascript", "git", "communication"],
      deadline: "November 25, 2026",
      contactEmail: "careers@apexcloudtech.com",
      stipend: "Rs 15,000 per month",
      applicationMethod: "email"
    };
  }
  if (text.includes("NeuroData Technologies")) {
    return {
      role: "Associate Machine Learning Intern",
      company: "NeuroData Technologies",
      requiredSkills: ["pytorch", "tensorflow", "statistics", "python", "sql"],
      deadline: "November 30, 2026",
      contactEmail: "ml-interns@neurodatatech.ai",
      stipend: "Rs 25,000 per month",
      applicationMethod: "email"
    };
  }
  return null;
};

global.draftEmail = async (resumeText, details, match) => {
  return {
    subject: `Application for ${details?.role || "Internship"} - Rohan Sharma`,
    body: `Dear Hiring Team,\n\nI am writing to express my strong interest in the ${details?.role || "Internship"} role at ${details?.company || "your company"}.\n\nBest regards,\nRohan Sharma`
  };
};

const postings = JSON.parse(fs.readFileSync(path.join(__dirname, 'test-postings.json'), 'utf8'));
const resumeText = fs.readFileSync(path.join(__dirname, 'sample-resume.txt'), 'utf8');

function createLogger() {
  const entries = [];
  return {
    log: (entry) => entries.push(entry),
    entries
  };
}

async function testAllPaths() {
  console.log("===============================================================");
  console.log("           TESTING ALL THREE AGENT DECISION PATHS              ");
  console.log("===============================================================\n");

  let allPassed = true;

  // -----------------------------------------------------------------
  // PATH 1: SCAM POSTING
  // -----------------------------------------------------------------
  console.log("▶ [TEST 1] Testing Scam Posting (scam-1)...");
  const scamPosting = postings.find(p => p.id === 'scam-1');
  const logger1 = createLogger();
  const state1 = await runAgent(resumeText, scamPosting.text, logger1.log);

  const scamHalt = logger1.entries.find(e => e.type === 'scam-halt');
  const emailStep1 = logger1.entries.find(e => e.type === 'email-card');
  const scamDecision = logger1.entries.find(e => e.decisionText && e.decisionText.includes("high scam risk"));

  if (scamHalt && !emailStep1 && scamDecision) {
    console.log("  ✓ Correctly halted at scam check with high risk score: " + scamHalt.score);
    console.log("  ✓ Correct decision logged: \"" + scamHalt.decisionText + "\"");
    console.log("  ✓ No email was drafted automatically.");
  } else {
    console.error("  ✗ FAILED: Scam posting did not halt correctly.");
    allPassed = false;
  }

  // Test "Continue anyway" override for scam
  console.log("  Testing 'Continue anyway' override...");
  if (typeof scamHalt?.onContinue === 'function') {
    const overrideLogger = createLogger();
    await scamHalt.onContinue();
    console.log("  ✓ 'Continue anyway' callback executed successfully.");
  }

  console.log("\n---------------------------------------------------------------\n");

  // -----------------------------------------------------------------
  // PATH 2: LOW MATCH POSTING
  // -----------------------------------------------------------------
  console.log("▶ [TEST 2] Testing Low Match Posting (lowmatch-1)...");
  const lowMatchPosting = postings.find(p => p.id === 'lowmatch-1');
  const logger2 = createLogger();
  const state2 = await runAgent(resumeText, lowMatchPosting.text, logger2.log);

  const matchHalt = logger2.entries.find(e => e.type === 'match-halt');
  const emailStep2 = logger2.entries.find(e => e.type === 'email-card');
  const lowMatchDecision = logger2.entries.find(e => e.decisionText && e.decisionText.includes("match is very low"));

  if (matchHalt && !emailStep2 && lowMatchDecision) {
    console.log("  ✓ Correctly halted at skill match with low match: about " + matchHalt.percent + "%");
    console.log("  ✓ Correct decision logged: \"" + matchHalt.decisionText + "\"");
    console.log("  ✓ 'Learn these first' list provided with missing skills:", matchHalt.missing);
    console.log("  ✓ No email was drafted automatically.");
  } else {
    console.error("  ✗ FAILED: Low match posting did not halt correctly.");
    allPassed = false;
  }

  // Test "Draft anyway" override for low match
  console.log("  Testing 'Draft anyway' override...");
  if (typeof matchHalt?.onDraftAnyway === 'function') {
    await matchHalt.onDraftAnyway();
    console.log("  ✓ 'Draft anyway' callback executed successfully.");
  }

  console.log("\n---------------------------------------------------------------\n");

  // -----------------------------------------------------------------
  // PATH 3: GENUINE POSTING & TRACKER SAVE CONTROL
  // -----------------------------------------------------------------
  console.log("▶ [TEST 3] Testing Genuine Posting (genuine-1)...");
  global.localStorage.clear();
  const genuinePosting = postings.find(p => p.id === 'genuine-1');
  const logger3 = createLogger();
  const state3 = await runAgent(resumeText, genuinePosting.text, logger3.log);

  const emailStep3 = logger3.entries.find(e => e.type === 'email-card');
  const trackerPrompt = logger3.entries.find(e => e.type === 'tracker-prompt');

  if (emailStep3 && trackerPrompt) {
    console.log("  ✓ Genuine posting completed flow and generated email draft.");
    console.log("  ✓ Tracker prompted: \"" + trackerPrompt.title + "\"");
  } else {
    console.error("  ✗ FAILED: Genuine posting did not reach email draft or tracker prompt.");
    allPassed = false;
  }

  // Verify NOTHING is saved automatically before user clicks Yes
  let savedApps = loadApplications();
  if (savedApps.length === 0) {
    console.log("  ✓ Verified: 0 applications in tracker before user decision (Nothing saved automatically).");
  } else {
    console.error("  ✗ FAILED: Application was saved before user clicked Yes!");
    allPassed = false;
  }

  // Test clicking "No"
  trackerPrompt.onDecline();
  savedApps = loadApplications();
  if (savedApps.length === 0) {
    console.log("  ✓ Verified: Clicking 'No' does NOT save to tracker (0 applications).");
  } else {
    console.error("  ✗ FAILED: Application was saved after user clicked No!");
    allPassed = false;
  }

  // Test clicking "Yes"
  trackerPrompt.onConfirm();
  savedApps = loadApplications();
  if (savedApps.length === 1 && savedApps[0].company === "Apex Cloud Technologies") {
    console.log("  ✓ Verified: Clicking 'Yes' successfully saved application:", savedApps[0].company, "-", savedApps[0].role);
    console.log("  ✓ Status:", savedApps[0].status, "| Risk:", savedApps[0].riskLevel, "| Match:", savedApps[0].matchPercent + "%");
  } else {
    console.error("  ✗ FAILED: Application was not saved properly when clicking Yes!");
    allPassed = false;
  }

  console.log("\n===============================================================");
  if (allPassed) {
    console.log("🎉 ALL TESTS PASSED SUCCESSFULLY!");
  } else {
    console.log("❌ SOME TESTS FAILED. CHECK OUTPUT ABOVE.");
    process.exit(1);
  }
  console.log("===============================================================");
}

testAllPaths();
