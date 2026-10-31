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
// 3. CAREERMATCH AI KNOWLEDGE BASE & ENGINE
// ==========================================

const PARTIAL_MATCH_MAP = {
  "typescript": {
    foundation: ["javascript"],
    note: "Strong JavaScript foundation directly accelerates learning TypeScript static types, interfaces, and generics."
  },
  "next.js": {
    foundation: ["react", "javascript"],
    note: "React component and JSX experience translates directly to Next.js server components and App Router."
  },
  "node.js": {
    foundation: ["javascript"],
    note: "JavaScript fluency allows you to write server-side runtime code and asynchronous event-driven backend logic immediately."
  },
  "django": {
    foundation: ["python"],
    note: "Python programming proficiency enables rapid mastery of Django's batteries-included MVT web framework."
  },
  "flask": {
    foundation: ["python"],
    note: "Python foundation makes learning Flask microframework routing and request handling straightforward."
  },
  "fastapi": {
    foundation: ["python"],
    note: "Python type hints and async/await syntax provide the exact prerequisite for FastAPI development."
  },
  "react": {
    foundation: ["javascript", "html", "css"],
    note: "JavaScript DOM manipulation and modern ES6+ concepts form the core basis for React hooks and components."
  },
  "vue": {
    foundation: ["javascript", "html"],
    note: "JavaScript and HTML background allows immediate understanding of Vue's reactivity and templates."
  },
  "angular": {
    foundation: ["typescript", "javascript"],
    note: "JavaScript and OOP concepts align directly with Angular's TypeScript services and dependency injection."
  },
  "tailwind": {
    foundation: ["css", "html"],
    note: "CSS box-model, flexbox, and grid understanding make Tailwind utility classes fast to learn."
  },
  "bootstrap": {
    foundation: ["css", "html"],
    note: "CSS fundamentals make Bootstrap's responsive grid system and pre-styled components intuitive."
  },
  "postgresql": {
    foundation: ["sql", "mysql"],
    note: "Standard SQL querying knowledge transfers seamlessly to PostgreSQL relational modeling and indexing."
  },
  "mysql": {
    foundation: ["sql"],
    note: "Relational database querying and normalization skills apply directly to MySQL schema management."
  },
  "mongodb": {
    foundation: ["javascript", "node.js"],
    note: "Familiarity with JSON objects and JavaScript makes NoSQL BSON document querying straightforward."
  },
  "redis": {
    foundation: ["sql", "node.js", "python", "mysql", "postgresql"],
    note: "General backend data storage experience prepares you for Redis in-memory caching and key-value operations."
  },
  "pytorch": {
    foundation: ["machine learning", "deep learning"],
    note: "Machine learning principles and linear algebra form the exact foundation for PyTorch tensor pipelines."
  },
  "tensorflow": {
    foundation: ["machine learning", "deep learning"],
    note: "Machine learning model knowledge applies directly to TensorFlow and Keras deep learning training graphs."
  },
  "deep learning": {
    foundation: ["machine learning", "statistics"],
    note: "Classical machine learning fundamentals prepare you for training multi-layer neural networks."
  },
  "docker": {
    foundation: ["linux"],
    note: "Linux terminal commands and process management concepts ease adopting Docker containers and Dockerfiles."
  },
  "kubernetes": {
    foundation: ["docker", "linux", "cloud"],
    note: "Docker containerization experience is the primary prerequisite for Kubernetes cluster orchestration."
  },
  "aws": {
    foundation: ["cloud", "linux"],
    note: "Core cloud computing concepts and Linux system skills transfer directly to AWS EC2, S3, and IAM."
  },
  "azure": {
    foundation: ["cloud", "linux"],
    note: "General cloud architecture knowledge applies directly to Azure compute and storage resources."
  },
  "gcp": {
    foundation: ["cloud", "linux"],
    note: "Cloud fundamentals provide the baseline for deploying applications to Google Cloud Platform."
  },
  "spring": {
    foundation: ["java"],
    note: "Java object-oriented programming fundamentals prepare you for Spring IoC and dependency injection."
  },
  "spring boot": {
    foundation: ["java", "spring"],
    note: "Java background simplifies configuring production-ready Spring Boot microservices."
  },
  "express": {
    foundation: ["node.js", "javascript"],
    note: "Node.js and asynchronous JavaScript allow you to build Express REST endpoints immediately."
  },
  "pandas": {
    foundation: ["python", "data analysis", "excel"],
    note: "Python programming and spreadsheet analysis concepts apply directly to Pandas DataFrame manipulation."
  },
  "numpy": {
    foundation: ["python", "statistics"],
    note: "Python syntax enables quick adoption of NumPy multidimensional array operations."
  },
  "statistics": {
    foundation: ["data analysis", "excel"],
    note: "Data exploration and reporting experience provides strong intuition for statistical distributions and testing."
  },
  "flutter": {
    foundation: ["javascript", "java", "c++"],
    note: "Object-oriented and reactive programming experience accelerates learning Dart and Flutter widgets."
  },
  "android": {
    foundation: ["java", "kotlin"],
    note: "Java or Kotlin experience translates directly into Android Activity lifecycles and layout XML."
  }
};

const SKILL_REASONS = {
  "javascript": "Required to implement interactive client-side logic, handle asynchronous requests, and manipulate the DOM.",
  "typescript": "Required to build type-safe, maintainable web applications and prevent runtime errors in production.",
  "html": "Required to construct semantic, accessible markup for web interfaces and email templates.",
  "css": "Required to style responsive, visual layouts with modern flexbox, CSS grid, and media queries.",
  "react": "Required to develop modular component-based user interfaces and manage reactive application state.",
  "next.js": "Required for server-rendered React applications, SEO-friendly web architecture, and fullstack API routes.",
  "node.js": "Required to build scalable asynchronous backend services and handle server-side runtime operations.",
  "express": "Required to design RESTful HTTP APIs, handle middleware authentication, and process server requests.",
  "python": "Required for backend scripting, data pipeline processing, and algorithmic problem-solving.",
  "sql": "Required to write relational database queries, join datasets, and manage persistent relational data.",
  "postgresql": "Required to manage relational schemas, complex transactions, and indexed production databases.",
  "mysql": "Required to manage relational tables, perform ACID transactions, and optimize database queries.",
  "mongodb": "Required for flexible NoSQL document storage, schema-less prototyping, and aggregation pipelines.",
  "git": "Required for team version control, feature branching, pull request workflows, and collaborative codebase management.",
  "github": "Required for remote repository collaboration, issue tracking, and CI/CD automation pipelines.",
  "docker": "Required to containerize software environments, ensuring reproducible builds across development and production.",
  "linux": "Required for server management, shell scripting, process monitoring, and production deployment environments.",
  "cloud": "Required to understand distributed infrastructure, compute instances, object storage, and remote deployments.",
  "aws": "Required to provision cloud infrastructure such as EC2 compute, S3 static assets, and IAM role security.",
  "machine learning": "Required to develop predictive models, train classification algorithms, and evaluate statistical metrics.",
  "deep learning": "Required to build convolutional or transformer neural networks for complex computer vision or NLP tasks.",
  "pytorch": "Required to design dynamic computational graphs, train neural models, and fine-tune machine learning architectures.",
  "tensorflow": "Required for training production-grade deep learning networks and deploying models to client/server targets.",
  "data analysis": "Required to extract actionable business insights from raw data, clean datasets, and visualize metrics.",
  "pandas": "Required to clean, transform, aggregate, and inspect tabular datasets with high efficiency in Python.",
  "numpy": "Required for high-performance vectorized mathematical operations and multi-dimensional matrix linear algebra.",
  "statistics": "Required to validate experimental hypotheses, perform A/B testing, and interpret distribution metrics.",
  "figma": "Required to design user interface wireframes, prototype user journeys, and collaborate with product teams.",
  "ui/ux": "Required to deliver user-centered design, conduct usability research, and ensure accessible navigation.",
  "communication": "Required to collaborate across engineering teams, document technical decisions, and present project milestones.",
  "c++": "Required for memory-efficient systems programming, low-latency performance, and algorithmic execution.",
  "java": "Required for enterprise backend architectures, object-oriented software design, and scalable services."
};

const LEARNING_RESOURCES = {
  "typescript": {
    level: "Intermediate",
    hours: "12–16 hours (1–2 weeks)",
    topics: ["Basic Types & Type Inference", "Interfaces vs Type Aliases", "Generics & Utility Types", "Configuring tsconfig & Node/React integration"],
    practicalActivities: [
      "Convert a vanilla JavaScript function library into strictly-typed TypeScript with zero 'any' types.",
      "Build a typed React component that accepts generic props with strict event handlers.",
      "Write a typed REST API response handler that safely validates incoming JSON schemas."
    ]
  },
  "react": {
    level: "Intermediate",
    hours: "18–24 hours (2–3 weeks)",
    topics: ["JSX & Virtual DOM fundamentals", "useState, useEffect & custom hooks", "Component Composition & Props Drilling", "Consuming REST APIs & State Management"],
    practicalActivities: [
      "Build a responsive Todo & Filter app using React state and localStorage persistence.",
      "Build an interactive Job Board that fetches postings from a mock API with search and tag filters.",
      "Implement a light/dark theme switcher using React Context API."
    ]
  },
  "next.js": {
    level: "Intermediate",
    hours: "14–18 hours (2 weeks)",
    topics: ["App Router & File-based Routing", "Server Components vs Client Components", "Data Fetching & Caching Strategies", "Fullstack API Route Handlers"],
    practicalActivities: [
      "Build a multi-page dynamic blog utilizing Next.js Server Components and dynamic route parameters.",
      "Create a fullstack feedback collector with a Next.js API route that writes to a local SQLite database.",
      "Implement an optimized landing page with next/image and server-side metadata generation."
    ]
  },
  "python": {
    level: "Beginner",
    hours: "15–20 hours (2 weeks)",
    topics: ["Variables, Data Types & Control Flow", "Functions, Modules & File I/O", "Object-Oriented Programming (Classes & Inheritance)", "Virtual Environments & Package Management (pip)"],
    practicalActivities: [
      "Write a command-line utility that reads a CSV file and calculates summary statistics.",
      "Build a web scraper using requests and BeautifulSoup to extract headlines from a tech news site.",
      "Create a modular CLI tool with unit tests using Python's built-in unittest module."
    ]
  },
  "sql": {
    level: "Beginner",
    hours: "10–14 hours (1–2 weeks)",
    topics: ["SELECT, WHERE, ORDER BY & LIMIT", "INNER, LEFT & FULL OUTER JOINs", "Aggregate Functions (COUNT, SUM, AVG, GROUP BY, HAVING)", "Table Creation, Foreign Keys & Constraints"],
    practicalActivities: [
      "Design an Entity-Relationship schema for an Internship Tracker and write CREATE TABLE statements.",
      "Write 10 SQL queries calculating average stipend, highest frequency skills, and nearest deadlines.",
      "Practice multi-table joins on SQLZoo or LeetCode Database practice sets."
    ]
  },
  "postgresql": {
    level: "Intermediate",
    hours: "12–16 hours (1–2 weeks)",
    topics: ["PostgreSQL Schema Design & Data Types", "Indexing Strategies (B-tree, GIN)", "Transactions & ACID Compliance", "Connecting via Node.js (pg / Prisma / Drizzle)"],
    practicalActivities: [
      "Set up a local or Supabase PostgreSQL database and create a normalized 3-table schema.",
      "Write parameterized queries in Node.js preventing SQL injection vulnerabilities.",
      "Analyze query performance using EXPLAIN ANALYZE on a 10,000-row test dataset."
    ]
  },
  "docker": {
    level: "Intermediate",
    hours: "10–14 hours (1–2 weeks)",
    topics: ["Containers vs Virtual Machines", "Writing Multi-stage Dockerfiles", "Image Layer Caching & Optimization", "Docker Compose for Multi-container Apps"],
    practicalActivities: [
      "Write a Dockerfile for a Node.js Express application minimizing image size using Alpine Linux.",
      "Create a docker-compose.yml file orchestrating an Express backend and a PostgreSQL database.",
      "Build, tag, and test running your container locally with volume mounts for live reload."
    ]
  },
  "pytorch": {
    level: "Intermediate",
    hours: "20–28 hours (3 weeks)",
    topics: ["Tensors, Dimensions & GPU Acceleration", "Autograd & Automatic Differentiation", "Building Custom nn.Module Architectures", "DataLoader, Training Loops & Loss Functions"],
    practicalActivities: [
      "Train a feedforward neural network on the MNIST digits dataset achieving >97% validation accuracy.",
      "Implement a custom PyTorch Dataset class loading and normalizing real tabular or image data.",
      "Save and load model state_dict weights and build an inference script for single predictions."
    ]
  },
  "tensorflow": {
    level: "Intermediate",
    hours: "20–26 hours (3 weeks)",
    topics: ["Tensors & Keras Sequential/Functional APIs", "Convolutional Neural Networks (CNNs)", "Loss Functions, Optimizers & Callbacks", "Model Evaluation & Exporting SavedModels"],
    practicalActivities: [
      "Build a binary image classification model with Keras with early stopping callbacks.",
      "Apply data augmentation techniques to reduce model overfitting on small training samples.",
      "Evaluate precision, recall, and ROC-AUC on a held-out test split."
    ]
  },
  "machine learning": {
    level: "Beginner",
    hours: "18–24 hours (2–3 weeks)",
    topics: ["Supervised vs Unsupervised Learning", "Feature Scaling & Train/Test Splits", "Regression, Decision Trees & Random Forests", "Cross-Validation & Evaluation Metrics (F1, MSE)"],
    practicalActivities: [
      "Train a Scikit-Learn Random Forest regressor to predict house prices or salary ranges.",
      "Preprocess a messy tabular dataset by imputing missing values and one-hot encoding categories.",
      "Plot confusion matrices and precision-recall curves comparing two baseline algorithms."
    ]
  },
  "data analysis": {
    level: "Beginner",
    hours: "12–16 hours (1–2 weeks)",
    topics: ["Exploratory Data Analysis (EDA)", "Cleaning Missing & Duplicate Values", "Statistical Distributions & Outlier Detection", "Visualizing Trends with Matplotlib / Seaborn"],
    practicalActivities: [
      "Perform an EDA notebook on an open Kaggle dataset uncovering at least 5 meaningful patterns.",
      "Create clear bar charts, scatter plots, and box plots with labelled axes and legends.",
      "Write a 1-page executive summary translating statistical findings into actionable recommendations."
    ]
  },
  "cloud": {
    level: "Beginner",
    hours: "10–14 hours (1–2 weeks)",
    topics: ["Cloud Service Models (IaaS, PaaS, Serverless)", "Virtual Private Clouds & Networking basics", "Object Storage & CDN Edge Distribution", "Authentication, API Keys & Secret Management"],
    practicalActivities: [
      "Deploy a static web application to cloud storage with automated global edge caching.",
      "Configure cloud environment variables securely without committing secrets to source control.",
      "Set up a healthcheck monitor alerting on server downtime."
    ]
  },
  "aws": {
    level: "Intermediate",
    hours: "14–18 hours (2 weeks)",
    topics: ["AWS EC2 Instances & Security Groups", "S3 Buckets & Bucket Policies", "AWS Lambda Serverless Functions", "IAM Users, Roles & Least Privilege"],
    practicalActivities: [
      "Launch a free-tier EC2 Ubuntu instance and configure an Nginx reverse proxy.",
      "Host static web assets in an Amazon S3 bucket with restricted public read permissions.",
      "Deploy a serverless AWS Lambda microservice triggered by an API Gateway endpoint."
    ]
  },
  "git": {
    level: "Beginner",
    hours: "6–8 hours (1 week)",
    topics: ["init, clone, add, commit, push", "Branching, Merging & Fast-forward vs 3-way", "Resolving Merge Conflicts", "Pull Requests & Code Review etiquette"],
    practicalActivities: [
      "Create a GitHub repository with a clean README, .gitignore, and semantic commit history.",
      "Simulate and resolve a merge conflict across two feature branches.",
      "Open a pull request with an informative title, context summary, and test verification checklist."
    ]
  }
};

const PROJECT_BLUEPRINTS = [
  {
    targetDomain: ["frontend", "web", "react", "javascript", "typescript"],
    title: "Interactive Student Internship & Milestone Portal",
    description: "A responsive single-page application built with modern component architecture, real-time search filtering, and localized state persistence.",
    skillsCovered: ["React", "TypeScript", "HTML", "CSS", "Git"],
    difficulty: "Beginner / Intermediate",
    deliverable: "Deployed GitHub repository with modular component structure, zero TypeScript warnings, and responsive mobile layouts.",
    relevance: "Directly demonstrates the frontend engineering skills required to build customer-facing web dashboards."
  },
  {
    targetDomain: ["backend", "node.js", "express", "sql", "postgresql", "mysql"],
    title: "RESTful Application Tracking & Notification API",
    description: "A secure backend web service featuring relational database schema migrations, JWT authentication middleware, and input sanitization.",
    skillsCovered: ["Node.js", "Express", "PostgreSQL", "SQL", "Git"],
    difficulty: "Intermediate",
    deliverable: "Documented REST API with OpenAPI/Swagger specification, parameterized SQL queries, and automated integration test coverage.",
    relevance: "Proves competency in building resilient server-side services, data modeling, and handling production HTTP workflows."
  },
  {
    targetDomain: ["machine learning", "pytorch", "tensorflow", "data analysis", "python", "statistics"],
    title: "Predictive Internship Salary & Competency Analytics Pipeline",
    description: "An end-to-end data pipeline that ingests job posting datasets, performs exploratory data analysis, and trains predictive models on key skills.",
    skillsCovered: ["Python", "Pandas", "Scikit-Learn", "Machine Learning", "Statistics"],
    difficulty: "Intermediate",
    deliverable: "Jupyter notebook with documented EDA, feature engineering, model metric comparisons (RMSE/F1), and exported inference script.",
    relevance: "Proves hands-on capability to handle messy real-world datasets and deliver verifiable data science outcomes."
  },
  {
    targetDomain: ["cloud", "docker", "aws", "linux"],
    title: "Containerized Microservice with Automated Cloud Deployment",
    description: "A containerized fullstack service packaged with Docker Compose, configured with multi-stage builds, and deployed to cloud infrastructure.",
    skillsCovered: ["Docker", "Linux", "Cloud", "AWS", "Git"],
    difficulty: "Intermediate",
    deliverable: "GitHub repository featuring multi-stage Dockerfiles, docker-compose.yml configuration, and a deployed live cloud URL.",
    relevance: "Demonstrates practical modern DevOps discipline, container isolation, and cloud architecture awareness."
  }
];

// ==========================================
// 4. CAREERMATCH AI HELPERS
// ==========================================
function findEvidenceInResume(resumeText, targetSkill) {
  if (!resumeText || typeof resumeText !== "string" || !targetSkill) return null;
  const lines = resumeText.split(/\r?\n/);
  const escaped = targetSkill.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`(?<![\\w#+])${escaped}(?![\\w#+])`, "i");

  // Prefer finding in project or experience lines first
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed && regex.test(trimmed) && trimmed.length > 15) {
      return trimmed.length > 130 ? trimmed.slice(0, 127) + "..." : trimmed;
    }
  }

  // Fallback to any line containing it
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed && regex.test(trimmed)) {
      return trimmed.length > 130 ? trimmed.slice(0, 127) + "..." : trimmed;
    }
  }

  return null;
}

function extractResponsibilitiesAndQualifications(postingText) {
  const responsibilities = [];
  const qualifications = [];
  if (!postingText || typeof postingText !== "string") {
    return { responsibilities, qualifications };
  }
  const lines = postingText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  let currentSection = null;

  for (const line of lines) {
    const lower = line.toLowerCase();
    if (lower.includes("responsibilit") || lower.includes("duties") || lower.includes("what you will do") || lower.includes("what you'll do") || lower.includes("key tasks") || lower.includes("role overview")) {
      currentSection = "resp";
      continue;
    }
    if (lower.includes("qualification") || lower.includes("requirements") || lower.includes("who you are") || lower.includes("what we are looking for") || lower.includes("what we're looking for") || lower.includes("eligibility") || lower.includes("prerequisites")) {
      currentSection = "qual";
      continue;
    }
    const isBullet = /^[-*•·–—]|\d+\.|\b(develop|build|design|collaborate|write|maintain|assist|support|lead|manage|test|deploy|bachelor|master|degree|experience|proficiency|strong|knowledge|familiarity)\b/i.test(line);
    if (currentSection === "resp" && isBullet && line.length > 12) {
      const clean = line.replace(/^[-*•·–—\d.]+\s*/, "").trim();
      if (clean && !responsibilities.includes(clean)) responsibilities.push(clean);
    } else if (currentSection === "qual" && isBullet && line.length > 12) {
      const clean = line.replace(/^[-*•·–—\d.]+\s*/, "").trim();
      if (clean && !qualifications.includes(clean)) qualifications.push(clean);
    }
  }

  return { responsibilities: responsibilities.slice(0, 5), qualifications: qualifications.slice(0, 5) };
}

function extractCategorizedSkillsFromText(postingText) {
  const textRequired = [];
  const textPreferred = [];

  if (!postingText || typeof postingText !== "string") {
    return { textRequired, textPreferred };
  }

  const lines = postingText.split(/\r?\n/);
  let currentSection = null;

  for (const line of lines) {
    const lower = line.toLowerCase().trim();

    if (
      lower.startsWith("preferred") ||
      lower.startsWith("nice to have") ||
      lower.startsWith("good to have") ||
      lower.startsWith("bonus") ||
      lower.includes("preferred skills") ||
      lower.includes("nice-to-have")
    ) {
      currentSection = "pref";
      const lineSkills = extractSkills(line);
      textPreferred.push(...lineSkills);
      continue;
    }

    if (
      lower.startsWith("required") ||
      lower.startsWith("requirements") ||
      lower.startsWith("must have") ||
      lower.includes("required skills") ||
      lower.includes("must-have")
    ) {
      currentSection = "req";
      const lineSkills = extractSkills(line);
      textRequired.push(...lineSkills);
      continue;
    }

    if (
      lower.startsWith("responsibilit") ||
      lower.startsWith("qualificat") ||
      lower.startsWith("about") ||
      lower.startsWith("duties") ||
      lower.startsWith("what we offer") ||
      lower.startsWith("stipend") ||
      lower.startsWith("deadline")
    ) {
      currentSection = null;
      continue;
    }

    if (currentSection === "pref") {
      const lineSkills = extractSkills(line);
      textPreferred.push(...lineSkills);
    } else if (currentSection === "req") {
      const lineSkills = extractSkills(line);
      textRequired.push(...lineSkills);
    }
  }

  return { textRequired, textPreferred };
}

// ==========================================
// 4. CAREERMATCH AI CORE EVALUATION FUNCTION
// ==========================================
function analyzeCareerMatch(resumeText, postingText, aiDetails = null) {
  const resumeSkills = extractSkills(resumeText || "");
  const normalizedResumeSkills = resumeSkills.map(s => s.toLowerCase());

  // Extract job responsibilities and qualifications
  const defaultIntel = extractResponsibilitiesAndQualifications(postingText || "");
  const responsibilities = (aiDetails && Array.isArray(aiDetails.responsibilities) && aiDetails.responsibilities.length > 0)
    ? aiDetails.responsibilities
    : defaultIntel.responsibilities;
  const qualifications = (aiDetails && Array.isArray(aiDetails.qualifications) && aiDetails.qualifications.length > 0)
    ? aiDetails.qualifications
    : defaultIntel.qualifications;

  // Extract job skills (from AI structured details if provided, plus text-section extraction or regex fallback)
  let rawRequired = [];
  let rawPreferred = [];

  if (aiDetails && typeof aiDetails === "object") {
    if (Array.isArray(aiDetails.requiredSkills)) {
      rawRequired.push(...aiDetails.requiredSkills);
    }
    if (Array.isArray(aiDetails.preferredSkills)) {
      rawPreferred.push(...aiDetails.preferredSkills);
    }
  }

  // If no AI structured separation was passed, check if the posting text contains explicit Required vs Preferred sections
  if (rawRequired.length === 0 && rawPreferred.length === 0) {
    const textSections = extractCategorizedSkillsFromText(postingText || "");
    if (textSections.textRequired.length > 0 || textSections.textPreferred.length > 0) {
      rawRequired.push(...textSections.textRequired);
      rawPreferred.push(...textSections.textPreferred);
    }
  }

  // Fallback to regex extraction from job posting text
  const postingRegexSkills = extractSkills(postingText || "");

  // If still no skills separated, treat all posting regex skills as required
  if (rawRequired.length === 0 && rawPreferred.length === 0) {
    rawRequired = postingRegexSkills;
  } else {
    // Add any regex skills not yet categorized to rawRequired
    for (const rs of postingRegexSkills) {
      const lower = rs.toLowerCase();
      const inReq = rawRequired.some(s => (typeof s === "string" ? s : s.name).toLowerCase() === lower);
      const inPref = rawPreferred.some(s => (typeof s === "string" ? s : s.name).toLowerCase() === lower);
      if (!inReq && !inPref) {
        rawRequired.push(rs);
      }
    }
  }

  // Normalize skill items into uniform objects
  function normalizeSkillList(list, defaultImportance) {
    const result = [];
    const seen = new Set();
    for (const item of list) {
      let name = "";
      let importance = defaultImportance;
      let reason = null;

      if (typeof item === "string") {
        name = item.trim().toLowerCase();
      } else if (item && typeof item === "object") {
        name = (item.name || item.skill || "").trim().toLowerCase();
        importance = item.importance || defaultImportance;
        reason = item.reason || null;
      }

      const canonical = ALIASES[name] || name;
      if (canonical.length > 1 && !seen.has(canonical)) {
        seen.add(canonical);
        const resolvedReason = reason || (aiDetails?.skillReasons && aiDetails.skillReasons[canonical]) || SKILL_REASONS[canonical] || `Required to perform essential ${canonical.toUpperCase()} duties for this role.`;
        result.push({
          name: canonical,
          importance: importance === "preferred" ? "preferred" : "required",
          reason: resolvedReason
        });
      }
    }
    return result;
  }

  const requiredList = normalizeSkillList(rawRequired, "required");
  const preferredList = normalizeSkillList(rawPreferred, "preferred");
  const allJobSkills = [...requiredList, ...preferredList];

  if (allJobSkills.length === 0) {
    return {
      percent: null,
      score: null,
      level: "very low",
      matched: [],
      partial: [],
      missing: [],
      requiredSkills: [],
      preferredSkills: [],
      responsibilities: [],
      qualifications: [],
      roadmap: [],
      projects: [],
      scoreBreakdown: "No recognizable skills identified in the job posting to evaluate.",
      note: "No recognizable skills found in the job posting."
    };
  }

  const matched = [];
  const partial = [];
  const missing = [];

  let earnedPoints = 0;
  let totalPossiblePoints = 0;

  for (const skillObj of allJobSkills) {
    const skillName = skillObj.name;
    const isRequired = skillObj.importance === "required";
    const weight = isRequired ? 2.0 : 1.0;
    totalPossiblePoints += weight;

    // Check 1: Direct exact match
    if (normalizedResumeSkills.includes(skillName)) {
      earnedPoints += 1.0 * weight;
      matched.push({
        ...skillObj,
        status: "matched",
        credit: 1.0,
        weight
      });
      continue;
    }

    // Check 2: Partial match via foundation skills
    const partialRule = PARTIAL_MATCH_MAP[skillName];
    let foundFoundation = null;

    if (partialRule && Array.isArray(partialRule.foundation)) {
      foundFoundation = partialRule.foundation.find(f => normalizedResumeSkills.includes(f.toLowerCase()));
    }

    if (foundFoundation) {
      earnedPoints += 0.5 * weight;
      const resumeQuote = findEvidenceInResume(resumeText, foundFoundation);
      const evidenceText = resumeQuote
        ? `Resume proof (${foundFoundation.toUpperCase()}): "${resumeQuote}" — ${partialRule.note}`
        : `Resume mentions ${foundFoundation.toUpperCase()} — ${partialRule.note}`;

      partial.push({
        ...skillObj,
        status: "partial",
        credit: 0.5,
        weight,
        foundationSkill: foundFoundation,
        foundationEvidence: evidenceText,
        resumeSnippet: resumeQuote
      });
    } else {
      // Check 3: Missing competency
      missing.push({
        ...skillObj,
        status: "missing",
        credit: 0.0,
        weight
      });
    }
  }

  const percent = totalPossiblePoints > 0 ? Math.round((earnedPoints / totalPossiblePoints) * 100) : 0;

  let level = "very low";
  if (percent >= 65) {
    level = "good";
  } else if (percent >= 35) {
    level = "low";
  }

  // Construct Personalized Learning Roadmap (focusing on missing and partial skills)
  const skillsForRoadmap = [...missing, ...partial];
  // Sort so required skills come first, then partial skills with existing foundations
  skillsForRoadmap.sort((a, b) => {
    if (a.importance === "required" && b.importance !== "required") return -1;
    if (b.importance === "required" && a.importance !== "required") return 1;
    if (a.status === "partial" && b.status === "missing") return -1;
    if (b.status === "partial" && a.status === "missing") return 1;
    return 0;
  });

  const roadmap = skillsForRoadmap.map(s => {
    const res = LEARNING_RESOURCES[s.name] || {
      level: s.status === "partial" ? "Intermediate" : "Beginner",
      hours: "10–14 hours (1–2 weeks)",
      topics: [`Core ${s.name} concepts & syntax`, `Project structure & practical configuration`, `Debugging & best practices`],
      practicalActivities: [
        `Complete a guided hands-on tutorial on ${s.name} fundamentals.`,
        `Build a focused micro-project implementing ${s.name} into your portfolio.`,
        `Push your ${s.name} project to GitHub with descriptive documentation.`
      ]
    };

    let foundationNote = null;
    if (s.status === "partial" && s.foundationSkill) {
      foundationNote = `Leverage your ${s.foundationSkill.toUpperCase()} background: you already understand the foundational concepts, so you can jump straight into advanced syntax and patterns.`;
    }

    return {
      skill: s.name,
      importance: s.importance === "required" ? "High (Required)" : "Medium (Preferred)",
      level: s.status === "partial" ? "Intermediate (Foundation Known)" : res.level,
      whyItMatters: s.reason,
      foundationNote,
      estimatedHours: res.hours,
      topics: res.topics,
      practicalActivities: res.practicalActivities
    };
  });

  // Select 2 to 3 practical, relevant student projects
  const roleLower = (aiDetails?.role || postingText || "").toLowerCase();
  const projects = [];

  for (const bp of PROJECT_BLUEPRINTS) {
    const isDomainMatch = bp.targetDomain.some(d =>
      roleLower.includes(d) ||
      allJobSkills.some(js => js.name.toLowerCase() === d)
    );
    if (isDomainMatch) {
      projects.push(bp);
    }
    if (projects.length >= 3) break;
  }

  // Ensure at least 2 recommended projects
  if (projects.length < 2) {
    for (const bp of PROJECT_BLUEPRINTS) {
      if (!projects.includes(bp)) {
        projects.push(bp);
      }
      if (projects.length >= 2) break;
    }
  }

  const scoreBreakdown = `Explainable Match: ${matched.length} matched (1.0x), ${partial.length} partial (0.5x), ${missing.length} missing (0.0x) out of ${allJobSkills.length} competencies. Required skills weighted at 2.0x, preferred at 1.0x. Earned ${earnedPoints.toFixed(1)} / ${totalPossiblePoints.toFixed(1)} points.`;

  return {
    percent,
    score: percent,
    level,
    matched,
    partial,
    missing,
    requiredSkills: requiredList,
    preferredSkills: preferredList,
    responsibilities,
    qualifications,
    roadmap,
    projects,
    scoreBreakdown,
    note: ""
  };
}

// ==========================================
// 5. BACKWARD-COMPATIBLE SKILL MATCHER WRAPPER
// ==========================================
function matchSkills(resumeText, postingText, postingSkills = null) {
  let aiDetails = null;
  if (postingSkills && typeof postingSkills === "object" && !Array.isArray(postingSkills)) {
    aiDetails = postingSkills;
  } else if (Array.isArray(postingSkills)) {
    aiDetails = { requiredSkills: postingSkills };
  }

  const cm = analyzeCareerMatch(resumeText, postingText, aiDetails);

  return {
    percent: cm.percent,
    score: cm.percent,
    level: cm.level,
    matched: cm.matched.map(s => s.name),
    partial: cm.partial.map(s => s.name),
    missing: cm.missing.map(s => s.name),
    note: cm.note,
    careerMatch: cm
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
// FEATURE 2: SAVED CAREERMATCH ANALYSES STORAGE
// (localStorage key: "internpilot_saved_analyses")
// ==========================================

const SAVED_ANALYSES_STORAGE_KEY = "internpilot_saved_analyses";

function loadSavedAnalyses() {
  try {
    if (typeof localStorage === "undefined") return [];
    const data = localStorage.getItem(SAVED_ANALYSES_STORAGE_KEY);
    if (!data) return [];
    const parsed = JSON.parse(data);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.warn("Could not load saved analyses from localStorage:", err);
    return [];
  }
}

function saveCareerAnalysis(analysis) {
  try {
    if (typeof localStorage === "undefined") return null;
    if (!analysis || typeof analysis !== "object") return null;

    const current = loadSavedAnalyses();
    const id = analysis.id || ("cm_analysis_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7));
    const nowIso = new Date().toISOString();

    // Snapshot current activity progress states for this analysis
    const activityProgress = analysis.activityProgress ? { ...analysis.activityProgress } : {};
    if (Array.isArray(analysis.roadmap)) {
      analysis.roadmap.forEach((r, rIdx) => {
        const skill = r.skill || rIdx;
        const prefix = `cm_act_${encodeURIComponent(skill)}_`;
        (r.practicalActivities || []).forEach((_, actIdx) => {
          const key = prefix + actIdx;
          if (activityProgress[key] === undefined && typeof localStorage !== "undefined") {
            const val = localStorage.getItem(key);
            if (val === "done") {
              activityProgress[key] = "done";
            }
          }
        });
      });
    }

    const newRecord = {
      id,
      savedAt: analysis.savedAt || nowIso,
      updatedAt: nowIso,
      role: analysis.role || "Internship Role",
      company: analysis.company || "Company",
      percent: analysis.percent !== undefined && analysis.percent !== null ? analysis.percent : 0,
      level: analysis.level || "moderate",
      scoreBreakdown: analysis.scoreBreakdown || "",
      matched: Array.isArray(analysis.matched) ? analysis.matched : [],
      partial: Array.isArray(analysis.partial) ? analysis.partial : [],
      missing: Array.isArray(analysis.missing) ? analysis.missing : [],
      requiredSkills: Array.isArray(analysis.requiredSkills) ? analysis.requiredSkills : [],
      preferredSkills: Array.isArray(analysis.preferredSkills) ? analysis.preferredSkills : [],
      responsibilities: Array.isArray(analysis.responsibilities) ? analysis.responsibilities : [],
      qualifications: Array.isArray(analysis.qualifications) ? analysis.qualifications : [],
      roadmap: Array.isArray(analysis.roadmap) ? analysis.roadmap : [],
      projects: Array.isArray(analysis.projects) ? analysis.projects : [],
      scamAssessment: analysis.scamAssessment || { riskScore: 0, level: "low", reasons: [] },
      activityProgress: activityProgress,
      postingSnippet: analysis.postingSnippet || ""
    };

    const existingIdx = current.findIndex(a => a.id === id);
    if (existingIdx !== -1) {
      current[existingIdx] = newRecord;
    } else {
      current.unshift(newRecord);
    }

    localStorage.setItem(SAVED_ANALYSES_STORAGE_KEY, JSON.stringify(current));
    return newRecord;
  } catch (err) {
    console.error("Error saving career analysis to localStorage:", err);
    return null;
  }
}

function deleteSavedAnalysis(id) {
  try {
    if (typeof localStorage === "undefined" || !id) return false;
    const current = loadSavedAnalyses();
    const filtered = current.filter(a => a.id !== id);
    if (filtered.length === current.length) return false;
    localStorage.setItem(SAVED_ANALYSES_STORAGE_KEY, JSON.stringify(filtered));
    return true;
  } catch (err) {
    console.error("Error deleting saved analysis from localStorage:", err);
    return false;
  }
}

function getSavedAnalysis(id) {
  try {
    const list = loadSavedAnalyses();
    return list.find(a => a.id === id) || null;
  } catch {
    return null;
  }
}

function calculateRoadmapProgress(analysis) {
  if (!analysis || !Array.isArray(analysis.roadmap) || analysis.roadmap.length === 0) {
    return { completed: 0, total: 0, percent: 0 };
  }

  const prog = analysis.activityProgress || {};
  let total = 0;
  let completed = 0;

  analysis.roadmap.forEach((r, rIdx) => {
    const skill = r.skill || rIdx;
    const prefix = `cm_act_${encodeURIComponent(skill)}_`;
    (r.practicalActivities || []).forEach((_, actIdx) => {
      total++;
      const key = prefix + actIdx;
      const isDone = (prog && (prog[key] === "done" || prog[key] === true)) ||
        (typeof localStorage !== "undefined" && localStorage.getItem(key) === "done");
      if (isDone) completed++;
    });
  });

  const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
  return { completed, total, percent };
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
    PARTIAL_MATCH_MAP,
    SKILL_REASONS,
    LEARNING_RESOURCES,
    PROJECT_BLUEPRINTS,
    scamCheck,
    extractSkills,
    matchSkills,
    analyzeCareerMatch,
    findEvidenceInResume,
    extractResponsibilitiesAndQualifications,
    computeActivity,
    saveApplication,
    updateApplication,
    loadApplications,
    SAVED_ANALYSES_STORAGE_KEY,
    loadSavedAnalyses,
    saveCareerAnalysis,
    deleteSavedAnalysis,
    getSavedAnalysis,
    calculateRoadmapProgress
  };
}
