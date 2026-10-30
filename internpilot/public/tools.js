// ==========================================
// SCAM CHECK RULES & WEIGHTS
// (Editable rules array at the top of the file)
// ==========================================
const SCAM_RULES = [
  {
    rule: "Asks for money",
    points: 40,
    patterns: [
      /\bregistration fees?\b/i,
      /\bsecurity deposits?\b/i,
      /\btraining fees?\b/i,
      /\bkit charges?\b/i,
      /\bprocessing fees?\b/i,
      /\b(?:must|required to|have to|need to|asked to|candidates? must|applicants? must|you must)\s+pay\b/i,
      /\bpay\s+(?:an?\s+)?(?:upfront|in\s+advance)\b/i,
      /\bpay\s+(?:an?\s+|the\s+|any\s+|some\s+)?(?:[\w-]+\s+)?(?:fee|fees|deposit|charges?)\b/i,
      /\bpay\s+(?:(?:₹|rs\.?|inr|\$)\s*[\d,]+\s+)?to\s+(?:secure|confirm|reserve|apply|register|join|enroll|book)\b/i
    ]
  },
  {
    rule: "Asks for Aadhaar, PAN, or bank details before selection",
    points: 25,
    patterns: [
      /\baadhaar\b/i,
      /\bpan card\b/i,
      /\bpan number\b/i,
      /\bpan details\b/i,
      /\bbank details\b/i,
      /\bbank account\b/i,
      /\baccount details\b/i
    ]
  },
  {
    rule: "Contact email uses a free domain",
    points: 20,
    patterns: [
      /[a-zA-Z0-9._%+-]+@(gmail\.com|yahoo\.com|outlook\.com|hotmail\.com)\b/i
    ]
  },
  {
    rule: "Contact only on WhatsApp or Telegram",
    points: 15,
    patterns: [
      /\bwhatsapp only\b/i,
      /\btelegram only\b/i,
      /\bcontact on whatsapp\b/i,
      /\bcontact on telegram\b/i,
      /\bmessage on whatsapp\b/i,
      /\breach out on telegram\b/i,
      /\bping on whatsapp\b/i,
      /\bping on telegram\b/i,
      /\bdm on whatsapp\b/i,
      /\bdm on telegram\b/i
    ]
  },
  {
    rule: "Guaranteed job, placement, or stipend claims",
    points: 15,
    patterns: [
      /\b100% placement\b/i,
      /\bguaranteed placement\b/i,
      /\bguaranteed job\b/i,
      /\bguaranteed stipend\b/i,
      /\bguaranteed\b/i
    ]
  },
  {
    rule: "Heavy urgency",
    points: 10,
    patterns: [
      /\blimited seats\b/i,
      /\bapply today\b/i,
      /\blast chance\b/i
    ]
  },
  {
    rule: "Direct selection with no interview or assessment",
    points: 10,
    patterns: [
      /\bdirect selection\b/i,
      /\bno interview\b/i,
      /\bno assessment\b/i,
      /\bdirect joining\b/i
    ]
  },
  {
    rule: "No company name or a very vague one",
    points: 10,
    patterns: [
      /\ba reputed mnc\b/i,
      /\breputed company\b/i,
      /\bleading mnc\b/i,
      /\bconfidential company\b/i
    ]
  }
];

// ==========================================
// WEEKLY ACTIVITY SCORING RULES
// (Editable rules array at the top of the file)
// ==========================================
const ACTIVITY_RULES = [
  {
    id: "sent",
    label: "Applications sent this week",
    pointsPerItem: 15,
    maxPoints: 45
  },
  {
    id: "saved",
    label: "Applications saved this week",
    pointsPerItem: 5,
    maxPoints: 15
  },
  {
    id: "progress",
    label: "Progress this week",
    pointsPerItem: 10,
    maxPoints: 20
  },
  {
    id: "discipline",
    label: "Deadline discipline",
    startingPoints: 20,
    deductionPerItem: 10,
    minPoints: 0
  }
];

// ==========================================
// SKILLS & ALIASES LIST
// (~60 common internship skills)
// ==========================================
const SKILLS = [
  "python", "java", "javascript", "typescript", "c++", "c#",
  "html", "css", "react", "node.js", "express", "sql", "mysql",
  "mongodb", "git", "github", "machine learning", "deep learning",
  "data analysis", "pandas", "numpy", "excel", "power bi", "tableau",
  "figma", "ui/ux", "flutter", "android", "django", "flask",
  "docker", "linux", "cloud", "aws", "communication", "content writing",
  "seo", "digital marketing", "postgresql", "redis", "tailwind",
  "bootstrap", "next.js", "vue", "angular", "swift", "kotlin",
  "go", "rust", "php", "spring", "spring boot", "fastapi",
  "tensorflow", "pytorch", "scikit-learn", "kubernetes", "azure",
  "gcp", "statistics"
];

const ALIASES = {
  "js": "javascript",
  "ts": "typescript",
  "node": "node.js",
  "nodejs": "node.js",
  "py": "python",
  "reactjs": "react",
  "react.js": "react",
  "vuejs": "vue",
  "nextjs": "next.js",
  "ms excel": "excel",
  "powerbi": "power bi",
  "ml": "machine learning",
  "dl": "deep learning",
  "postgres": "postgresql",
  "golang": "go",
  "ui ux": "ui/ux",
  "ui": "ui/ux",
  "ux": "ui/ux",
  "k8s": "kubernetes",
  "stats": "statistics"
};

// ==========================================
// 1. SCAM CHECKER
// ==========================================
function scamCheck(postingText) {
  if (!postingText || typeof postingText !== "string") {
    return { riskScore: 0, level: "low", reasons: [] };
  }

  let totalPoints = 0;
  const reasons = [];

  for (const ruleItem of SCAM_RULES) {
    let matchedEvidence = null;

    for (const pattern of ruleItem.patterns) {
      const match = postingText.match(pattern);
      if (match) {
        matchedEvidence = match[0];
        break; // Match first pattern for this rule
      }
    }

    if (matchedEvidence) {
      totalPoints += ruleItem.points;
      reasons.push({
        rule: ruleItem.rule,
        points: ruleItem.points,
        evidence: matchedEvidence
      });
    }
  }

  const riskScore = Math.min(totalPoints, 100);
  let level = "low";
  if (riskScore >= 60) {
    level = "high";
  } else if (riskScore >= 30) {
    level = "medium";
  }

  return {
    riskScore,
    level,
    reasons
  };
}

// ==========================================
// 2. SKILL EXTRACTOR
// ==========================================
function extractSkills(text) {
  if (!text || typeof text !== "string") {
    return [];
  }

  const foundSkills = new Set();
  const lowerText = text.toLowerCase();

  function hasToken(token) {
    if (token === "c++") {
      const re = /(?<![\w#+])c\+\+(?![\w#+])/i;
      return re.test(lowerText);
    }
    if (token === "c#") {
      const re = /(?<![\w#+])c#(?![\w#+])/i;
      return re.test(lowerText);
    }
    if (token === "ui/ux") {
      const re = /(?<!\w)ui\/ux(?!\w)/i;
      return re.test(lowerText);
    }
    if (token === "node.js") {
      const re = /(?<!\w)node\.js(?!\w)/i;
      return re.test(lowerText);
    }
    if (token === "next.js") {
      const re = /(?<!\w)next\.js(?!\w)/i;
      return re.test(lowerText);
    }

    const escaped = token.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");
    const re = new RegExp(`(?<![\\w-])${escaped}(?![\\w-])`, "i");
    return re.test(lowerText);
  }

  const multiWordSkills = SKILLS.filter(s => s.includes(" ") || s.includes("/") || s.includes("."));
  for (const skill of multiWordSkills) {
    if (hasToken(skill)) {
      foundSkills.add(skill);
    }
  }

  for (const [alias, canonical] of Object.entries(ALIASES)) {
    if (hasToken(alias)) {
      foundSkills.add(canonical);
    }
  }

  const singleWordSkills = SKILLS.filter(s => !multiWordSkills.includes(s));
  for (const skill of singleWordSkills) {
    if (skill.length <= 1) continue;
    if (hasToken(skill)) {
      foundSkills.add(skill);
    }
  }

  return Array.from(foundSkills);
}

// ==========================================
// 3. SKILL MATCHER
// ==========================================
function matchSkills(resumeText, postingText, postingSkills = null) {
  const resumeSkills = extractSkills(resumeText);

  let requiredSkills = [];
  if (Array.isArray(postingSkills) && postingSkills.length > 0) {
    const normalizedAI = [];
    for (const s of postingSkills) {
      if (typeof s === "string") {
        const cleaned = s.trim().toLowerCase();
        const mapped = ALIASES[cleaned] || cleaned;
        if (mapped.length > 1) {
          normalizedAI.push(mapped);
        }
      }
    }
    const extracted = extractSkills(postingText);
    requiredSkills = Array.from(new Set([...normalizedAI, ...extracted]));
  } else {
    requiredSkills = extractSkills(postingText);
  }

  if (requiredSkills.length === 0) {
    return {
      percent: null,
      matched: [],
      missing: [],
      level: "very low",
      note: "No recognizable skills found in the job posting."
    };
  }

  const matched = requiredSkills.filter(skill => resumeSkills.includes(skill));
  const missing = requiredSkills.filter(skill => !resumeSkills.includes(skill));
  const percent = Math.round((matched.length / requiredSkills.length) * 100);

  let level = "very low";
  if (percent >= 60) {
    level = "good";
  } else if (percent >= 30) {
    level = "low";
  }

  return {
    percent,
    matched,
    missing,
    level,
    note: ""
  };
}

// ==========================================
// 4. WEEKLY ACTIVITY SCORE CALCULATOR
// ==========================================
function computeActivity(applications, now = new Date()) {
  const appList = Array.isArray(applications) ? applications : [];
  const nowTime = now instanceof Date ? now.getTime() : new Date(now).getTime();
  const MS_PER_DAY = 86400000;

  // Start-inclusive, end-exclusive time windows: [start, end)
  const thisWeekStart = nowTime - 7 * MS_PER_DAY;
  const lastWeekStart = nowTime - 14 * MS_PER_DAY;

  function parseTime(val) {
    if (!val) return null;
    const t = new Date(val).getTime();
    return isNaN(t) ? null : t;
  }

  let sentThisWeek = 0;
  let savedThisWeek = 0;
  let progressThisWeek = 0;
  let sentLastWeek = 0;
  let overdueSaved = 0;

  // 4-week counts for visual trend bar chart
  // Week 3 (3w ago), Week 2 (2w ago), Week 1 (last week), Week 0 (this week)
  const fourWeeks = [0, 0, 0, 0];

  for (const app of appList) {
    // 1. Sent count (based on appliedAt)
    const appliedTime = parseTime(app.appliedAt);
    if (appliedTime !== null) {
      if (appliedTime >= thisWeekStart && appliedTime < nowTime) {
        sentThisWeek++;
        fourWeeks[3]++;
      } else if (appliedTime >= lastWeekStart && appliedTime < thisWeekStart) {
        sentLastWeek++;
        fourWeeks[2]++;
      } else if (appliedTime >= nowTime - 21 * MS_PER_DAY && appliedTime < lastWeekStart) {
        fourWeeks[1]++;
      } else if (appliedTime >= nowTime - 28 * MS_PER_DAY && appliedTime < nowTime - 21 * MS_PER_DAY) {
        fourWeeks[0]++;
      }
    }

    // 2. Saved count (based on createdAt)
    const createdTime = parseTime(app.createdAt);
    if (createdTime !== null && createdTime >= thisWeekStart && createdTime < nowTime) {
      savedThisWeek++;
    }

    // 3. Progress this week (Interview or Offer updated this week)
    const updatedTime = parseTime(app.updatedAt);
    if ((app.status === "Interview" || app.status === "Offer") && updatedTime !== null) {
      if (updatedTime >= thisWeekStart && updatedTime < nowTime) {
        progressThisWeek++;
      }
    }

    // 4. Overdue saved applications
    const deadlineTime = parseTime(app.deadline);
    if (app.status === "Saved" && deadlineTime !== null && deadlineTime < nowTime) {
      overdueSaved++;
    }
  }

  // Scoring with caps based on ACTIVITY_RULES
  const sentRule = ACTIVITY_RULES.find(r => r.id === "sent") || { pointsPerItem: 15, maxPoints: 45 };
  const savedRule = ACTIVITY_RULES.find(r => r.id === "saved") || { pointsPerItem: 5, maxPoints: 15 };
  const progressRule = ACTIVITY_RULES.find(r => r.id === "progress") || { pointsPerItem: 10, maxPoints: 20 };
  const disciplineRule = ACTIVITY_RULES.find(r => r.id === "discipline") || { startingPoints: 20, deductionPerItem: 10, minPoints: 0 };

  const sentPoints = Math.min(sentThisWeek * sentRule.pointsPerItem, sentRule.maxPoints);
  const savedPoints = Math.min(savedThisWeek * savedRule.pointsPerItem, savedRule.maxPoints);
  const progressPoints = Math.min(progressThisWeek * progressRule.pointsPerItem, progressRule.maxPoints);
  const disciplinePoints = Math.max(disciplineRule.startingPoints - (overdueSaved * disciplineRule.deductionPerItem), disciplineRule.minPoints);

  const rawScore = sentPoints + savedPoints + progressPoints + disciplinePoints;
  const score = Math.max(0, Math.min(rawScore, 100));

  let level = "Getting started";
  if (score >= 80) {
    level = "Very active";
  } else if (score >= 60) {
    level = "Active";
  } else if (score >= 30) {
    level = "Building momentum";
  }

  // Prioritized Next Action Sentence
  let nextAction = "";
  if (overdueSaved > 0) {
    nextAction = `You have ${overdueSaved} saved application${overdueSaved > 1 ? "s" : ""} past their deadline. Apply or remove them.`;
  } else if (sentThisWeek < 3) {
    const remaining = 3 - sentThisWeek;
    nextAction = `Send ${remaining} more application${remaining > 1 ? "s" : ""} this week to reach full points.`;
  } else {
    nextAction = "Great week. Keep your tracker updated.";
  }

  const breakdown = [
    {
      label: sentRule.label,
      points: sentPoints,
      max: sentRule.maxPoints,
      detail: `${sentThisWeek} sent (${sentThisWeek} × ${sentRule.pointsPerItem} pts, max ${sentRule.maxPoints})`
    },
    {
      label: savedRule.label,
      points: savedPoints,
      max: savedRule.maxPoints,
      detail: `${savedThisWeek} saved (${savedThisWeek} × ${savedRule.pointsPerItem} pts, max ${savedRule.maxPoints})`
    },
    {
      label: progressRule.label,
      points: progressPoints,
      max: progressRule.maxPoints,
      detail: `${progressThisWeek} progressed (${progressThisWeek} × ${progressRule.pointsPerItem} pts, max ${progressRule.maxPoints})`
    },
    {
      label: disciplineRule.label,
      points: disciplinePoints,
      max: disciplineRule.startingPoints,
      detail: overdueSaved > 0 
        ? `${disciplineRule.startingPoints} - ${overdueSaved * disciplineRule.deductionPerItem} pts (${overdueSaved} overdue saved)`
        : "Full points (0 overdue saved)"
    }
  ];

  return {
    score,
    level,
    breakdown,
    thisWeek: {
      sent: sentThisWeek,
      saved: savedThisWeek,
      progressed: progressThisWeek
    },
    lastWeek: {
      sent: sentLastWeek
    },
    overdueSaved,
    fourWeeksTrend: fourWeeks, // [3w ago, 2w ago, last week, this week]
    nextAction
  };
}

// ==========================================
// 5. STORAGE HELPERS (localStorage)
// ==========================================
function loadApplications() {
  try {
    if (typeof localStorage === "undefined") return [];
    const data = localStorage.getItem("internpilot_apps");
    return data ? JSON.parse(data) : [];
  } catch (err) {
    console.error("Error loading applications from localStorage:", err);
    return [];
  }
}

function saveApplication(app) {
  try {
    if (typeof localStorage === "undefined") return null;
    const current = loadApplications();
    const newApp = {
      id: "app_" + Date.now(),
      company: app.company || "Unknown Company",
      role: app.role || "Internship Role",
      deadline: app.deadline || "Not specified",
      status: app.status || "Saved",
      riskLevel: app.riskLevel || "unknown",
      matchPercent: app.matchPercent !== undefined && app.matchPercent !== null ? app.matchPercent : null,
      createdAt: app.createdAt || new Date().toISOString(),
      appliedAt: app.appliedAt || (app.status === "Applied" ? new Date().toISOString() : null),
      updatedAt: new Date().toISOString(),
      demo: !!app.demo
    };
    current.unshift(newApp);
    localStorage.setItem("internpilot_apps", JSON.stringify(current));
    return newApp;
  } catch (err) {
    console.error("Error saving application to localStorage:", err);
    return null;
  }
}

function updateApplication(id, updates) {
  try {
    if (typeof localStorage === "undefined") return null;
    const current = loadApplications();
    const index = current.findIndex(a => a.id === id);
    if (index === -1) return null;

    const existing = current[index];
    const nowIso = new Date().toISOString();

    let appliedAt = existing.appliedAt;
    if (updates.status === "Applied" && !appliedAt) {
      appliedAt = nowIso;
    }

    current[index] = {
      ...existing,
      ...updates,
      appliedAt,
      updatedAt: nowIso
    };

    localStorage.setItem("internpilot_apps", JSON.stringify(current));
    return current[index];
  } catch (err) {
    console.error("Error updating application in localStorage:", err);
    return null;
  }
}

// ==========================================
// UNIVERSAL MODULE EXPORT GUARD
// ==========================================
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    SCAM_RULES,
    ACTIVITY_RULES,
    SKILLS,
    ALIASES,
    scamCheck,
    extractSkills,
    matchSkills,
    computeActivity,
    saveApplication,
    updateApplication,
    loadApplications
  };
}
