// ==========================================
// SCAM CHECK RULES & WEIGHTS
// (Editable rules array at the top of the file)
// ==========================================
const SCAM_RULES = [
  {
    rule: "Asks for money",
    points: 40,
    patterns: [
      /\bregistration fee\b/i,
      /\bsecurity deposit\b/i,
      /\btraining fee\b/i,
      /\bkit charges\b/i,
      /\bprocessing fee\b/i,
      /\bpay\b/i
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

  // Helper to test if a skill/alias exists with safe boundaries
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

    // Escape regex special chars if any
    const escaped = token.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");
    const re = new RegExp(`(?<![\\w-])${escaped}(?![\\w-])`, "i");
    return re.test(lowerText);
  }

  // 1. Check multi-word skills first
  const multiWordSkills = SKILLS.filter(s => s.includes(" ") || s.includes("/") || s.includes("."));
  for (const skill of multiWordSkills) {
    if (hasToken(skill)) {
      foundSkills.add(skill);
    }
  }

  // 2. Check aliases
  for (const [alias, canonical] of Object.entries(ALIASES)) {
    if (hasToken(alias)) {
      foundSkills.add(canonical);
    }
  }

  // 3. Check single-word skills (excluding single letter skills)
  const singleWordSkills = SKILLS.filter(s => !multiWordSkills.includes(s));
  for (const skill of singleWordSkills) {
    if (skill.length <= 1) continue; // Ensure no 1-letter skills
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

  // Combine posting skills from reader (if provided) and extracted skills
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
// 4. STORAGE HELPERS (localStorage)
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
      status: "Saved",
      riskLevel: app.riskLevel || "unknown",
      matchPercent: app.matchPercent !== undefined && app.matchPercent !== null ? app.matchPercent : null,
      createdAt: new Date().toISOString()
    };
    current.unshift(newApp);
    localStorage.setItem("internpilot_apps", JSON.stringify(current));
    return newApp;
  } catch (err) {
    console.error("Error saving application to localStorage:", err);
    return null;
  }
}

// ==========================================
// UNIVERSAL MODULE EXPORT GUARD
// ==========================================
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    SCAM_RULES,
    SKILLS,
    ALIASES,
    scamCheck,
    extractSkills,
    matchSkills,
    saveApplication,
    loadApplications
  };
}
