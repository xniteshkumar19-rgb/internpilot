/**
 * InternPilot - Autonomous Agent Loop with Real Decisions
 * 
 * Manages the sequential evaluation pipeline:
 * 1. Read Posting (AI extraction with trimmed 5000 char text or demo cache)
 * 2. Scam Check (Rule-based risk scoring on FULL text & decision halts)
 * 3. Skill Matcher (Alignment calculation, empty resume checks & "Learn these first" halts)
 * 4. Email Drafter (Grounded cover email generation or graceful skip on failure)
 * 5. Application Tracker (Interactive prompt, never auto-saves)
 */

// Environment-safe resolution of tools (Browser globals or Node require)
let getScamCheck = () => (typeof scamCheck !== "undefined" ? scamCheck : (typeof require !== "undefined" ? require("./tools.js").scamCheck : null));
let getMatchSkills = () => (typeof matchSkills !== "undefined" ? matchSkills : (typeof require !== "undefined" ? require("./tools.js").matchSkills : null));
let getSaveApplication = () => (typeof saveApplication !== "undefined" ? saveApplication : (typeof require !== "undefined" ? require("./tools.js").saveApplication : null));

function normalizeText(str) {
  if (!str) return "";
  return String(str).trim().replace(/\r\n/g, "\n").replace(/\s+/g, " ");
}

async function runAgent(resumeText, postingText, log, options = {}) {
  const _scamCheck = getScamCheck();
  const _matchSkills = getMatchSkills();
  const _saveApplication = getSaveApplication();

  const state = options.existingState || {
    details: null,
    scam: { riskScore: 0, level: "low", reasons: [] },
    match: null,
    email: null,
    resumeText: resumeText || "",
    postingText: postingText || ""
  };

  const startStep = options.startStep || "read";

  // Check: Empty posting
  if (!state.postingText || !state.postingText.trim()) {
    log({
      type: "step-error",
      text: "No posting text provided. Please paste an internship posting."
    });
    return state;
  }

  // Trim posting to 5,000 characters for AI calls only
  const isLongPosting = state.postingText.length > 5000;
  const textForAI = isLongPosting ? state.postingText.substring(0, 5000) : state.postingText;
  if (isLongPosting && startStep === "read") {
    log({
      type: "decision",
      text: "Posting text exceeded 5,000 characters and was trimmed for AI analysis."
    });
  }

  // Demo mode check and cache matching
  const isDemoMode = !!options.demoMode;
  let cachedSample = null;

  if (isDemoMode) {
    const demoCache = options.demoCache;
    const sampleResumeText = options.sampleResumeText || demoCache?.sampleResumeText || "";

    const normResume = normalizeText(state.resumeText);
    const normSampleResume = normalizeText(sampleResumeText);
    const resumeMatches = normResume.length > 0 && (
      normResume === normSampleResume ||
      (normResume.includes("ROHAN SHARMA") && (normSampleResume.includes("ROHAN SHARMA") || !normSampleResume))
    );

    const normPosting = normalizeText(state.postingText);

    if (demoCache && demoCache.postings && typeof demoCache.postings === "object") {
      // Check by samplePostingId if passed
      if (options.samplePostingId && demoCache.postings[options.samplePostingId]) {
        const candidate = demoCache.postings[options.samplePostingId];
        if (normalizeText(candidate.postingText) === normPosting || normalizeText(candidate.text) === normPosting) {
          cachedSample = candidate;
        }
      }

      // Otherwise find by posting text match across all cached samples
      if (!cachedSample) {
        for (const key of Object.keys(demoCache.postings)) {
          const candidate = demoCache.postings[key];
          if (normalizeText(candidate.postingText) === normPosting || normalizeText(candidate.text) === normPosting) {
            cachedSample = candidate;
            break;
          }
        }
      }
    } else {
      log({
        type: "step-error",
        text: "Demo cache could not be loaded or is corrupted. Turn off Demo mode to use live AI, or run npm run build:demo-cache."
      });
      return state;
    }

    if (!cachedSample || !resumeMatches) {
      log({
        type: "step-error",
        text: "Demo mode only covers the sample postings with the sample resume. Turn off Demo mode to use live AI."
      });
      return state;
    }
  }

  // ==========================================
  // STEP A: READ THE POSTING
  // ==========================================
  if (startStep === "read") {
    log({
      type: "step-start",
      title: "Reading the posting...",
      icon: "eye",
      loading: true
    });

    if (isDemoMode && cachedSample) {
      state.details = cachedSample.details;
      if (state.details) {
        log({
          type: "details-card",
          title: "✓ Reading the posting (Demo Mode): Details loaded",
          data: state.details
        });
      } else {
        log({
          type: "decision",
          text: "Decision: Demo cache has no structured details, continuing with keyword checks only."
        });
      }
    } else {
      try {
        const readerFn = typeof readPosting === "function" ? readPosting : (globalThis && globalThis.readPosting);
        if (typeof readerFn === "function") {
          const details = await readerFn(textForAI);
          state.details = details;

          if (options.customCompany && state.details) {
            state.details.company = options.customCompany;
          }
          if (options.customRole && state.details) {
            state.details.role = options.customRole;
          }

          if (details) {
            log({
              type: "details-card",
              title: "✓ Reading the posting: Details extracted",
              data: state.details
            });
          } else {
            if (options.customCompany || options.customRole) {
              state.details = {
                company: options.customCompany || "Company from posting",
                role: options.customRole || "Internship Role",
                requiredSkills: [],
                deadline: "Not specified",
                contactEmail: null
              };
            }
            log({
              type: "decision",
              text: "Decision: AI reader unavailable, continuing with keyword checks only."
            });
          }
        } else {
          if (options.customCompany || options.customRole) {
            state.details = {
              company: options.customCompany || "Company from posting",
              role: options.customRole || "Internship Role",
              requiredSkills: [],
              deadline: "Not specified",
              contactEmail: null
            };
          }
          log({
            type: "decision",
            text: "Decision: Continuing with keyword checks only."
          });
        }
      } catch (err) {
        console.error("Step A error:", err);
        if (options.customCompany || options.customRole) {
          state.details = {
            company: options.customCompany || "Company from posting",
            role: options.customRole || "Internship Role",
            requiredSkills: [],
            deadline: "Not specified",
            contactEmail: null
          };
        }
        log({
          type: "decision",
          text: "Decision: AI reader encountered error, continuing with keyword checks only."
        });
      }
    }
  }

  // ==========================================
  // STEP B: MATCH SKILLS & CAREERMATCH AI
  // ==========================================
  const hasResume = !!(state.resumeText && state.resumeText.trim());

  if (startStep === "read" || startStep === "match") {
    log({
      type: "step-start",
      title: "CareerMatch AI: Evaluating skill alignment & pathways...",
      icon: "check-circle"
    });

    if (!hasResume) {
      log({
        type: "decision",
        text: "No resume text provided. Paste your resume to see skill alignment and learning roadmap."
      });
      log({
        type: "decision",
        text: "Decision: No resume provided, skipping email drafting."
      });
      state.match = { percent: null, matched: [], partial: [], missing: [], level: "none", careerMatch: null };
    } else {
      try {
        const aiSkills = state.details || null;
        const matchResult = _matchSkills(state.resumeText, state.postingText, aiSkills);
        state.match = matchResult;

        const cm = matchResult.careerMatch;

        if (matchResult.percent !== null && matchResult.percent < 30) {
          // Match < 30%: STOP flow, show "Learn these first" and personalized roadmap
          log({
            type: "match-halt",
            title: `✓ CareerMatch AI: about ${matchResult.percent}% match (Low Alignment)`,
            percent: matchResult.percent,
            level: matchResult.level,
            matched: matchResult.matched,
            partial: matchResult.partial || [],
            missing: matchResult.missing,
            careerMatch: cm,
            scamAssessment: state.scam || null,
            decisionText: "Decision: match is very low, suggesting skills to learn first and personalized roadmap.",
            onDraftAnyway: () => {
              log({
                type: "decision",
                text: "User chose to draft email anyway despite low match."
              });
              return runAgent(state.resumeText, state.postingText, log, {
                ...options,
                existingState: state,
                startStep: "email"
              });
            }
          });
          return state; // STOP automatic flow
        } else if (matchResult.percent === null) {
          // No recognizable skills
          log({
            type: "match-neutral",
            title: "✓ CareerMatch AI: Alignment estimate unavailable",
            note: matchResult.note || "No recognizable skills found in the job posting.",
            careerMatch: cm,
            decisionText: "Decision: skill match could not be estimated, proceeding to email draft."
          });
        } else {
          // Good or acceptable match
          log({
            type: "match-success",
            title: `✓ CareerMatch AI: about ${matchResult.percent}% match (${matchResult.level.toUpperCase()})`,
            percent: matchResult.percent,
            level: matchResult.level,
            matched: matchResult.matched,
            partial: matchResult.partial || [],
            missing: matchResult.missing,
            careerMatch: cm,
            scamAssessment: state.scam || null,
            decisionText: `Decision: skill match acceptable (about ${matchResult.percent}%), proceeding to email draft.`
          });
        }
      } catch (err) {
        console.error("Step C error:", err);
        log({
          type: "step-error",
          text: "CareerMatch analysis encountered an error. Proceeding to draft."
        });
      }
    }
  }

  // ==========================================
  // STEP C: DRAFT EMAIL
  // ==========================================
  if (hasResume && (startStep === "read" || startStep === "match" || startStep === "email")) {
    log({
      type: "step-start",
      title: "Preparing your application email...",
      icon: "mail",
      loading: true
    });

    if (isDemoMode && cachedSample) {
      if (cachedSample.email && (cachedSample.email.subject || cachedSample.email.body)) {
        state.email = cachedSample.email;
        log({
          type: "email-card",
          title: "✓ Drafting your email (Demo Mode): Draft ready for review",
          subject: cachedSample.email.subject || "",
          body: cachedSample.email.body || "",
          contactEmail: state.details?.contactEmail || null
        });
      } else {
        log({
          type: "email-error",
          title: "Email Draft Unavailable",
          text: "Cached email draft unavailable in demo data.",
          errorType: "demoMissing",
          canRetry: false
        });
        log({
          type: "decision",
          text: "Decision: email draft unavailable, skipping email step."
        });
      }
    } else {
      try {
        const emailFn = typeof draftEmail === "function" ? draftEmail : (globalThis && globalThis.draftEmail);
        if (typeof emailFn === "function") {
          const emailResult = await emailFn(state.resumeText, state.details, state.match);

          if (emailResult && !emailResult.error && (emailResult.subject || emailResult.body)) {
            state.email = emailResult;
            log({
              type: "email-card",
              title: "✓ Drafting your email: Draft ready for review",
              subject: emailResult.subject || "",
              body: emailResult.body || "",
              contactEmail: state.details?.contactEmail || null
            });
          } else {
            // Failure with specific error
            const errorMsg = emailResult?.message || "Email draft unavailable";
            const errorType = emailResult?.errorType || "general";
            const canRetry = emailResult?.canRetry !== false;

            log({
              type: "email-error",
              title: "Email Draft Unavailable",
              text: errorMsg,
              errorType,
              canRetry,
              onRetry: () => {
                log({
                  type: "decision",
                  text: "Retrying application email generation..."
                });
                return runAgent(state.resumeText, state.postingText, log, {
                  ...options,
                  existingState: state,
                  startStep: "email"
                });
              }
            });
            log({
              type: "decision",
              text: `Decision: ${errorMsg}`
            });
          }
        } else {
          log({
            type: "email-error",
            title: "Email Draft Unavailable",
            text: "AI service is not configured.",
            errorType: "apiKeyMissing",
            canRetry: false
          });
          log({
            type: "decision",
            text: "Decision: AI service is not configured."
          });
        }
      } catch (err) {
        console.error("Step D error:", err);
        log({
          type: "email-error",
          title: "Email Draft Unavailable",
          text: "Unable to connect to the AI service.",
          errorType: "network",
          canRetry: true,
          onRetry: () => {
            return runAgent(state.resumeText, state.postingText, log, {
              ...options,
              existingState: state,
              startStep: "email"
            });
          }
        });
        log({
          type: "decision",
          text: "Decision: email drafting encountered an error."
        });
      }
    }
  }

  // ==========================================
  // STEP E: TRACKER INTERACTIVE CONFIRMATION
  // ==========================================
  try {
    const company = state.details?.company || options.customCompany || "Company from posting";
    const role = state.details?.role || options.customRole || "Internship Role";
    const deadline = state.details?.deadline || "Not specified";

    log({
      type: "tracker-prompt",
      title: "Add this application to your tracker?",
      company,
      role,
      deadline,
      decisionText: "Decision: asking user to track application.",
      onConfirm: () => {
        if (_saveApplication) {
          _saveApplication({
            company,
            role,
            deadline,
            riskLevel: state.scam?.level || "low",
            matchPercent: state.match?.percent !== undefined ? state.match.percent : null
          });
        }
        log({
          type: "decision",
          text: "✓ Application saved to tracker!"
        });
      },
      onDecline: () => {
        log({
          type: "decision",
          text: "Skipped saving to tracker."
        });
      }
    });
  } catch (err) {
    console.error("Step E error:", err);
  }

  return state;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { runAgent };
}
