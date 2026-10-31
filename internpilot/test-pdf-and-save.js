/**
 * Automated Test Suite for Feature 1 (PDF Generation) and Feature 2 (Save & Resume Progress)
 */

const assert = require('assert');
const { PDFParse } = require('./node_modules/pdf-parse');
const {
  saveCareerAnalysis,
  loadSavedAnalyses,
  deleteSavedAnalysis,
  getSavedAnalysis,
  calculateRoadmapProgress,
  loadApplications,
  saveApplication,
  SAVED_ANALYSES_STORAGE_KEY
} = require('./public/tools.js');

const {
  PdfDocument,
  buildCareerMatchPdf,
  downloadCareerMatchPdf
} = require('./public/pdf-generator.js');

let passCount = 0;
let failCount = 0;

function check(desc, fn) {
  try {
    fn();
    console.log(`  ✓ [PASS] ${desc}`);
    passCount++;
  } catch (err) {
    console.error(`  ✕ [FAIL] ${desc}`);
    console.error(`    Error: ${err.message}`);
    failCount++;
  }
}

async function checkAsync(desc, fn) {
  try {
    await fn();
    console.log(`  ✓ [PASS] ${desc}`);
    passCount++;
  } catch (err) {
    console.error(`  ✕ [FAIL] ${desc}`);
    console.error(`    Error: ${err.message}`);
    failCount++;
  }
}

// In-Memory mock for localStorage
class LocalStorageMock {
  constructor() {
    this.store = {};
  }
  getItem(key) {
    return this.store[key] !== undefined ? this.store[key] : null;
  }
  setItem(key, value) {
    this.store[key] = String(value);
  }
  removeItem(key) {
    delete this.store[key];
  }
  clear() {
    this.store = {};
  }
}

global.localStorage = new LocalStorageMock();

async function runAllTests() {
  console.log("======================================================================");
  console.log("   CAREERMATCH PDF EXPORT & PROGRESS PERSISTENCE TEST SUITE           ");
  console.log("======================================================================\n");

  const sampleAnalysis = {
    id: "test_analysis_101",
    savedAt: "2026-10-31T10:00:00.000Z",
    role: "DevOps & Cloud Engineer Intern",
    company: "CloudScale Inc",
    percent: 90,
    level: "good",
    scoreBreakdown: "4 required + 1 preferred matched (5.0 pts), 1 partial (0.5 pts) = 5.5 / 6.0 = 90%",
    matched: [
      { name: "Docker", importance: "required", reason: "Demonstrated in candidate resume container projects." },
      { name: "Python", importance: "required", reason: "Evidenced in automated scripting repo." },
      { name: "Linux", importance: "required", reason: "Found in system administration coursework." }
    ],
    partial: [
      {
        name: "Kubernetes",
        importance: "required",
        foundationSkill: "Docker",
        foundationEvidence: "Candidate's experience in Docker containerization accelerates orchestration.",
        reason: "Microservice cluster deployment."
      }
    ],
    missing: [
      { name: "Terraform", importance: "preferred", reason: "Infrastructure as Code automation." }
    ],
    requiredSkills: ["Docker", "Python", "Linux", "Kubernetes"],
    preferredSkills: ["Terraform"],
    responsibilities: [
      "Maintain Docker containers in staging and production.",
      "Automate deployment pipelines using GitHub Actions.",
      "Monitor system uptime with Prometheus."
    ],
    qualifications: [
      "Currently pursuing BS in Computer Science or Software Engineering.",
      "Working knowledge of Unix/Linux operating environments."
    ],
    roadmap: [
      {
        skill: "Terraform",
        importance: "Medium (Preferred)",
        estimatedHours: "10-14 hours (1-2 weeks)",
        whyItMatters: "Standard declarative IaC provisioning tool in modern cloud shops.",
        topics: ["HCL configuration syntax", "Provider modules", "Remote state locking"],
        practicalActivities: [
          "Install Terraform CLI and configure AWS provider locally.",
          "Write HCL manifest to provision a test VPC.",
          "Push documented Terraform repo to GitHub."
        ]
      }
    ],
    projects: [
      {
        title: "Automated Multi-Tier Cloud Infrastructure",
        difficulty: "Intermediate",
        description: "Deploy scalable containerized service using declarative infrastructure.",
        skillsCovered: ["Docker", "Terraform", "Linux"],
        deliverable: "GitHub repo with modular HCL and CI validation.",
        relevance: "Proves candidate can manage cloud resources without manual portal clicks."
      }
    ],
    scamAssessment: {
      riskScore: 0,
      level: "low",
      reasons: []
    },
    activityProgress: {
      "cm_act_Terraform_0": "done",
      "cm_act_Terraform_1": "done"
    }
  };

  // ------------------------------------------------------------------
  // PART 1: PDF GENERATION TESTS
  // ------------------------------------------------------------------
  console.log("▶ [TEST GROUP 1] PDF Generator Compliance & Structure (15 Sections)...");

  let pdfBuffer;
  check("buildCareerMatchPdf generates valid PDF Buffer", () => {
    pdfBuffer = buildCareerMatchPdf(sampleAnalysis);
    assert(Buffer.isBuffer(pdfBuffer) || pdfBuffer instanceof Uint8Array, "Must return a buffer or Uint8Array");
    assert(pdfBuffer.length > 2000, "PDF must be substantive in size (> 2KB)");
  });

  check("PDF begins with valid %PDF-1.4 header", () => {
    const head = pdfBuffer.slice(0, 15).toString('ascii');
    assert(head.startsWith("%PDF-1.4"), `Expected %PDF-1.4 header, got: ${head}`);
  });

  check("PDF ends with valid %%EOF trailer and xref", () => {
    const tail = pdfBuffer.slice(pdfBuffer.length - 120).toString('ascii');
    assert(tail.includes("startxref"), "Must contain startxref");
    assert(tail.includes("%%EOF"), "Must contain %%EOF");
  });

  let parsedPdf;
  await checkAsync("PDF parses cleanly with pdf-parse without syntax errors", async () => {
    const parser = new PDFParse({ data: pdfBuffer });
    parsedPdf = await parser.getText();
    assert(parsedPdf && parsedPdf.text, "Must extract non-empty text");
  });

  check("PDF contains Section 1: InternPilot Branding & Title", () => {
    assert(parsedPdf.text.includes("PILOT AI"), "Must contain brand badge PILOT AI");
    assert(parsedPdf.text.includes("InternPilot"), "Must contain InternPilot");
    assert(parsedPdf.text.includes("SKILL GAP ANALYSIS REPORT"), "Must contain report title");
  });

  check("PDF contains Section 2: Generation Date & Timestamp", () => {
    assert(parsedPdf.text.includes("Generated on:"), "Must contain generation date label");
    assert(parsedPdf.text.includes("2026"), "Must contain year 2026");
  });

  check("PDF contains Section 3: Target Role & Company", () => {
    assert(parsedPdf.text.includes("DevOps & Cloud Engineer Intern"), "Must include role");
    assert(parsedPdf.text.includes("CloudScale Inc"), "Must include company");
  });

  check("PDF contains Section 4: Overall Match Percentage & Level", () => {
    assert(parsedPdf.text.includes("90% MATCH"), "Must include 90% MATCH");
    assert(parsedPdf.text.includes("Level: GOOD"), "Must include Level: GOOD");
  });

  check("PDF contains Section 5: Explainable Formula Breakdown", () => {
    assert(parsedPdf.text.includes("Explainable Calculation Methodology:"), "Must include formula section");
    assert(parsedPdf.text.includes("5.5 / 6.0 = 90%"), "Must include exact score breakdown");
  });

  check("PDF contains Section 6: Matched Competencies Table", () => {
    assert(parsedPdf.text.includes("Matched Competencies (3)"), "Must state matched count");
    assert(parsedPdf.text.includes("Docker"), "Must include Docker");
    assert(parsedPdf.text.includes("Python"), "Must include Python");
    assert(parsedPdf.text.includes("Linux"), "Must include Linux");
  });

  check("PDF contains Section 7: Partial Match with Concrete Resume Evidence", () => {
    assert(parsedPdf.text.includes("Partially Matched Skills (1)"), "Must state partial count");
    assert(parsedPdf.text.includes("Kubernetes"), "Must include Kubernetes");
    assert(parsedPdf.text.includes("Candidate's experience in Docker containerization"), "Must include concrete evidence quote");
  });

  check("PDF contains Section 8: Missing Skill Gaps & Why Needed", () => {
    assert(parsedPdf.text.includes("Missing Skill Gaps (1)"), "Must state gap count");
    assert(parsedPdf.text.includes("Terraform"), "Must include Terraform");
    assert(parsedPdf.text.includes("Infrastructure as Code automation"), "Must explain why needed");
  });

  check("PDF contains Section 9: Required vs Preferred Skill Classification", () => {
    assert(parsedPdf.text.includes("[REQUIRED] Core Role Prerequisites"), "Must include required skills title");
    assert(parsedPdf.text.includes("[PREFERRED] Advantageous Extras"), "Must include preferred skills title");
  });

  check("PDF contains Section 10: Responsibilities & Qualifications", () => {
    assert(parsedPdf.text.includes("Key Role Responsibilities:"), "Must include responsibilities heading");
    assert(parsedPdf.text.includes("Maintain Docker containers in staging"), "Must include extracted responsibility");
    assert(parsedPdf.text.includes("Prerequisite Qualifications:"), "Must include qualifications heading");
    assert(parsedPdf.text.includes("BS in Computer Science"), "Must include extracted qualification");
  });

  check("PDF contains Section 11: Personalized Learning Roadmap", () => {
    assert(parsedPdf.text.includes("Personalized Learning Roadmap"), "Must include roadmap heading");
    assert(parsedPdf.text.includes("STEP 1: TERRAFORM"), "Must include Terraform step");
    assert(parsedPdf.text.includes("10-14 hours"), "Must include estimated hours");
    assert(parsedPdf.text.includes("HCL configuration syntax"), "Must include key topics");
  });

  check("PDF contains Section 12: Live Milestone Verification Status", () => {
    assert(parsedPdf.text.includes("[COMPLETED] Install Terraform CLI"), "Must record activity 1 as COMPLETED");
    assert(parsedPdf.text.includes("[COMPLETED] Write HCL manifest"), "Must record activity 2 as COMPLETED");
    assert(parsedPdf.text.includes("[PENDING] Push documented Terraform repo"), "Must record activity 3 as PENDING");
  });

  check("PDF contains Section 13: Recommended Practical Portfolio Projects", () => {
    assert(parsedPdf.text.includes("Recommended Practical Student Portfolio Projects"), "Must include projects heading");
    assert(parsedPdf.text.includes("Automated Multi-Tier Cloud Infrastructure"), "Must include project title");
    assert(parsedPdf.text.includes("Deliverable:"), "Must include project deliverable");
  });

  check("PDF contains Section 14: Comprehensive Verification Disclaimer", () => {
    assert(parsedPdf.text.includes("LEGAL & ACCURACY DISCLAIMER"), "Must include legal disclaimer title");
    assert(parsedPdf.text.includes("InternPilot provides heuristic warning signs") || parsedPdf.text.includes("internship guidance"), "Must include verification warning");
  });

  // ------------------------------------------------------------------
  // PART 2: SAVE & RESUME PROGRESS STORAGE TESTS
  // ------------------------------------------------------------------
  console.log("\n▶ [TEST GROUP 2] Save and Resume Progress Persistence...");

  global.localStorage.clear();

  check("loadSavedAnalyses returns empty array on empty storage", () => {
    const list = loadSavedAnalyses();
    assert(Array.isArray(list), "Must be an array");
    assert.strictEqual(list.length, 0, "Initial list must be empty");
  });

  let savedRecord1;
  check("saveCareerAnalysis saves full state to internpilot_saved_analyses", () => {
    savedRecord1 = saveCareerAnalysis(sampleAnalysis);
    assert(savedRecord1, "Must return saved record");
    assert.strictEqual(savedRecord1.role, "DevOps & Cloud Engineer Intern");
    assert.strictEqual(savedRecord1.percent, 90);
    assert.strictEqual(savedRecord1.activityProgress["cm_act_Terraform_0"], "done");

    const raw = global.localStorage.getItem(SAVED_ANALYSES_STORAGE_KEY);
    assert(raw, "Storage must contain saved item");
    const parsed = JSON.parse(raw);
    assert.strictEqual(parsed.length, 1);
    assert.strictEqual(parsed[0].id, savedRecord1.id);
  });

  check("Saved analyses do NOT overwrite or pollute internpilot_apps (tracker isolation)", () => {
    const apps = loadApplications();
    assert(Array.isArray(apps), "Must be array");
    assert.strictEqual(apps.length, 0, "internpilot_apps must remain 0 items");

    // Add a tracker app and verify it stays isolated
    saveApplication({ company: "TestCorp", role: "Junior Dev" });
    assert.strictEqual(loadApplications().length, 1, "Tracker must have 1 app");
    assert.strictEqual(loadSavedAnalyses().length, 1, "Saved analyses must remain 1 item");
  });

  check("calculateRoadmapProgress computes exact milestones and percentage", () => {
    const prog = calculateRoadmapProgress(savedRecord1);
    assert.strictEqual(prog.total, 3, "Total activities in roadmap must be 3");
    assert.strictEqual(prog.completed, 2, "Completed activities must be 2");
    assert.strictEqual(prog.percent, 67, "Percent must be 67% (2 / 3)");
  });

  let savedRecord2;
  check("Multi-analysis persistence: can save second analysis for different role", () => {
    const analysis2 = {
      id: "test_analysis_202",
      role: "Frontend Engineer Intern",
      company: "WebStudio Labs",
      percent: 79,
      level: "good",
      matched: [{ name: "React" }],
      partial: [{ name: "TypeScript" }],
      missing: [{ name: "Docker" }],
      roadmap: [
        {
          skill: "Docker",
          practicalActivities: ["Install Docker Desktop", "Build React container"]
        }
      ],
      activityProgress: {
        "cm_act_Docker_0": "done"
      }
    };

    savedRecord2 = saveCareerAnalysis(analysis2);
    const list = loadSavedAnalyses();
    assert.strictEqual(list.length, 2, "Must contain both saved analyses");
    assert.strictEqual(list[0].id, "test_analysis_202");
    assert.strictEqual(list[1].id, "test_analysis_101");
  });

  check("getSavedAnalysis retrieves specific record by ID", () => {
    const found = getSavedAnalysis("test_analysis_101");
    assert(found, "Must find record");
    assert.strictEqual(found.role, "DevOps & Cloud Engineer Intern");
  });

  check("deleteSavedAnalysis removes target analysis cleanly", () => {
    const ok = deleteSavedAnalysis("test_analysis_202");
    assert.strictEqual(ok, true, "Must return true on delete");

    const list = loadSavedAnalyses();
    assert.strictEqual(list.length, 1, "Must only have 1 item left");
    assert.strictEqual(list[0].id, "test_analysis_101");
  });

  check("Graceful handling of corrupted localStorage in loadSavedAnalyses", () => {
    global.localStorage.setItem(SAVED_ANALYSES_STORAGE_KEY, "{ invalid json corrupt");
    const safeList = loadSavedAnalyses();
    assert(Array.isArray(safeList), "Must return empty array on corrupted JSON");
    assert.strictEqual(safeList.length, 0);
  });

  // ------------------------------------------------------------------
  // SUMMARY
  // ------------------------------------------------------------------
  console.log("\n======================================================================");
  console.log(`TOTAL TESTS: ${passCount + failCount} | PASSED: ${passCount} | FAILED: ${failCount}`);
  console.log("======================================================================");

  if (failCount > 0) {
    process.exit(1);
  } else {
    console.log("🎉 ALL PDF GENERATION & SAVED PROGRESS TESTS PASSED 100%!\n");
  }
}

runAllTests().catch(err => {
  console.error("Fatal test runner error:", err);
  process.exit(1);
});
