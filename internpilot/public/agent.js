/**
 * InternPilot - Autonomous Agent Loop with Real Decisions
 * 
 * Manages the sequential evaluation pipeline:
 * 1. Read Posting (AI extraction with fallback)
 * 2. Scam Check (Rule-based risk scoring & decision halts)
 * 3. Skill Matcher (Alignment calculation & "Learn these first" halts)
 * 4. Email Drafter (Grounded cover email generation)
 * 5. Application Tracker (Interactive prompt, never auto-saves)
 */

// Environment-safe resolution of tools (Browser globals or Node require)
let getScamCheck = () => (typeof scamCheck !== "undefined" ? scamCheck : (typeof require !== "undefined" ? require("./tools.js").scamCheck : null));
let getMatchSkills = () => (typeof matchSkills !== "undefined" ? matchSkills : (typeof require !== "undefined" ? require("./tools.js").matchSkills : null));
let getSaveApplication = () => (typeof saveApplication !== "undefined" ? saveApplication : (typeof require !== "undefined" ? require("./tools.js").saveApplication : null));

async function runAgent(resumeText, postingText, log, options = {}) {
  const _scamCheck = getScamCheck();
  const _matchSkills = getMatchSkills();
  const _saveApplication = getSaveApplication();

  const state = options.existingState || {
    details: null,
    scam: null,
    match: null,
    email: null,
    resumeText: resumeText || "",
    postingText: postingText || ""
  };

  const startStep = options.startStep || "read";

  // ==========================================
  // STEP A: READ THE POSTING
  // ==========================================
  if (startStep === "read") {
    log({
      type: "step-start",
      title: "Reading the posting...",
      icon: "eye"
    });

    try {
      const readerFn = typeof readPosting === "function" ? readPosting : (globalThis && globalThis.readPosting);
      if (typeof readerFn === "function") {
        const details = await readerFn(state.postingText);
        state.details = details;

        if (details) {
          log({
            type: "details-card",
            title: "✓ Reading the posting: Details extracted",
            data: details
          });
        } else {
          log({
            type: "decision",
            text: "Decision: AI reader unavailable, continuing with keyword checks only."
          });
        }
      } else {
        log({
          type: "decision",
          text: "Decision: Continuing with keyword checks only."
        });
      }
    } catch (err) {
      console.error("Step A error:", err);
      log({
        type: "decision",
        text: "Decision: AI reader encountered error, continuing with keyword checks only."
      });
    }
  }

  // ==========================================
  // STEP B: SCAM CHECK
  // ==========================================
  if (startStep === "read" || startStep === "scam") {
    log({
      type: "step-start",
      title: "Checking for scams...",
      icon: "shield"
    });

    try {
      const scamResult = _scamCheck(state.postingText);
      state.scam = scamResult;

      if (scamResult.level === "high") {
        // High Risk: STOP the flow
        log({
          type: "scam-halt",
          title: "⚠ High Scam Risk Detected",
          score: scamResult.riskScore,
          level: "high",
          reasons: scamResult.reasons,
          decisionText: "Decision: high scam risk, skipping matching and email.",
          onContinue: () => {
            log({
              type: "decision",
              text: "User chose to continue anyway despite high scam risk."
            });
            return runAgent(state.resumeText, state.postingText, log, {
              existingState: state,
              startStep: "match"
            });
          }
        });
        return state; // STOP the automatic flow
      } else if (scamResult.level === "medium") {
        // Medium Risk: Show warning banner and proceed
        log({
          type: "scam-warn",
          title: "✓ Checking for scams: Medium risk indicators found",
          score: scamResult.riskScore,
          level: "medium",
          reasons: scamResult.reasons,
          decisionText: "Decision: medium scam risk detected, proceeding with caution."
        });
      } else {
        // Low Risk: Clean posting
        log({
          type: "scam-clean",
          title: "✓ Checking for scams: Low risk",
          score: scamResult.riskScore,
          level: "low",
          decisionText: "Decision: low scam risk, proceeding to skill matching."
        });
      }
    } catch (err) {
      console.error("Step B error:", err);
      log({
        type: "step-error",
        text: "Scam check encountered an error. Proceeding to matching."
      });
    }
  }

  // ==========================================
  // STEP C: MATCH SKILLS
  // ==========================================
  if (startStep === "read" || startStep === "scam" || startStep === "match") {
    log({
      type: "step-start",
      title: "Matching your skills...",
      icon: "check-circle"
    });

    try {
      const aiSkills = state.details?.requiredSkills || null;
      const matchResult = _matchSkills(state.resumeText, state.postingText, aiSkills);
      state.match = matchResult;

      if (matchResult.percent !== null && matchResult.percent < 30) {
        // Match < 30%: STOP flow, show "Learn these first"
        log({
          type: "match-halt",
          title: `✓ Matching your skills: about ${matchResult.percent}% match (Very Low)`,
          percent: matchResult.percent,
          level: matchResult.level,
          matched: matchResult.matched,
          missing: matchResult.missing,
          decisionText: "Decision: match is very low, suggesting skills to learn first.",
          onDraftAnyway: () => {
            log({
              type: "decision",
              text: "User chose to draft email anyway despite low match."
            });
            return runAgent(state.resumeText, state.postingText, log, {
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
          title: "✓ Matching your skills: Alignment estimate unavailable",
          note: matchResult.note || "No recognizable skills found in the job posting.",
          decisionText: "Decision: skill match could not be estimated, proceeding to email draft."
        });
      } else {
        // Good or acceptable match
        log({
          type: "match-success",
          title: `✓ Matching your skills: about ${matchResult.percent}% match (${matchResult.level.toUpperCase()})`,
          percent: matchResult.percent,
          level: matchResult.level,
          matched: matchResult.matched,
          missing: matchResult.missing,
          decisionText: `Decision: skill match acceptable (about ${matchResult.percent}%), proceeding to email draft.`
        });
      }
    } catch (err) {
      console.error("Step C error:", err);
      log({
        type: "step-error",
        text: "Skill matching encountered an error. Proceeding to draft."
      });
    }
  }

  // ==========================================
  // STEP D: DRAFT EMAIL
  // ==========================================
  if (startStep === "read" || startStep === "scam" || startStep === "match" || startStep === "email") {
    log({
      type: "step-start",
      title: "Drafting your email...",
      icon: "mail"
    });

    try {
      const emailFn = typeof draftEmail === "function" ? draftEmail : (globalThis && globalThis.draftEmail);
      if (typeof emailFn === "function") {
        const emailDraft = await emailFn(state.resumeText, state.details, state.match);
        state.email = emailDraft;

        if (emailDraft && (emailDraft.subject || emailDraft.body)) {
          log({
            type: "email-card",
            title: "✓ Drafting your email: Draft ready for review",
            subject: emailDraft.subject || "",
            body: emailDraft.body || "",
            contactEmail: state.details?.contactEmail || null
          });
        } else {
          log({
            type: "step-error",
            text: "AI email writer unavailable at this time."
          });
        }
      } else {
        log({
          type: "step-error",
          text: "Email writer function is not available."
        });
      }
    } catch (err) {
      console.error("Step D error:", err);
      log({
        type: "step-error",
        text: "Error generating draft email."
      });
    }
  }

  // ==========================================
  // STEP E: TRACKER INTERACTIVE CONFIRMATION
  // ==========================================
  try {
    const company = state.details?.company || "Company from posting";
    const role = state.details?.role || "Internship Role";
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
