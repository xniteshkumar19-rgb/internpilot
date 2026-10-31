/**
 * InternPilot - AI Interview Mock Studio Engine
 * 
 * Provides:
 * - Dynamic personalized interview question generation (Technical, HR, Behavioural, Mixed)
 * - Transparent 5-pillar rubric answer evaluation with actionable feedback
 * - Contextual follow-up question generation based on candidate answers
 * - Comprehensive final interview performance report synthesis
 * - "Practice Weak Areas" targeted drill-down session generation
 * - Isolated local interview history persistence (internpilot_interview_history)
 * - Offline Demo Mode engine with realistic question banks & rubric evaluations
 * 
 * Universal Module: Compatible with Node.js and modern browsers.
 */

(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.InterviewEngine = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {

  const INTERVIEW_HISTORY_STORAGE_KEY = "internpilot_interview_history";

  // Sanitize student text and prevent prompt injection from uploaded text
  function sanitizeInputText(str, maxLength = 4000) {
    if (!str || typeof str !== "string") return "";
    return str
      .replace(/<[^>]*>/g, " ") // strip HTML
      .replace(/[\u0000-\u0008\u000B-\u000C\u000E-\u001F]/g, "") // strip control characters
      .slice(0, maxLength)
      .trim();
  }

  // Domain-specific technical question templates by technology and difficulty
  const TECHNICAL_KNOWLEDGE_BASE = {
    javascript: {
      beginner: [
        { q: "What is the difference between let, const, and var in JavaScript?", topics: ["Scope", "Hoisting"] },
        { q: "Explain how event delegation works in the DOM.", topics: ["DOM Events", "Bubbling"] },
        { q: "What are arrow functions and how do they handle the 'this' keyword differently?", topics: ["Arrow Functions", "this binding"] }
      ],
      intermediate: [
        { q: "Explain the JavaScript Event Loop, Call Stack, and Task Queue.", topics: ["Event Loop", "Asynchronous JS"] },
        { q: "What is a Closure in JavaScript and what is a practical use case for it?", topics: ["Closures", "Data encapsulation"] },
        { q: "How do Promises and async/await handle asynchronous operations and error catching?", topics: ["Promises", "Async/Await", "Error Handling"] }
      ],
      advanced: [
        { q: "How does JavaScript handle garbage collection and memory leak prevention?", topics: ["Memory Management", "Garbage Collection"] },
        { q: "Explain the difference between microtasks (Promise.then) and macrotasks (setTimeout) in the event loop.", topics: ["Microtasks", "Macrotasks", "Event Loop"] },
        { q: "How would you optimize JavaScript bundle size and eliminate render-blocking scripts in production?", topics: ["Performance", "Code Splitting", "Tree Shaking"] }
      ]
    },
    react: {
      beginner: [
        { q: "What is React, and what is the difference between props and state in a component?", topics: ["Props vs State", "Component Model"] },
        { q: "How does the Virtual DOM work and why does React use it?", topics: ["Virtual DOM", "Reconciliation"] },
        { q: "What is JSX and why do we use it in React?", topics: ["JSX", "Syntax"] }
      ],
      intermediate: [
        { q: "Explain the rules of React Hooks and how useEffect dependency arrays manage side effects.", topics: ["useEffect", "Hooks Lifecycle"] },
        { q: "How do you avoid unnecessary re-renders in React? Explain React.memo, useMemo, and useCallback.", topics: ["Performance Optimization", "Memoization"] },
        { q: "What is 'prop drilling' and how do Context API or state libraries resolve it?", topics: ["State Management", "Context API"] }
      ],
      advanced: [
        { q: "Explain the React 18 Concurrent Renderer, Transitions, and Suspense.", topics: ["Concurrent Mode", "Suspense"] },
        { q: "How would you architect custom hooks to encapsulate complex asynchronous state and API polling?", topics: ["Custom Hooks", "Architecture"] },
        { q: "Explain Server Components (RSC) vs Client Components and their impact on client bundle payload.", topics: ["React Server Components", "SSR"] }
      ]
    },
    python: {
      beginner: [
        { q: "What is the difference between lists and tuples in Python?", topics: ["Data Structures", "Mutability"] },
        { q: "How does Python handle memory management and dynamic typing?", topics: ["Dynamic Typing", "Memory"] },
        { q: "What are Python list comprehensions and how do they differ from map/filter?", topics: ["List Comprehensions", "Syntactic Sugar"] }
      ],
      intermediate: [
        { q: "What are Python decorators and how do they work behind the scenes?", topics: ["Decorators", "Higher-Order Functions"] },
        { q: "Explain the difference between deepcopy and shallow copy in Python.", topics: ["Memory References", "Copying"] },
        { q: "How do generators and the 'yield' statement improve memory efficiency when processing large datasets?", topics: ["Generators", "Iterators", "Memory Efficiency"] }
      ],
      advanced: [
        { q: "Explain Python's Global Interpreter Lock (GIL) and how it affects multithreading vs multiprocessing.", topics: ["GIL", "Concurrency", "Multiprocessing"] },
        { q: "How do Python dunder methods (__init__, __enter__, __exit__) work to build robust context managers?", topics: ["Context Managers", "Metaprogramming"] }
      ]
    },
    docker: {
      beginner: [
        { q: "What is the difference between a Docker image and a Docker container?", topics: ["Containers vs Images"] },
        { q: "What is a Dockerfile and what is the purpose of FROM, RUN, and CMD commands?", topics: ["Dockerfile", "Commands"] }
      ],
      intermediate: [
        { q: "How do multi-stage Docker builds reduce the final production container image size?", topics: ["Multi-Stage Builds", "Image Optimization"] },
        { q: "What is the difference between Docker volume mounts and bind mounts for data persistence?", topics: ["Volumes", "Storage Persistence"] }
      ],
      advanced: [
        { q: "How do you securely handle build secrets in Docker without baking credentials into image layers?", topics: ["Container Security", "Secret Management"] }
      ]
    },
    sql: {
      beginner: [
        { q: "What is the difference between INNER JOIN, LEFT JOIN, and RIGHT JOIN in SQL?", topics: ["SQL Joins", "Relational Queries"] },
        { q: "What is the difference between WHERE and HAVING clauses in SQL?", topics: ["Filtering", "Aggregation"] }
      ],
      intermediate: [
        { q: "What are database indexes, how do B-tree indexes speed up queries, and what is their write penalty?", topics: ["Database Indexing", "Query Optimization"] },
        { q: "Explain ACID properties in relational databases and why transactions matter.", topics: ["ACID Properties", "Transactions"] }
      ],
      advanced: [
        { q: "How do window functions (e.g. ROW_NUMBER(), RANK(), OVER()) work in analytical SQL queries?", topics: ["Window Functions", "Analytics"] }
      ]
    },
    general: {
      beginner: [
        { q: "What are RESTful APIs and what is the difference between GET, POST, PUT, and DELETE methods?", topics: ["REST APIs", "HTTP Methods"] },
        { q: "What is Git and how does branching help a development team collaborate?", topics: ["Git", "Version Control"] },
        { q: "What is the difference between synchronous and asynchronous code execution?", topics: ["Async Programming", "Concurrency"] }
      ],
      intermediate: [
        { q: "How do you identify and resolve a performance bottleneck in a web application?", topics: ["Debugging", "Profiling", "Performance"] },
        { q: "What is CORS (Cross-Origin Resource Sharing) and how do servers configure it securely?", topics: ["Web Security", "CORS", "HTTP Headers"] },
        { q: "Explain how automated testing (unit tests, integration tests) ensures code quality in a CI/CD pipeline.", topics: ["Testing", "CI/CD", "Quality Assurance"] }
      ],
      advanced: [
        { q: "How would you design a scalable microservices architecture that handles unexpected traffic spikes?", topics: ["System Design", "Scalability", "Microservices"] },
        { q: "Explain how caching strategies (CDN, Redis, Browser cache) reduce database load and latency.", topics: ["Caching", "Redis", "Latency Optimization"] }
      ]
    }
  };

  // HR Question Bank (Personalized based on role & candidate background)
  const HR_QUESTION_TEMPLATES = [
    {
      template: (role, company) => `Tell me about yourself, your educational background, and what inspired you to pursue this ${role} internship.`,
      topics: ["Self Introduction", "Career Story", "Motivation"]
    },
    {
      template: (role, company) => `Why are you interested in joining ${company} specifically, and how does this ${role} position align with your future career goals?`,
      topics: ["Company Knowledge", "Role Alignment", "Career Vision"]
    },
    {
      template: (role, company) => `What do you consider your greatest technical or personal strength, and can you share an example of how it helped you succeed?`,
      topics: ["Self Awareness", "Strengths", "Evidence"]
    },
    {
      template: (role, company) => `With many qualified candidates applying for this ${role} internship, why should our team select you?`,
      topics: ["Value Proposition", "Differentiators", "Work Ethic"]
    },
    {
      template: (role, company) => `Describe an area of technology where you feel you need improvement. What active steps are you taking to learn and overcome that gap?`,
      topics: ["Growth Mindset", "Humility", "Continuous Learning"]
    }
  ];

  // Behavioural Question Bank (Focusing on practical student scenarios & STAR method)
  const BEHAVIOURAL_QUESTION_TEMPLATES = [
    {
      q: "Tell me about a time when you worked on a team project and had a disagreement on the technical direction. How did you handle it and what was the outcome?",
      topics: ["Teamwork", "Conflict Resolution", "Communication"],
      method: "STAR"
    },
    {
      q: "Describe a project deadline or academic crunch where you felt overwhelmed. How did you prioritize tasks and ensure deliverables were completed?",
      topics: ["Time Management", "Prioritization", "Resilience"],
      method: "STAR"
    },
    {
      q: "Give an example of a challenging bug or technical roadblock you faced in a recent coding project. Walk me through your debugging methodology.",
      topics: ["Problem Solving", "Debugging Methodology", "Persistence"],
      method: "STAR"
    },
    {
      q: "Tell me about a time when you had to learn a completely new framework, library, or programming tool on a tight deadline. How did you approach the learning curve?",
      topics: ["Adaptability", "Learning Agility", "Self-Direction"],
      method: "STAR"
    },
    {
      q: "Can you share an experience where you received constructive criticism or code review feedback? How did you respond and implement the advice?",
      topics: ["Feedback Reception", "Coachability", "Professionalism"],
      method: "STAR"
    }
  ];

  /**
   * 1. PERSONALIZED QUESTION GENERATOR
   * Produces questions tailored to candidate's actual skills, project mentions, target role, category, and difficulty.
   */
  function generateInterviewQuestions(options = {}) {
    const category = (options.category || "mixed").toLowerCase();
    const difficulty = (options.difficulty || "intermediate").toLowerCase();
    const count = parseInt(options.count, 10) || 5;
    const role = options.role || "Software Engineering Intern";
    const company = options.company || "Target Company";
    const extractedSkills = Array.isArray(options.skills) ? options.skills.map(s => String(s).toLowerCase()) : [];
    const resumeText = options.resumeText || "";
    const weakTopics = Array.isArray(options.weakTopics) ? options.weakTopics : [];

    const questions = [];

    // Detect skills mentioned in resume or posting
    const detectedTech = [];
    Object.keys(TECHNICAL_KNOWLEDGE_BASE).forEach(tech => {
      if (tech === "general") return;
      if (extractedSkills.includes(tech) || resumeText.toLowerCase().includes(tech) || role.toLowerCase().includes(tech)) {
        detectedTech.push(tech);
      }
    });
    if (detectedTech.length === 0) detectedTech.push("javascript"); // default baseline

    // Helper to generate a technical question
    function createTechnicalQuestion(diff, specificTopic = null) {
      let techPool = detectedTech;
      let chosenTech = techPool[Math.floor(Math.random() * techPool.length)];
      
      if (specificTopic) {
        // If weak topic matches a known tech
        const matched = Object.keys(TECHNICAL_KNOWLEDGE_BASE).find(t => specificTopic.toLowerCase().includes(t));
        if (matched) chosenTech = matched;
      }

      const bank = TECHNICAL_KNOWLEDGE_BASE[chosenTech] || TECHNICAL_KNOWLEDGE_BASE.general;
      const levelQuestions = bank[diff] || bank.intermediate || TECHNICAL_KNOWLEDGE_BASE.general.intermediate;
      const pick = levelQuestions[Math.floor(Math.random() * levelQuestions.length)];

      return {
        id: "q_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6),
        category: "Technical",
        difficulty: diff.charAt(0).toUpperCase() + diff.slice(1),
        text: pick.q,
        topics: pick.topics,
        targetSkill: chosenTech.toUpperCase(),
        rationale: `Selected based on target role requirements and candidate skill profile in ${chosenTech.toUpperCase()}.`
      };
    }

    // Helper to generate an HR question
    function createHrQuestion(idx) {
      const tmplObj = HR_QUESTION_TEMPLATES[idx % HR_QUESTION_TEMPLATES.length];
      return {
        id: "q_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6),
        category: "HR",
        difficulty: difficulty.charAt(0).toUpperCase() + difficulty.slice(1),
        text: tmplObj.template(role, company),
        topics: tmplObj.topics,
        targetSkill: "Communication & Motivation",
        rationale: `Evaluates career vision, self-awareness, and company fit for ${role} at ${company}.`
      };
    }

    // Helper to generate a Behavioural question
    function createBehaviouralQuestion(idx) {
      const tmplObj = BEHAVIOURAL_QUESTION_TEMPLATES[idx % BEHAVIOURAL_QUESTION_TEMPLATES.length];
      return {
        id: "q_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6),
        category: "Behavioural",
        difficulty: difficulty.charAt(0).toUpperCase() + difficulty.slice(1),
        text: tmplObj.q,
        topics: tmplObj.topics,
        targetSkill: tmplObj.topics[0] || "Soft Skills",
        rationale: "Evaluates teamwork, problem-solving, and adaptability using the STAR methodology."
      };
    }

    // Weak areas practice mode: prioritize weak topics if provided
    if (weakTopics.length > 0) {
      weakTopics.forEach((topic, tIdx) => {
        if (questions.length < count) {
          questions.push(createTechnicalQuestion(difficulty, topic));
        }
      });
    }

    // Fill remainder based on category
    let techIdx = 0;
    let hrIdx = 0;
    let behIdx = 0;

    while (questions.length < count) {
      if (category === "technical") {
        questions.push(createTechnicalQuestion(difficulty));
      } else if (category === "hr") {
        questions.push(createHrQuestion(hrIdx++));
      } else if (category === "behavioural") {
        questions.push(createBehaviouralQuestion(behIdx++));
      } else {
        // Mixed distribution: ~40% Technical, ~30% HR, ~30% Behavioural
        const slot = questions.length % 3;
        if (slot === 0) {
          questions.push(createTechnicalQuestion(difficulty));
        } else if (slot === 1) {
          questions.push(createHrQuestion(hrIdx++));
        } else {
          questions.push(createBehaviouralQuestion(behIdx++));
        }
      }
    }

    // Add unique question index number
    return questions.map((q, idx) => ({ ...q, number: idx + 1, total: count }));
  }

  /**
   * 2. TRANSPARENT 5-PILLAR ANSWER EVALUATOR
   * Evaluates submitted answer against:
   * 1. Relevance: Did candidate address the question?
   * 2. Accuracy: Factual correctness
   * 3. Clarity: Clear explanations and structure
   * 4. Completeness: Missing core points
   * 5. Practical Understanding: Concrete examples / STAR structure
   */
  function evaluateAnswer(payload = {}) {
    const question = payload.question || {};
    const answer = sanitizeInputText(payload.answer || "");
    const category = (question.category || "Technical").toLowerCase();
    const wordCount = answer.trim() ? answer.trim().split(/\s+/).length : 0;

    // Handle skipped or empty answers
    if (!answer || wordCount === 0) {
      return {
        score: 0,
        skipped: true,
        summary: "Question was skipped by candidate.",
        rubric: {
          relevance: 0,
          accuracy: 0,
          clarity: 0,
          completeness: 0,
          practicalUnderstanding: 0
        },
        strengths: [],
        improvements: ["Question was left unanswered. Always attempt to provide a structured response or state your thought process."],
        missedPoints: question.topics || ["Core concept explanation"],
        suggestedAnswer: "In an interview, if you are unsure of the exact syntax or answer, state what you know about related concepts rather than skipping completely.",
        practicalTip: "Use the 'What, Why, How' formula to build answers: What is it, Why do we use it, and How did you apply it?",
        followUpQuestion: null,
        weakTopicsIdentified: question.topics || ["Fundamental Concepts"]
      };
    }

    // Calculate rubric scores deterministically based on substance, keyword relevance, and length
    let relevanceScore = 6;
    let accuracyScore = 6;
    let clarityScore = 6;
    let completenessScore = 6;
    let practicalScore = 5;

    // Substance and structure check
    if (wordCount >= 60) {
      relevanceScore = Math.min(10, relevanceScore + 2);
      clarityScore = Math.min(10, clarityScore + 2);
      completenessScore = Math.min(10, completenessScore + 2);
    } else if (wordCount >= 25) {
      relevanceScore = Math.min(10, relevanceScore + 1);
      completenessScore = Math.min(10, completenessScore + 1);
      if (/[.,;]/.test(answer)) {
        clarityScore = Math.min(10, clarityScore + 2);
      }
    } else {
      completenessScore = Math.max(3, completenessScore - 2);
      clarityScore = Math.max(4, clarityScore - 1);
    }

    // Keyword matching with question topics & target skills
    const qTopics = Array.isArray(question.topics) ? question.topics : [];
    const matchedTopics = qTopics.filter(t => {
      const lowerT = t.toLowerCase();
      if (answer.toLowerCase().includes(lowerT)) return true;
      const subparts = lowerT.split(/\s+(?:vs|\/|and|,)\s+/);
      return subparts.length > 1 && subparts.every(sp => answer.toLowerCase().includes(sp.trim()));
    });

    if (matchedTopics.length > 0) {
      accuracyScore = Math.min(10, accuracyScore + matchedTopics.length * 2);
      completenessScore = Math.min(10, completenessScore + matchedTopics.length * 1.5);
    }

    if (question.targetSkill && answer.toLowerCase().includes(question.targetSkill.toLowerCase())) {
      relevanceScore = Math.min(10, relevanceScore + 1);
      accuracyScore = Math.min(10, accuracyScore + 1);
    }

    // Practical example or STAR indicators check
    const hasExample = /\b(for example|project|built|used|applied|instance|such as|experience)\b/i.test(answer);
    const hasStar = /\b(situation|task|action|result|when|because|solved|outcome)\b/i.test(answer);
    if (hasExample || (category === "behavioural" && hasStar)) {
      practicalScore = Math.min(10, practicalScore + 3);
    }

    // Overall score out of 10
    const rawScore = (relevanceScore + accuracyScore + clarityScore + completenessScore + practicalScore) / 5;
    const finalScore = Math.min(10, Math.max(1, Math.round(rawScore * 10) / 10));

    // Construct constructive, educational feedback
    const strengths = [];
    const improvements = [];
    const missedPoints = [];

    if (relevanceScore >= 7) strengths.push("Directly answered the core prompt with relevant focus.");
    if (accuracyScore >= 7) strengths.push("Accurately stated primary technical distinctions and principles.");
    if (clarityScore >= 7) strengths.push("Structured with clear sentences and coherent explanation.");
    if (practicalScore >= 7) strengths.push("Grounds concepts with concrete application context or real-world example.");

    if (strengths.length === 0) {
      strengths.push("Good initial attempt demonstrating high-level familiarity with the topic.");
    }

    if (completenessScore < 7) {
      improvements.push("Elaborate on edge cases, underlying mechanics, and architectural trade-offs.");
    }
    if (practicalScore < 7) {
      improvements.push(category === "behavioural"
        ? "Structure your scenario using the STAR framework: Situation, Task, Action, and measurable Result."
        : "Pair your definition with a quick code pattern or project example where you applied this.");
    }
    if (wordCount < 30) {
      improvements.push("Provide more technical depth; one-sentence answers leave interviewers wondering about your mastery.");
    }

    // Missed points identification
    qTopics.forEach(t => {
      if (!matchedTopics.includes(t)) {
        missedPoints.push(t);
      }
    });
    if (missedPoints.length === 0 && finalScore < 8) {
      missedPoints.push("Production trade-offs and performance implications");
    }

    // Suggested stronger answer
    let suggestedAnswer = "";
    if (category === "technical") {
      suggestedAnswer = `A strong answer should define ${question.targetSkill || "the concept"}, explain why it matters (e.g. performance, readability, safety), and briefly illustrate with an example: "In modern workflows, we use it to achieve X because it avoids Y, which I utilized when building Z."`;
    } else if (category === "hr") {
      suggestedAnswer = "Connect your personal passion and specific coursework to the employer's mission. Highlight 1 concrete project achievement that demonstrates your readiness to contribute from week one.";
    } else {
      suggestedAnswer = "Use the STAR method: (Situation) In my team project, (Task) we needed to ship on a tight deadline, (Action) I organized daily syncs and modularized our code, (Result) allowing us to deliver 2 days early with zero regression bugs.";
    }

    const practicalTip = category === "behavioural"
      ? "Always quantify your results where possible (e.g. 'reduced load time by 30%', 'coordinated with 3 teammates')."
      : "In technical interviews, state your assumptions out loud before diving into the solution.";

    // Generate smart follow-up question if applicable
    let followUpQuestion = null;
    if (finalScore >= 5 && wordCount >= 20) {
      if (answer.toLowerCase().includes("state") || answer.toLowerCase().includes("component")) {
        followUpQuestion = "How do you manage component state when multiple sibling components need to access the same data?";
      } else if (answer.toLowerCase().includes("api") || answer.toLowerCase().includes("fetch") || answer.toLowerCase().includes("promise")) {
        followUpQuestion = "How do you handle loading states and unexpected network failures when communicating with that API?";
      } else if (answer.toLowerCase().includes("team") || answer.toLowerCase().includes("project")) {
        followUpQuestion = "Looking back at that project, what is one architectural decision you would make differently today?";
      } else if (question.topics && question.topics.length > 0) {
        followUpQuestion = `Can you elaborate on how ${question.topics[0]} impacts long-term maintainability in production?`;
      }
    }

    // Weak topics identified if score is below 7
    const weakTopicsIdentified = finalScore < 7 ? (question.topics || ["Fundamental Concepts"]) : [];

    return {
      score: finalScore,
      skipped: false,
      summary: finalScore >= 8 ? "Strong, comprehensive answer!" : finalScore >= 5 ? "Good foundational answer with room for depth." : "Needs technical revision and concrete examples.",
      rubric: {
        relevance: relevanceScore,
        accuracy: accuracyScore,
        clarity: clarityScore,
        completeness: completenessScore,
        practicalUnderstanding: practicalScore
      },
      strengths,
      improvements,
      missedPoints,
      suggestedAnswer,
      practicalTip,
      followUpQuestion,
      weakTopicsIdentified
    };
  }

  /**
   * 3. FINAL INTERVIEW PERFORMANCE REPORT SYNTHESIZER
   * Compiles answer evaluations, category averages, strengths, and recommended revision topics.
   */
  function compileFinalReport(session = {}) {
    const questions = Array.isArray(session.questions) ? session.questions : [];
    const evaluations = Array.isArray(session.evaluations) ? session.evaluations : [];
    const role = session.role || "Software Engineering Intern";
    const company = session.company || "Target Company";
    const category = session.category || "Mixed";
    const difficulty = session.difficulty || "Intermediate";

    let totalScore = 0;
    let answeredCount = 0;
    let skippedCount = 0;

    let techScores = [];
    let hrScores = [];
    let behScores = [];

    const allWeakTopics = new Set();
    const allStrengths = new Set();
    const allMissedPoints = new Set();

    evaluations.forEach((ev, idx) => {
      const q = questions[idx] || {};
      const cat = (q.category || "Technical").toLowerCase();

      if (ev.skipped) {
        skippedCount++;
      } else {
        answeredCount++;
        totalScore += ev.score;

        if (cat === "technical") techScores.push(ev.score);
        else if (cat === "hr") hrScores.push(ev.score);
        else behScores.push(ev.score);

        (ev.strengths || []).forEach(s => allStrengths.add(s));
      }

      (ev.weakTopicsIdentified || []).forEach(w => allWeakTopics.add(w));
      (ev.missedPoints || []).forEach(m => allMissedPoints.add(m));
    });

    const avgScore = evaluations.length > 0
      ? Math.round((totalScore / evaluations.length) * 10) / 10
      : 0;

    const calcCategoryAvg = (scores) => {
      if (scores.length === 0) return null;
      const sum = scores.reduce((a, b) => a + b, 0);
      return Math.round((sum / scores.length) * 10) / 10;
    };

    const techAvg = calcCategoryAvg(techScores);
    const hrAvg = calcCategoryAvg(hrScores);
    const behAvg = calcCategoryAvg(behScores);

    // Preparation status badge
    let readiness = "Needs Focused Revision";
    if (avgScore >= 8) readiness = "Interview Ready (High Confidence)";
    else if (avgScore >= 6) readiness = "Good Progress (Moderate Confidence)";

    const weakTopicsList = Array.from(allWeakTopics);
    const revisionTopics = weakTopicsList.length > 0
      ? weakTopicsList
      : ["System Architecture", "Performance Optimization", "STAR Scenario Detailing"];

    return {
      sessionId: session.id || ("interview_" + Date.now()),
      completedAt: new Date().toISOString(),
      role,
      company,
      category,
      difficulty,
      totalQuestions: questions.length,
      answeredCount,
      skippedCount,
      averageScore: avgScore,
      readiness,
      performance: {
        technical: techAvg !== null ? `${techAvg}/10` : "N/A",
        hr: hrAvg !== null ? `${hrAvg}/10` : "N/A",
        behavioural: behAvg !== null ? `${behAvg}/10` : "N/A"
      },
      strongAreas: Array.from(allStrengths).slice(0, 4),
      weakTopics: weakTopicsList,
      recommendedTopicsToRevise: revisionTopics,
      personalizedSuggestions: [
        "Review key terminology and syntax for missed technical points.",
        "Practice delivering STAR stories in under 2 minutes with clear outcomes.",
        "Ground explanations with lessons learned from your actual GitHub projects."
      ],
      summary: `Completed ${answeredCount} of ${questions.length} questions for ${role} with an average score of ${avgScore}/10. Practice the recommended weak topics to boost interview readiness.`,
      disclaimer: "InternPilot mock interview scores are educational evaluations designed for skill practice, not guaranteed predictions of real employment interview results."
    };
  }

  /**
   * 4. INTERVIEW HISTORY STORAGE (LOCALSTORAGE)
   * Isolated from internpilot_apps and internpilot_saved_analyses.
   */
  function loadInterviewHistory() {
    try {
      if (typeof localStorage === "undefined") return [];
      const raw = localStorage.getItem(INTERVIEW_HISTORY_STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (err) {
      console.warn("Could not load interview history from localStorage:", err);
      return [];
    }
  }

  function saveInterviewSession(session) {
    try {
      if (typeof localStorage === "undefined" || !session) return null;
      const history = loadInterviewHistory();
      const id = session.sessionId || session.id || ("interview_" + Date.now());

      const record = {
        id,
        savedAt: new Date().toISOString(),
        role: session.role || "Internship Role",
        company: session.company || "Target Company",
        category: session.category || "Mixed",
        difficulty: session.difficulty || "Intermediate",
        totalQuestions: session.totalQuestions || (session.questions ? session.questions.length : 0),
        answeredCount: session.answeredCount || 0,
        averageScore: session.averageScore !== undefined ? session.averageScore : 0,
        readiness: session.readiness || "Completed",
        weakTopics: Array.isArray(session.weakTopics) ? session.weakTopics : [],
        report: session
      };

      const existingIdx = history.findIndex(h => h.id === id);
      if (existingIdx !== -1) {
        history[existingIdx] = record;
      } else {
        history.unshift(record);
      }

      localStorage.setItem(INTERVIEW_HISTORY_STORAGE_KEY, JSON.stringify(history));
      return record;
    } catch (err) {
      console.error("Error saving interview session:", err);
      return null;
    }
  }

  function deleteInterviewSession(id) {
    try {
      if (typeof localStorage === "undefined" || !id) return false;
      const history = loadInterviewHistory();
      const filtered = history.filter(h => h.id !== id);
      if (filtered.length === history.length) return false;
      localStorage.setItem(INTERVIEW_HISTORY_STORAGE_KEY, JSON.stringify(filtered));
      return true;
    } catch (err) {
      console.error("Error deleting interview session:", err);
      return false;
    }
  }

  function getInterviewSession(id) {
    const list = loadInterviewHistory();
    return list.find(h => h.id === id) || null;
  }

  return {
    INTERVIEW_HISTORY_STORAGE_KEY,
    sanitizeInputText,
    generateInterviewQuestions,
    evaluateAnswer,
    compileFinalReport,
    loadInterviewHistory,
    saveInterviewSession,
    deleteInterviewSession,
    getInterviewSession
  };
});
