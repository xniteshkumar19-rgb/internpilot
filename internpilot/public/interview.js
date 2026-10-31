// Mobile sidebar toggle
document.addEventListener("DOMContentLoaded", () => {
  const mobileMenuToggle = document.getElementById("mobile-menu-toggle");
  const appSidebar = document.getElementById("app-sidebar");
  const sidebarBackdrop = document.getElementById("sidebar-backdrop");
  const sidebarCloseBtn = document.getElementById("sidebar-close-btn");

  if (mobileMenuToggle && appSidebar) {
    mobileMenuToggle.addEventListener("click", () => {
      appSidebar.classList.add("open");
      if (sidebarBackdrop) sidebarBackdrop.classList.add("active");
    });
  }
  if (sidebarCloseBtn && appSidebar) {
    sidebarCloseBtn.addEventListener("click", () => {
      appSidebar.classList.remove("open");
      if (sidebarBackdrop) sidebarBackdrop.classList.remove("active");
    });
  }
  if (sidebarBackdrop && appSidebar) {
    sidebarBackdrop.addEventListener("click", () => {
      appSidebar.classList.remove("open");
      sidebarBackdrop.classList.remove("active");
    });
  }
  if (appSidebar) {
    appSidebar.querySelectorAll(".sidebar-nav-item").forEach(item => {
      item.addEventListener("click", () => {
        if (window.innerWidth <= 992) {
          appSidebar.classList.remove("open");
          if (sidebarBackdrop) sidebarBackdrop.classList.remove("active");
        }
      });
    });
  }
});
/**
 * InternPilot - AI Interview Mock Studio Frontend Controller
 *
 * Manages:
 * - Studio Dashboard, Category Selection & Prefill Integration
 * - Interactive Question Delivery & Answer Submission
 * - Real-time 5-Pillar Rubric Answer Evaluation & Follow-Up Questions
 * - Final Performance Report Compilation & Weak Areas Practice Drill
 * - Interview History Persistence & Analytics
 */

document.addEventListener("DOMContentLoaded", () => {
  // Navigation & View containers
  const viewDashboard = document.getElementById("view-dashboard");
  const viewInterview = document.getElementById("view-interview");
  const viewReport = document.getElementById("view-report");

  // Inputs & Configuration
  const inputRole = document.getElementById("input-role");
  const inputCompany = document.getElementById("input-company");
  const inputResumeContext = document.getElementById("input-resume-context");
  const selectDifficulty = document.getElementById("select-difficulty");
  const selectCount = document.getElementById("select-count");
  const studioDemoToggle = document.getElementById("studio-demo-toggle");
  const btnPrefillSample = document.getElementById("btn-prefill-sample");
  const loadSampleResumeBtn = document.getElementById("load-sample-resume-btn");
  const liveEvalLoading = document.getElementById("live-eval-loading");
  const liveInterviewError = document.getElementById("live-interview-error");
  const interviewErrorTitle = document.getElementById("interview-error-title");
  const interviewErrorDesc = document.getElementById("interview-error-desc");
  const btnRetryEval = document.getElementById("btn-retry-eval");
  const btnStartInterview = document.getElementById("btn-start-interview");

  // Category Selector Cards
  const categoryCards = document.querySelectorAll(".category-card");

  // Live Interview Elements
  const liveCatBadge = document.getElementById("live-cat-badge");
  const liveDiffBadge = document.getElementById("live-diff-badge");
  const liveRoleText = document.getElementById("live-role-text");
  const liveQCounter = document.getElementById("live-q-counter");
  const livePctCounter = document.getElementById("live-pct-counter");
  const liveProgressBarFill = document.getElementById("live-progress-bar-fill");
  const liveQNum = document.getElementById("live-q-num");
  const liveQText = document.getElementById("live-q-text");
  const liveQTags = document.getElementById("live-q-tags");
  const liveQRationale = document.getElementById("live-q-rationale");
  const answerFormWrap = document.getElementById("answer-form-wrap");
  const studentAnswerInput = document.getElementById("student-answer-input");
  const answerCharCount = document.getElementById("answer-char-count");
  const btnSubmitAnswer = document.getElementById("btn-submit-answer");
  const btnSkipQuestion = document.getElementById("btn-skip-question");
  const btnExitSession = document.getElementById("btn-exit-session");

  // Evaluation Card Elements
  const liveEvalCard = document.getElementById("live-eval-card");
  const evalScoreNum = document.getElementById("eval-score-num");
  const evalScoreBadge = document.getElementById("eval-score-badge");
  const evalSummaryTitle = document.getElementById("eval-summary-title");
  const evalSummaryDesc = document.getElementById("eval-summary-desc");
  const rRelevanceVal = document.getElementById("r-relevance-val");
  const rRelevanceFill = document.getElementById("r-relevance-fill");
  const rAccuracyVal = document.getElementById("r-accuracy-val");
  const rAccuracyFill = document.getElementById("r-accuracy-fill");
  const rClarityVal = document.getElementById("r-clarity-val");
  const rClarityFill = document.getElementById("r-clarity-fill");
  const rCompletenessVal = document.getElementById("r-completeness-val");
  const rCompletenessFill = document.getElementById("r-completeness-fill");
  const rPracticalVal = document.getElementById("r-practical-val");
  const rPracticalFill = document.getElementById("r-practical-fill");
  const evalStrengthsList = document.getElementById("eval-strengths-list");
  const evalImprovementsList = document.getElementById("eval-improvements-list");
  const evalMissedBox = document.getElementById("eval-missed-box");
  const evalMissedText = document.getElementById("eval-missed-text");
  const evalModelAnswerText = document.getElementById("eval-model-answer-text");
  const evalPracticalTipText = document.getElementById("eval-practical-tip-text");
  const evalFollowupBanner = document.getElementById("eval-followup-banner");
  const evalFollowupQText = document.getElementById("eval-followup-q-text");
  const btnNextQuestion = document.getElementById("btn-next-question");

  // Report Elements
  const repMetaSub = document.getElementById("rep-meta-sub");
  const repScoreNum = document.getElementById("rep-score-num");
  const repTechVal = document.getElementById("rep-tech-val");
  const repHrVal = document.getElementById("rep-hr-val");
  const repBehVal = document.getElementById("rep-beh-val");
  const repReadinessVal = document.getElementById("rep-readiness-val");
  const repStrengthsList = document.getElementById("rep-strengths-list");
  const repWeaknessesList = document.getElementById("rep-weaknesses-list");
  const repRevisionPills = document.getElementById("rep-revision-pills");
  const repSummaryText = document.getElementById("rep-summary-text");
  const btnPracticeWeak = document.getElementById("btn-practice-weak");
  const btnRetryInterview = document.getElementById("btn-retry-interview");
  const btnReturnDashboard = document.getElementById("btn-return-dashboard");

  // Top Analytics Banner
  const statTotalInterviews = document.getElementById("stat-total-interviews");
  const statAvgScore = document.getElementById("stat-avg-score");
  const statReadinessLabel = document.getElementById("stat-readiness-label");
  const statTechScore = document.getElementById("stat-tech-score");
  const statHrScore = document.getElementById("stat-hr-score");
  const statWeakCount = document.getElementById("stat-weak-count");
  const previousInterviewsList = document.getElementById("previous-interviews-list");
  const badgeHistoryCount = document.getElementById("badge-history-count");

  // Current Active Session State
  let sessionState = {
    active: false,
    questions: [],
    currentIndex: 0,
    answers: [],
    evaluations: [],
    role: "",
    company: "",
    category: "mixed",
    difficulty: "intermediate",
    weakTopics: [],
    finalReport: null
  };

  function switchView(viewName) {
    viewDashboard.style.display = viewName === "dashboard" ? "grid" : "none";
    viewInterview.style.display = viewName === "interview" ? "block" : "none";
    viewReport.style.display = viewName === "report" ? "block" : "none";
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // Escape HTML helper
  function escapeHtml(str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  // 1. Check for incoming prefill data from CareerMatch (SessionStorage)
  function checkPrefillData() {
    try {
      const prefillRaw = sessionStorage.getItem("internpilot_interview_prefill");
      if (prefillRaw) {
        const p = JSON.parse(prefillRaw);
        if (p.role) inputRole.value = p.role;
        if (p.company) inputCompany.value = p.company;
        if (p.resumeText) inputResumeContext.value = p.resumeText;
        if (p.weakTopics && p.weakTopics.length > 0) {
          sessionState.weakTopics = p.weakTopics;
        }
        sessionStorage.removeItem("internpilot_interview_prefill");
      }
      // If no prefill in sessionStorage, check saved analyses
      if (!inputRole.value) {
        const savedRaw = localStorage.getItem("internpilot_saved_analyses");
        if (savedRaw) {
          const list = JSON.parse(savedRaw);
          if (Array.isArray(list) && list.length > 0) {
            const latest = list[0];
            if (latest.role && !inputRole.value) inputRole.value = latest.role;
            if (latest.company && !inputCompany.value) inputCompany.value = latest.company;
            if (latest.resumeText && !inputResumeContext.value) inputResumeContext.value = latest.resumeText;
            if (Array.isArray(latest.weakTopics) && latest.weakTopics.length > 0) {
              sessionState.weakTopics = latest.weakTopics;
            }
          }
        }
      }
    } catch {}
  }

  // 2. Category selection interaction
  categoryCards.forEach(card => {
    card.addEventListener("click", () => {
      categoryCards.forEach(c => c.classList.remove("active"));
      card.classList.add("active");
      const radio = card.querySelector("input[type='radio']");
      if (radio) radio.checked = true;
    });
  });

  function getSelectedCategory() {
    const checked = document.querySelector("input[name='interview-cat']:checked");
    return checked ? checked.value : "mixed";
  }

  // 3. Prefill Sample Button
  if (btnPrefillSample) {
    btnPrefillSample.addEventListener("click", async () => {
      inputRole.value = "Frontend Engineering Intern";
      inputCompany.value = "Vanguard Data Labs";

      try {
        const res = await fetch("/api/sample-resume");
        if (res.ok) {
          inputResumeContext.value = await res.text();
        } else {
          inputResumeContext.value = "Rohan Sharma - 1st Year CS Student. Skills: JavaScript, React, HTML, CSS, Git. Projects: Task Manager, Weather App.";
        }
      } catch {
        inputResumeContext.value = "Rohan Sharma - 1st Year CS Student. Skills: JavaScript, React, HTML, CSS, Git. Projects: Task Manager, Weather App.";
      }
    });
  }


  // Wire Load Sample Resume Button
  if (loadSampleResumeBtn) {
    loadSampleResumeBtn.addEventListener("click", async () => {
      loadSampleResumeBtn.disabled = true;
      try {
        const res = await fetch("/api/sample-resume");
        if (res.ok) {
          inputResumeContext.value = await res.text();
        } else {
          const res2 = await fetch("/sample-resume.txt");
          inputResumeContext.value = await res2.text();
        }
      } catch {
        try {
          const res2 = await fetch("/sample-resume.txt");
          inputResumeContext.value = await res2.text();
        } catch {
          inputResumeContext.value = "ROHAN SHARMA - Computer Science Student. Skills: JavaScript, React, HTML, CSS, Git.";
        }
      }
      if (!inputRole.value) inputRole.value = "Junior Web Developer Intern";
      if (!inputCompany.value) inputCompany.value = "Apex Cloud Technologies";
      loadSampleResumeBtn.disabled = false;
    });
  }

  // Wire Retry Evaluation Button
  if (btnRetryEval) {
    btnRetryEval.addEventListener("click", () => {
      if (liveInterviewError) liveInterviewError.style.display = "none";
      btnSubmitAnswer.click();
    });
  }

  // 4. Live Answer Word Counter
  if (studentAnswerInput && answerCharCount) {
    studentAnswerInput.addEventListener("input", () => {
      const text = studentAnswerInput.value.trim();
      const words = text ? text.split(/\s+/).length : 0;
      answerCharCount.textContent = `${words} word${words === 1 ? '' : 's'}`;
    });
  }

  // 5. Start Interview Handler
  btnStartInterview.addEventListener("click", async () => {
    const role = inputRole.value.trim() || "Software Engineering Intern";
    const company = inputCompany.value.trim() || "Acme Tech Labs";
    const resumeText = inputResumeContext.value.trim();
    const category = getSelectedCategory();
    const difficulty = selectDifficulty.value;
    const count = parseInt(selectCount.value, 10) || 5;
    const isDemoMode = !!(studioDemoToggle && studioDemoToggle.checked);

    btnStartInterview.disabled = true;
    btnStartInterview.textContent = "Generating Personalized Interview...";

    try {
      let questions = [];

      // Try Backend endpoint /api/interview/generate
      try {
        const res = await fetch("/api/interview/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            role,
            company,
            resumeText,
            category,
            difficulty,
            count,
            weakTopics: sessionState.weakTopics,
            demoMode: isDemoMode
          })
        });

        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.questions) && data.questions.length > 0) {
            questions = data.questions;
          }
        }
      } catch (err) {
        console.warn("Backend interview generation endpoint unavailable, using local engine:", err);
      }

      // Fallback to local engine
      if (questions.length === 0 && typeof InterviewEngine !== "undefined") {
        questions = InterviewEngine.generateInterviewQuestions({
          role,
          company,
          resumeText,
          category,
          difficulty,
          count,
          weakTopics: sessionState.weakTopics
        });
      }

      if (questions.length === 0) {
        alert("Could not initialize interview questions. Please try again.");
        return;
      }

      // Initialize session state
      sessionState = {
        active: true,
        questions,
        currentIndex: 0,
        answers: [],
        evaluations: [],
        role,
        company,
        category,
        difficulty,
        weakTopics: sessionState.weakTopics || [],
        finalReport: null
      };

      liveRoleText.textContent = `${role} at ${company}`;
      liveCatBadge.textContent = category.toUpperCase();
      liveDiffBadge.textContent = difficulty.toUpperCase();

      renderCurrentQuestion();
      switchView("interview");
    } catch (err) {
      console.error("Failed to start interview:", err);
      alert("An unexpected error occurred while starting the interview.");
    } finally {
      btnStartInterview.disabled = false;
      btnStartInterview.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
        Start Interview
      `;
    }
  });

  // 6. Render Current Question in Live Interview
  function renderCurrentQuestion() {
    const q = sessionState.questions[sessionState.currentIndex];
    if (!q) return;

    const total = sessionState.questions.length;
    const currentNum = sessionState.currentIndex + 1;
    const pct = Math.round((sessionState.currentIndex / total) * 100);

    liveQCounter.textContent = `Question ${currentNum} of ${total}`;
    livePctCounter.textContent = `${pct}% Completed`;
    liveProgressBarFill.style.width = `${pct}%`;

    liveQNum.textContent = `Q${currentNum}`;
    liveQText.textContent = q.text;

    // Tags
    const tags = Array.isArray(q.topics) ? q.topics : [q.targetSkill || "Interview Concept"];
    liveQTags.innerHTML = tags.map(t => `<span class="topic-tag">${escapeHtml(t)}</span>`).join("");

    // Rationale
    liveQRationale.innerHTML = `💡 <strong>Context:</strong> ${escapeHtml(q.rationale || "Personalized for your target internship role.")}`;

    // Reset Answer Input Form
    studentAnswerInput.value = "";
    answerCharCount.textContent = "0 words";
    answerFormWrap.style.display = "block";
    btnSubmitAnswer.disabled = false;
    btnSubmitAnswer.textContent = "Submit Answer for Evaluation";

    // Hide Evaluation Card
    liveEvalCard.style.display = "none";
    evalFollowupBanner.style.display = "none";
    studentAnswerInput.focus();
  }

  // 7. Answer Submission & Evaluation Handler
  btnSubmitAnswer.addEventListener("click", async () => {
    const answer = studentAnswerInput.value.trim();
    if (!answer) {
      alert("Please type your answer before submitting, or click 'Skip Question'.");
      studentAnswerInput.focus();
      return;
    }

    const q = sessionState.questions[sessionState.currentIndex];
    const isDemoMode = !!(studioDemoToggle && studioDemoToggle.checked);

    btnSubmitAnswer.disabled = true;
    btnSubmitAnswer.textContent = "Evaluating Answer with Rubric...";
    if (liveEvalLoading) liveEvalLoading.style.display = "block";
    if (liveInterviewError) liveInterviewError.style.display = "none";
    if (liveEvalCard) liveEvalCard.style.display = "none";

    let evaluation = null;

    // Try backend /api/interview/evaluate
    try {
      const res = await fetch("/api/interview/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: q,
          answer,
          demoMode: isDemoMode
        })
      });

      if (res.ok) {
        const data = await res.json();
        if (data.evaluation && typeof data.evaluation.score === "number") {
          evaluation = data.evaluation;
        }
      }
    } catch (e) {
      console.warn("Backend evaluation endpoint failed, using local engine:", e);
    }

    // Fallback to local engine
    if (!evaluation && typeof InterviewEngine !== "undefined") {
      evaluation = InterviewEngine.evaluateAnswer({
        question: q,
        answer
      });
    }

    if (!evaluation) {
      evaluation = {
        score: 6.0,
        summary: "Answer submitted successfully.",
        rubric: { relevance: 6, accuracy: 6, clarity: 6, completeness: 6, practicalUnderstanding: 6 },
        strengths: ["Clear attempt addressing the question prompt."],
        improvements: ["Elaborate on edge cases and concrete examples."],
        missedPoints: ["Underlying trade-offs"],
        suggestedAnswer: "Structure responses clearly with definitions and project examples.",
        practicalTip: "Use the STAR method for experiential questions.",
        followUpQuestion: null,
        weakTopicsIdentified: []
      };
    }

    // Store in session
    sessionState.answers[sessionState.currentIndex] = answer;
    sessionState.evaluations[sessionState.currentIndex] = evaluation;

    if (liveEvalLoading) liveEvalLoading.style.display = "none";
    btnSubmitAnswer.disabled = false;
    btnSubmitAnswer.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg> Submit Answer for Evaluation`;
    displayEvaluationResult(evaluation);
  });

  // 8. Skip Question Handler
  btnSkipQuestion.addEventListener("click", () => {
    const q = sessionState.questions[sessionState.currentIndex];
    let evaluation = null;

    if (typeof InterviewEngine !== "undefined") {
      evaluation = InterviewEngine.evaluateAnswer({ question: q, answer: "" });
    } else {
      evaluation = {
        score: 0,
        skipped: true,
        summary: "Question skipped.",
        rubric: { relevance: 0, accuracy: 0, clarity: 0, completeness: 0, practicalUnderstanding: 0 },
        strengths: [],
        improvements: ["Always attempt to structure an answer in an interview."],
        missedPoints: q.topics || [],
        suggestedAnswer: "Even if unsure, state your thought process out loud.",
        practicalTip: "Interviewers appreciate candidates who work through unfamiliar problems collaboratively.",
        followUpQuestion: null,
        weakTopicsIdentified: q.topics || []
      };
    }

    sessionState.answers[sessionState.currentIndex] = "";
    sessionState.evaluations[sessionState.currentIndex] = evaluation;

    displayEvaluationResult(evaluation);
  });

  // 9. Display Evaluation Result Card
  function displayEvaluationResult(ev) {
    answerFormWrap.style.display = "none";

    evalScoreNum.textContent = ev.score.toFixed(1);
    if (ev.score >= 8) {
      evalScoreBadge.className = "eval-score-badge score-high";
    } else if (ev.score >= 5) {
      evalScoreBadge.className = "eval-score-badge score-med";
    } else {
      evalScoreBadge.className = "eval-score-badge score-low";
    }

    evalSummaryTitle.textContent = ev.summary || (ev.score >= 8 ? "Strong, comprehensive answer!" : "Answer evaluated.");
    evalSummaryDesc.textContent = ev.skipped ? "You skipped this question. Review the suggested response structure below." : "Evaluation based on relevance, accuracy, clarity, and practical depth.";

    // 5-Pillar Rubric
    const r = ev.rubric || { relevance: 5, accuracy: 5, clarity: 5, completeness: 5, practicalUnderstanding: 5 };
    rRelevanceVal.textContent = `${r.relevance}/10`;
    rRelevanceFill.style.width = `${r.relevance * 10}%`;

    rAccuracyVal.textContent = `${r.accuracy}/10`;
    rAccuracyFill.style.width = `${r.accuracy * 10}%`;

    rClarityVal.textContent = `${r.clarity}/10`;
    rClarityFill.style.width = `${r.clarity * 10}%`;

    rCompletenessVal.textContent = `${r.completeness}/10`;
    rCompletenessFill.style.width = `${r.completeness * 10}%`;

    rPracticalVal.textContent = `${r.practicalUnderstanding}/10`;
    rPracticalFill.style.width = `${r.practicalUnderstanding * 10}%`;

    // Strengths & Improvements
    evalStrengthsList.innerHTML = (ev.strengths && ev.strengths.length > 0)
      ? ev.strengths.map(s => `<li>${escapeHtml(s)}</li>`).join("")
      : `<li>Initial attempt addressing the question.</li>`;

    evalImprovementsList.innerHTML = (ev.improvements && ev.improvements.length > 0)
      ? ev.improvements.map(i => `<li>${escapeHtml(i)}</li>`).join("")
      : `<li>Continue practicing concise technical delivery.</li>`;

    // Missed Points
    if (ev.missedPoints && ev.missedPoints.length > 0) {
      evalMissedText.textContent = ev.missedPoints.join(", ");
      evalMissedBox.style.display = "block";
    } else {
      evalMissedBox.style.display = "none";
    }

    evalModelAnswerText.textContent = ev.suggestedAnswer || "Be sure to state what it is, why it is used, and share a practical project scenario.";
    evalPracticalTipText.textContent = ev.practicalTip || "Speak to trade-offs and real-world considerations.";

    // Follow-Up Question
    if (ev.followUpQuestion) {
      evalFollowupQText.textContent = `"${ev.followUpQuestion}"`;
      evalFollowupBanner.style.display = "block";
    } else {
      evalFollowupBanner.style.display = "none";
    }

    // Button label: "Next Question" or "View Final Performance Report"
    const isLast = sessionState.currentIndex >= sessionState.questions.length - 1;
    btnNextQuestion.textContent = isLast ? "View Final Performance Report →" : "Next Question →";

    liveEvalCard.style.display = "block";
    liveEvalCard.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  // 10. Next Question Button
  btnNextQuestion.addEventListener("click", () => {
    if (sessionState.currentIndex < sessionState.questions.length - 1) {
      sessionState.currentIndex++;
      renderCurrentQuestion();
    } else {
      finishInterviewSession();
    }
  });

  // 11. Finish Interview and Render Final Report
  function finishInterviewSession() {
    let report = null;
    if (typeof InterviewEngine !== "undefined") {
      report = InterviewEngine.compileFinalReport({
        questions: sessionState.questions,
        evaluations: sessionState.evaluations,
        role: sessionState.role,
        company: sessionState.company,
        category: sessionState.category,
        difficulty: sessionState.difficulty
      });
      InterviewEngine.saveInterviewSession(report);
    }

    sessionState.finalReport = report;

    // Populate Report View
    repMetaSub.textContent = `${sessionState.role} at ${sessionState.company} | Completed on ${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })}`;
    repScoreNum.textContent = report ? report.averageScore.toFixed(1) : "7.5";
    repTechVal.textContent = report ? report.performance.technical : "8/10";
    repHrVal.textContent = report ? report.performance.hr : "8/10";
    repBehVal.textContent = report ? report.performance.behavioural : "8/10";
    repReadinessVal.textContent = report ? report.readiness : "Good Progress";

    repStrengthsList.innerHTML = (report && report.strongAreas && report.strongAreas.length > 0)
      ? report.strongAreas.map(s => `<li>${escapeHtml(s)}</li>`).join("")
      : `<li>Demonstrated foundational knowledge and prompt compliance.</li>`;

    repWeaknessesList.innerHTML = (report && report.weakTopics && report.weakTopics.length > 0)
      ? report.weakTopics.map(w => `<li>Targeted focus needed on <strong>${escapeHtml(w)}</strong></li>`).join("")
      : `<li>Solid performance across all questions. Practice advanced system design.</li>`;

    repRevisionPills.innerHTML = (report && report.recommendedTopicsToRevise && report.recommendedTopicsToRevise.length > 0)
      ? report.recommendedTopicsToRevise.map(t => `<span class="revision-pill">${escapeHtml(t)}</span>`).join("")
      : `<span class="revision-pill">Core Architecture</span>`;

    repSummaryText.textContent = report ? report.summary : "Interview completed.";

    updateHistoryAndStats();
    switchView("report");
  }

  // 12. Practice Weak Areas Button Handler
  btnPracticeWeak.addEventListener("click", () => {
    const report = sessionState.finalReport;
    const weak = report && report.weakTopics && report.weakTopics.length > 0
      ? report.weakTopics
      : ["JavaScript Promises", "React Component Lifecycle", "System Debugging"];

    sessionState.weakTopics = weak;
    inputRole.value = sessionState.role;
    inputCompany.value = sessionState.company;

    // Auto-trigger a 5-question technical drill down targeting weak topics
    const questions = InterviewEngine.generateInterviewQuestions({
      role: sessionState.role,
      company: sessionState.company,
      category: "technical",
      difficulty: sessionState.difficulty,
      count: 5,
      weakTopics: weak
    });

    sessionState = {
      active: true,
      questions,
      currentIndex: 0,
      answers: [],
      evaluations: [],
      role: sessionState.role,
      company: sessionState.company,
      category: "technical (Weak Areas Drill)",
      difficulty: sessionState.difficulty,
      weakTopics: weak,
      finalReport: null
    };

    liveRoleText.textContent = `${sessionState.role} (Targeted Weak Topics Drill)`;
    liveCatBadge.textContent = "WEAK AREAS DRILL";
    liveDiffBadge.textContent = sessionState.difficulty.toUpperCase();

    renderCurrentQuestion();
    switchView("interview");
  });

  // 13. Retry Interview Handler
  btnRetryInterview.addEventListener("click", () => {
    switchView("dashboard");
  });

  // 14. Return to Studio Dashboard Handler
  btnReturnDashboard.addEventListener("click", () => {
    switchView("dashboard");
  });

  // 15. Exit Session
  btnExitSession.addEventListener("click", () => {
    if (confirm("Are you sure you want to exit? Your current in-progress question responses will not be saved.")) {
      switchView("dashboard");
    }
  });

  // 16. Update History List & Top Practice Analytics
  function updateHistoryAndStats() {
    const history = typeof InterviewEngine !== "undefined" ? InterviewEngine.loadInterviewHistory() : [];

    // Update badge counter
    if (badgeHistoryCount) badgeHistoryCount.textContent = `${history.length} session${history.length === 1 ? '' : 's'}`;
    if (statTotalInterviews) statTotalInterviews.textContent = history.length;

    if (history.length === 0) {
      if (statAvgScore) statAvgScore.innerHTML = `--<small style="font-size: 0.95rem; font-weight: normal; color: var(--text-faint);">/10</small>`;
      if (statReadinessLabel) statReadinessLabel.textContent = "Ready to practice";
      if (statTechScore) statTechScore.textContent = "--";
      if (statHrScore) statHrScore.textContent = "--";
      if (statWeakCount) statWeakCount.textContent = "0";

      if (previousInterviewsList) {
        previousInterviewsList.innerHTML = `
          <div class="saved-empty-state">
            No interview sessions recorded yet. Start your first mock interview on the left!
          </div>
        `;
      }
      return;
    }

    // Compute averages
    const totalAvg = history.reduce((acc, h) => acc + (h.averageScore || 0), 0) / history.length;
    const roundedAvg = Math.round(totalAvg * 10) / 10;
    if (statAvgScore) statAvgScore.innerHTML = `${roundedAvg}<small style="font-size: 0.95rem; font-weight: normal; color: var(--text-faint);">/10</small>`;

    if (statReadinessLabel) {
      statReadinessLabel.textContent = roundedAvg >= 8 ? "High Confidence" : roundedAvg >= 6 ? "Moderate Confidence" : "Needs Revision";
    }

    const allWeak = new Set();
    history.forEach(h => {
      (h.weakTopics || []).forEach(w => allWeak.add(w));
    });
    if (statWeakCount) statWeakCount.textContent = allWeak.size;

    if (statTechScore) statTechScore.textContent = `${Math.min(10, Math.round(roundedAvg * 1.05 * 10) / 10)}/10`;
    if (statHrScore) statHrScore.textContent = `${Math.min(10, Math.round(roundedAvg * 0.98 * 10) / 10)}/10`;

    // Render Previous Interviews Cards
    if (previousInterviewsList) {
      previousInterviewsList.innerHTML = history.map(item => {
        const score = (item.averageScore !== undefined) ? item.averageScore.toFixed(1) : "0.0";
        let scoreClass = "score-low";
        if (item.averageScore >= 8) scoreClass = "score-high";
        else if (item.averageScore >= 5) scoreClass = "score-med";

        const dateStr = item.savedAt ? new Date(item.savedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "Recently";

        return `
          <div class="prev-interview-item" data-id="${escapeHtml(item.id)}">
            <div class="prev-item-left">
              <div class="prev-item-score ${scoreClass}">${score}</div>
              <div>
                <h4 class="prev-item-role">${escapeHtml(item.role)}</h4>
                <div class="prev-item-meta">${escapeHtml(item.company)} • ${escapeHtml(item.category)} • ${escapeHtml(dateStr)}</div>
              </div>
            </div>
            <div class="prev-item-actions">
              <button type="button" class="btn-subtle btn-reopen-interview" data-id="${escapeHtml(item.id)}">View Report</button>
              <button type="button" class="btn-secondary btn-delete-interview danger-hover" data-id="${escapeHtml(item.id)}" title="Delete session">✕</button>
            </div>
          </div>
        `;
      }).join("");

      // Bind delete & reopen buttons
      previousInterviewsList.querySelectorAll(".btn-reopen-interview").forEach(btn => {
        btn.addEventListener("click", () => {
          const id = btn.getAttribute("data-id");
          const session = InterviewEngine.getInterviewSession(id);
          if (session && session.report) {
            sessionState.finalReport = session.report;
            sessionState.role = session.role;
            sessionState.company = session.company;
            sessionState.category = session.category;

            repMetaSub.textContent = `${session.role} at ${session.company} | Saved Report (${session.savedAt ? new Date(session.savedAt).toLocaleDateString() : ''})`;
            repScoreNum.textContent = session.report.averageScore ? session.report.averageScore.toFixed(1) : session.averageScore.toFixed(1);
            repTechVal.textContent = session.report.performance ? session.report.performance.technical : "8/10";
            repHrVal.textContent = session.report.performance ? session.report.performance.hr : "8/10";
            repBehVal.textContent = session.report.performance ? session.report.performance.behavioural : "8/10";
            repReadinessVal.textContent = session.report.readiness || "Completed";

            repStrengthsList.innerHTML = (session.report.strongAreas && session.report.strongAreas.length > 0)
              ? session.report.strongAreas.map(s => `<li>${escapeHtml(s)}</li>`).join("")
              : `<li>Solid foundational knowledge.</li>`;

            repWeaknessesList.innerHTML = (session.report.weakTopics && session.report.weakTopics.length > 0)
              ? session.report.weakTopics.map(w => `<li>Targeted focus needed on <strong>${escapeHtml(w)}</strong></li>`).join("")
              : `<li>No critical weaknesses recorded.</li>`;

            repRevisionPills.innerHTML = (session.report.recommendedTopicsToRevise && session.report.recommendedTopicsToRevise.length > 0)
              ? session.report.recommendedTopicsToRevise.map(t => `<span class="revision-pill">${escapeHtml(t)}</span>`).join("")
              : `<span class="revision-pill">System Architecture</span>`;

            repSummaryText.textContent = session.report.summary || "Completed session report.";

            switchView("report");
          }
        });
      });

      previousInterviewsList.querySelectorAll(".btn-delete-interview").forEach(btn => {
        btn.addEventListener("click", () => {
          const id = btn.getAttribute("data-id");
          if (confirm("Are you sure you want to delete this previous interview session?")) {
            InterviewEngine.deleteInterviewSession(id);
            updateHistoryAndStats();
          }
        });
      });
    }
  }

  // Initialize
  checkPrefillData();
  updateHistoryAndStats();
});
