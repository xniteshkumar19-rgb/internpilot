const fs = require('fs');
const path = require('path');
const {
  extractSkills,
  analyzeCareerMatch,
  matchSkills,
  scamCheck,
  PARTIAL_MATCH_MAP
} = require('./public/tools.js');

console.log("===============================================================");
console.log("          CAREERMATCH AI ENGINE TEST SUITE (#16)               ");
console.log("===============================================================\n");

let totalTests = 0;
let passedTests = 0;

function assert(condition, message) {
  totalTests++;
  if (condition) {
    console.log(`  ✓ [PASS] ${message}`);
    passedTests++;
  } else {
    console.error(`  ✗ [FAIL] ${message}`);
  }
}

// ==========================================
// TEST 1: RESUME PROFILE DIFFERENTIATION
// ==========================================
console.log("▶ [TEST 1] Testing Resume Extraction on Diverse Student Profiles...");

const frontendResume = `
ROHAN SHARMA
Skills: JavaScript, HTML5, CSS3, React, Git, Communication
Projects: Student Study Tracker web application using vanilla JS and HTML/CSS.
`;

const dataScienceResume = `
PRIYA PATEL
Skills: Python, SQL, Pandas, NumPy, Machine Learning, Data Analysis, Statistics
Projects: Predictive Customer Churn Analysis using Scikit-Learn and Pandas.
`;

const systemsResume = `
ALEX CHEN
Skills: C++, Linux, Docker, Git, Cloud
Projects: Low-latency memory allocator written in modern C++ on Linux.
`;

const feSkills = extractSkills(frontendResume);
const dsSkills = extractSkills(dataScienceResume);
const sysSkills = extractSkills(systemsResume);

assert(feSkills.includes("javascript") && feSkills.includes("react"), "Frontend resume extracts JavaScript & React");
assert(!feSkills.includes("pytorch") && !feSkills.includes("sql"), "Frontend resume does not hallucinate ML or SQL skills");

assert(dsSkills.includes("python") && dsSkills.includes("machine learning") && dsSkills.includes("statistics"), "Data Science resume extracts Python, ML, Statistics");
assert(!dsSkills.includes("react") && !dsSkills.includes("c++"), "Data Science resume does not hallucinate Frontend or C++ skills");

assert(sysSkills.includes("c++") && sysSkills.includes("linux") && sysSkills.includes("docker"), "Systems resume extracts C++, Linux, Docker");
assert(feSkills.join(',') !== dsSkills.join(','), "Different resumes produce distinct skill profiles");

console.log("\n---------------------------------------------------------------\n");

// ==========================================
// TEST 2: TRI-STATE MATCHING (MATCHED, PARTIAL, MISSING)
// ==========================================
console.log("▶ [TEST 2] Testing Tri-State Competency Matching & Foundation Identification...");

// Job requires: JavaScript, TypeScript, React, HTML, CSS, Next.js, Docker
const frontendJob = `
We are looking for a Web Developer Intern.
Required Skills: JavaScript, TypeScript, React, HTML, CSS
Preferred Skills: Next.js, Docker
`;

// Candidate has: JavaScript, HTML, CSS, React, Git (Frontend Resume)
// Expected:
// Matched: javascript, html, css, react
// Partial: typescript (foundation: javascript), next.js (foundation: react)
// Missing: docker

const cmResultFE = analyzeCareerMatch(frontendResume, frontendJob, {
  role: "Web Developer Intern",
  requiredSkills: ["JavaScript", "TypeScript", "React", "HTML", "CSS"],
  preferredSkills: ["Next.js", "Docker"]
});

const matchedNamesFE = cmResultFE.matched.map(s => s.name);
const partialNamesFE = cmResultFE.partial.map(s => s.name);
const missingNamesFE = cmResultFE.missing.map(s => s.name);

assert(matchedNamesFE.includes("javascript") && matchedNamesFE.includes("react") && matchedNamesFE.includes("html") && matchedNamesFE.includes("css"), "Direct matches identified correctly (JS, React, HTML, CSS)");
assert(partialNamesFE.includes("typescript"), "TypeScript correctly identified as Partial Match (Candidate knows JavaScript)");
assert(partialNamesFE.includes("next.js"), "Next.js correctly identified as Partial Match (Candidate knows React)");
assert(missingNamesFE.includes("docker"), "Docker correctly identified as Missing Gap (Candidate lacks Linux/Docker)");

const tsPartial = cmResultFE.partial.find(s => s.name === "typescript");
assert(tsPartial && tsPartial.foundationSkill === "javascript", "TypeScript partial match points to foundationSkill: 'javascript'");
assert(tsPartial && tsPartial.credit === 0.5, "Partial match awards 0.5 credit");

console.log("\n---------------------------------------------------------------\n");

// ==========================================
// TEST 3: EXPLAINABLE WEIGHTED SCORE CALCULATION
// ==========================================
console.log("▶ [TEST 3] Testing Explainable Match Score Calculation...");

// Required skills (weight = 2.0 each):
// JS (matched: 2.0), React (matched: 2.0), HTML (matched: 2.0), CSS (matched: 2.0), TypeScript (partial: 0.5 * 2.0 = 1.0)
// Required earned: 2+2+2+2+1 = 9.0 out of 10.0
// Preferred skills (weight = 1.0 each):
// Next.js (partial: 0.5 * 1.0 = 0.5), Docker (missing: 0.0)
// Preferred earned: 0.5 out of 2.0
// Total earned: 9.5 / 12.0 = 79.16% -> round to 79%

assert(cmResultFE.percent === 79, `Calculated weighted score is 79% (Got: ${cmResultFE.percent}%)`);
assert(cmResultFE.level === "good", `Level classified as 'good' (Score: ${cmResultFE.percent}%)`);
assert(cmResultFE.scoreBreakdown.includes("Explainable Match:"), "Provides clear explainable score breakdown sentence");

console.log("\n---------------------------------------------------------------\n");

// ==========================================
// TEST 4: PERSONALIZED LEARNING ROADMAP
// ==========================================
console.log("▶ [TEST 4] Testing Personalized Learning Roadmap Generation...");

assert(Array.isArray(cmResultFE.roadmap) && cmResultFE.roadmap.length >= 2, "Generates roadmap items for missing and partial skills");

const tsRoadmap = cmResultFE.roadmap.find(r => r.skill === "typescript");
assert(tsRoadmap !== undefined, "Roadmap contains TypeScript milestone");
assert(tsRoadmap && tsRoadmap.foundationNote && tsRoadmap.foundationNote.includes("JAVASCRIPT"), "TypeScript roadmap highlights candidate's JavaScript background");
assert(tsRoadmap && Array.isArray(tsRoadmap.topics) && tsRoadmap.topics.length > 0, "TypeScript roadmap includes structured key topics");
assert(tsRoadmap && Array.isArray(tsRoadmap.practicalActivities) && tsRoadmap.practicalActivities.length > 0, "TypeScript roadmap includes actionable student activities");
assert(tsRoadmap && tsRoadmap.estimatedHours.length > 0, "TypeScript roadmap includes estimated study hours");

const dockerRoadmap = cmResultFE.roadmap.find(r => r.skill === "docker");
assert(dockerRoadmap !== undefined, "Roadmap contains Docker milestone for missing skill");
assert(dockerRoadmap && dockerRoadmap.importance.includes("Preferred"), "Docker correctly categorized as Preferred importance in roadmap");

console.log("\n---------------------------------------------------------------\n");

// ==========================================
// TEST 5: PRACTICAL STUDENT PROJECT RECOMMENDATIONS
// ==========================================
console.log("▶ [TEST 5] Testing Practical Portfolio Project Recommendations...");

assert(Array.isArray(cmResultFE.projects) && cmResultFE.projects.length >= 2, "Recommends at least 2 practical student projects");

const webProject = cmResultFE.projects.find(p => p.skillsCovered.includes("React") || p.skillsCovered.includes("TypeScript"));
assert(webProject !== undefined, "Project recommendation matches the Web/Frontend domain");
assert(webProject && webProject.deliverable && webProject.deliverable.includes("GitHub"), "Project specifies tangible deliverable (e.g. GitHub repo)");
assert(webProject && webProject.relevance && webProject.relevance.length > 10, "Project explains why it is relevant to the selected job");

console.log("\n---------------------------------------------------------------\n");

// ==========================================
// TEST 6: BACKWARD-COMPATIBILITY FOR EXISTING FLOWS
// ==========================================
console.log("▶ [TEST 6] Testing Backward-Compatibility for Existing Tools & Tests...");

const legacyResult = matchSkills(frontendResume, frontendJob, ["JavaScript", "TypeScript", "React"]);
assert(typeof legacyResult.percent === "number", "matchSkills returns numerical percent");
assert(Array.isArray(legacyResult.matched), "matchSkills returns matched array of strings");
assert(Array.isArray(legacyResult.missing), "matchSkills returns missing array of strings");
assert(legacyResult.careerMatch !== undefined, "matchSkills attaches full careerMatch object");

// Scam check verification
const scamPosting = "Urgent! Pay registration fee of Rs 500 to secure direct selection on WhatsApp only.";
const scamRes = scamCheck(scamPosting);
assert(scamRes.level === "high" && scamRes.riskScore >= 60, "Scam check continues to identify scams with high risk score");

console.log("\n===============================================================");
console.log(`TOTAL: ${totalTests} | PASSED: ${passedTests} | FAILED: ${totalTests - passedTests}`);
console.log("===============================================================");

if (passedTests === totalTests) {
  console.log("🎉 ALL CAREERMATCH AI TESTS PASSED 100%!");
  process.exit(0);
} else {
  console.error("❌ SOME TESTS FAILED.");
  process.exit(1);
}
