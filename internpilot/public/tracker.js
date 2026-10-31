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
 * InternPilot - Tracker Controller
 * 
 * Manages:
 * - Activity report calculation & rendering via computeActivity()
 * - Real-time metrics and sorted applications list
 * - Safe XSS handling (.textContent)
 * - Immediate status updates (appliedAt, updatedAt)
 * - Dynamic relative demo data loader
 * - Optional AI Weekly Summary with graceful failure handling
 */

document.addEventListener("DOMContentLoaded", () => {
  // Elements
  const trackerList = document.getElementById("tracker-list");
  const loadDemoBtn = document.getElementById("load-demo-btn");
  const clearAllBtn = document.getElementById("clear-all-btn");
  const weeklySummaryBtn = document.getElementById("weekly-summary-btn");

  const scoreNum = document.getElementById("activity-score-number");
  const levelBadge = document.getElementById("activity-level-badge");
  const sentCount = document.getElementById("sent-this-week-count");
  const sentTrend = document.getElementById("sent-trend-indicator");
  const nextActionBox = document.getElementById("next-action-callout");
  const breakdownList = document.getElementById("activity-breakdown-list");
  const fourWeeksChart = document.getElementById("four-weeks-chart");

  const metricTotal = document.getElementById("metric-total");
  const metricApplied = document.getElementById("metric-applied");
  const metricInterviews = document.getElementById("metric-interviews");
  const metricDueSoon = document.getElementById("metric-due-soon");

  const aiSummaryCard = document.getElementById("ai-summary-card");
  const aiSummaryText = document.getElementById("ai-summary-text");

  const trackerSearchInput = document.getElementById("tracker-search-input");
  const trackerFilterPills = document.getElementById("tracker-filter-pills");
  let currentSearchQuery = "";
  let currentStatusFilter = "all";

  if (trackerSearchInput) {
    trackerSearchInput.addEventListener("input", (e) => {
      currentSearchQuery = e.target.value.trim().toLowerCase();
      renderAll();
    });
  }

  if (trackerFilterPills) {
    const pills = trackerFilterPills.querySelectorAll(".filter-pill");
    pills.forEach(pill => {
      pill.addEventListener("click", () => {
        pills.forEach(p => p.classList.remove("active"));
        pill.classList.add("active");
        currentStatusFilter = pill.getAttribute("data-filter") || "all";
        renderAll();
      });
    });
  }

  // Helper: compute days difference (deadline - now)
  function getDeadlineInfo(deadlineStr, now = new Date()) {
    if (!deadlineStr || deadlineStr === "Not specified") {
      return { text: "No deadline", urgency: "none", days: null };
    }

    const d = new Date(deadlineStr);
    if (isNaN(d.getTime())) {
      return { text: deadlineStr, urgency: "none", days: null };
    }

    const MS_PER_DAY = 86400000;
    // Compare dates based on day difference
    const diffMs = d.getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / MS_PER_DAY);

    if (diffDays < 0) {
      const overdue = Math.abs(diffDays);
      return {
        text: `OVERDUE (${overdue} day${overdue === 1 ? '' : 's'} past deadline)`,
        urgency: "overdue",
        days: diffDays
      };
    } else if (diffDays === 0) {
      return {
        text: "Due today",
        urgency: "urgent",
        days: 0
      };
    } else if (diffDays <= 3) {
      return {
        text: `${diffDays} day${diffDays === 1 ? '' : 's'} left`,
        urgency: "urgent",
        days: diffDays
      };
    } else {
      return {
        text: `${diffDays} days left`,
        urgency: "normal",
        days: diffDays
      };
    }
  }

  // Render everything
  function renderAll() {
    const apps = loadApplications();
    const now = new Date();

    // 1. Calculate Activity Score
    const activity = computeActivity(apps, now);

    // Update Activity Report UI
    scoreNum.textContent = activity.score;
    levelBadge.textContent = activity.level;
    levelBadge.className = "badge " + (
      activity.score >= 80 ? "badge-success" :
      activity.score >= 60 ? "badge-success" :
      activity.score >= 30 ? "badge-warning" : "badge-danger"
    );

    sentCount.textContent = activity.thisWeek.sent;

    // Trend indicator
    if (activity.thisWeek.sent > activity.lastWeek.sent) {
      sentTrend.textContent = `↑ from ${activity.lastWeek.sent} last week`;
      sentTrend.className = "trend-pill trend-up";
    } else if (activity.thisWeek.sent < activity.lastWeek.sent) {
      sentTrend.textContent = `↓ from ${activity.lastWeek.sent} last week`;
      sentTrend.className = "trend-pill trend-down";
    } else {
      sentTrend.textContent = `→ same as last week (${activity.lastWeek.sent})`;
      sentTrend.className = "trend-pill trend-same";
    }

    nextActionBox.textContent = activity.nextAction;

    // Breakdown list
    breakdownList.innerHTML = activity.breakdown.map(item => {
      const pct = item.max > 0 ? Math.round((item.points / item.max) * 100) : 0;
      return `
        <div class="breakdown-item">
          <div class="breakdown-item-header">
            <span class="breakdown-item-label">${escapeHtml(item.label)}</span>
            <span class="breakdown-item-pts">${item.points} / ${item.max} pts</span>
          </div>
          <div class="breakdown-progress-bar-bg">
            <div class="breakdown-progress-bar-fill" style="width: ${pct}%;"></div>
          </div>
          <span class="breakdown-item-detail">${escapeHtml(item.detail)}</span>
        </div>
      `;
    }).join("");

    // 4-Week Mini Bar Chart
    const weekLabels = ["3w ago", "2w ago", "Last week", "This week"];
    const maxBar = Math.max(...activity.fourWeeksTrend, 3);
    fourWeeksChart.innerHTML = activity.fourWeeksTrend.map((count, idx) => {
      const heightPct = Math.max(Math.round((count / maxBar) * 100), 14);
      const isCurrent = idx === 3;
      return `
        <div class="chart-col">
          <div class="chart-col-count">${count}</div>
          <div class="chart-bar-rect ${isCurrent ? 'active-week' : ''}" style="height: ${heightPct}%;"></div>
          <div class="chart-col-label">${weekLabels[idx]}</div>
        </div>
      `;
    }).join("");

    // Segmented Horizontal Stacked Bar
    const sentItem = activity.breakdown.find(b => b.id === "sent") || { points: 0, max: 45 };
    const savedItem = activity.breakdown.find(b => b.id === "saved") || { points: 0, max: 15 };
    const progItem = activity.breakdown.find(b => b.id === "progress") || { points: 0, max: 20 };
    const discItem = activity.breakdown.find(b => b.id === "discipline") || { points: 0, max: 20 };

    const barSent = document.getElementById("bar-sent");
    const barSaved = document.getElementById("bar-saved");
    const barProgress = document.getElementById("bar-progress");
    const barDiscipline = document.getElementById("bar-discipline");

    if (barSent) barSent.style.width = `${sentItem.points}%`;
    if (barSaved) barSaved.style.width = `${savedItem.points}%`;
    if (barProgress) barProgress.style.width = `${progItem.points}%`;
    if (barDiscipline) barDiscipline.style.width = `${discItem.points}%`;

    const stackedLegendRow = document.getElementById("stacked-legend-row");
    if (stackedLegendRow) {
      stackedLegendRow.innerHTML = `
        <div class="legend-item">
          <div class="legend-item-title">
            <span class="legend-dot" style="background: var(--indigo);"></span>
            <span>Sent: ${sentItem.points}/${sentItem.max}</span>
          </div>
          <span class="legend-item-detail">${escapeHtml(sentItem.detail || '')}</span>
        </div>
        <div class="legend-item">
          <div class="legend-item-title">
            <span class="legend-dot" style="background: #0284C7;"></span>
            <span>Saved: ${savedItem.points}/${savedItem.max}</span>
          </div>
          <span class="legend-item-detail">${escapeHtml(savedItem.detail || '')}</span>
        </div>
        <div class="legend-item">
          <div class="legend-item-title">
            <span class="legend-dot" style="background: var(--safe);"></span>
            <span>Progress: ${progItem.points}/${progItem.max}</span>
          </div>
          <span class="legend-item-detail">${escapeHtml(progItem.detail || '')}</span>
        </div>
        <div class="legend-item">
          <div class="legend-item-title">
            <span class="legend-dot" style="background: #475569;"></span>
            <span>Discipline: ${discItem.points}/${discItem.max}</span>
          </div>
          <span class="legend-item-detail">${escapeHtml(discItem.detail || '')}</span>
        </div>
      `;
    }

    // 2. Summary Cards Metrics
    metricTotal.textContent = apps.length;
    metricApplied.textContent = apps.filter(a => a.status === "Applied").length;
    metricInterviews.textContent = apps.filter(a => a.status === "Interview").length;

    const dueIn7Days = apps.filter(a => {
      const info = getDeadlineInfo(a.deadline, now);
      return info.days !== null && info.days >= 0 && info.days <= 7;
    }).length;
    metricDueSoon.textContent = dueIn7Days;

    // 3. Applications List (Sorted by nearest deadline)
    if (apps.length === 0) {
      clearAllBtn.style.display = "none";
      trackerList.innerHTML = `
        <div class="tracker-empty">
          <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          <p style="margin-top: 0.6rem; font-weight: 600;">No applications yet.</p>
          <p class="card-subtitle" style="margin-top: 0.2rem;">Go to Review Desk to check your first posting.</p>
          <a href="index.html" class="btn-primary" style="margin-top: 1rem; text-decoration: none; display: inline-flex;">
            Go to Review Desk
          </a>
        </div>
      `;
      return;
    }

    clearAllBtn.style.display = "inline-flex";

    // Sort: nearest deadline first (overdue first, nearest next, nulls last)
    const sorted = [...apps].sort((a, b) => {
      const aInfo = getDeadlineInfo(a.deadline, now);
      const bInfo = getDeadlineInfo(b.deadline, now);

      if (aInfo.days === null && bInfo.days === null) return 0;
      if (aInfo.days === null) return 1;  // nulls sort last
      if (bInfo.days === null) return -1;
      return aInfo.days - bInfo.days;    // lowest days (including negative) first
    });

    const filtered = sorted.filter(app => {
      if (currentStatusFilter !== "all" && app.status !== currentStatusFilter) {
        return false;
      }
      if (currentSearchQuery) {
        const comp = (app.company || "").toLowerCase();
        const role = (app.role || "").toLowerCase();
        if (!comp.includes(currentSearchQuery) && !role.includes(currentSearchQuery)) {
          return false;
        }
      }
      return true;
    });

    trackerList.innerHTML = "";
    if (filtered.length === 0) {
      trackerList.innerHTML = `
        <div class="tracker-empty" style="padding: 2.5rem 1rem; text-align: center; color: var(--text-faint);">
          <p style="font-weight: 600;">No applications match your search filter.</p>
          <p class="card-subtitle" style="margin-top: 0.25rem;">Try a different keyword or reset status to 'All'.</p>
        </div>
      `;
    } else {
      filtered.forEach(app => {
        const row = createApplicationRow(app, now);
        trackerList.appendChild(row);
      });
    }
  }

  // Create an application item element with safe DOM text injection
  function createApplicationRow(app, now) {
    const itemDiv = document.createElement("div");
    itemDiv.className = "tracker-item";
    itemDiv.setAttribute("data-id", app.id);

    const deadlineInfo = getDeadlineInfo(app.deadline, now);
    let deadlineBadgeClass = "deadline-normal";
    if (deadlineInfo.urgency === "overdue") deadlineBadgeClass = "deadline-overdue";
    else if (deadlineInfo.urgency === "urgent") deadlineBadgeClass = "deadline-urgent";

    const matchDisplay = app.matchPercent !== null ? `about ${app.matchPercent}% match` : "Not estimated";
    const riskBadgeClass = app.riskLevel === "high" ? "badge-danger" : (app.riskLevel === "medium" ? "badge-warning" : "badge-success");

    // Main text block
    const mainDiv = document.createElement("div");
    mainDiv.className = "tracker-item-main";

    // Title row
    const titleRow = document.createElement("div");
    titleRow.className = "tracker-item-title-row";

    const roleHeading = document.createElement("h3");
    roleHeading.className = "tracker-role-title";
    roleHeading.textContent = app.role || "Internship Role"; // Safe textContent
    titleRow.appendChild(roleHeading);

    const riskBadge = document.createElement("span");
    riskBadge.className = `badge ${riskBadgeClass}`;
    riskBadge.textContent = `${(app.riskLevel || 'LOW').toUpperCase()} RISK`;
    titleRow.appendChild(riskBadge);

    if (app.demo) {
      const demoBadge = document.createElement("span");
      demoBadge.className = "badge";
      demoBadge.style.background = "#e2e8f0";
      demoBadge.style.color = "#475569";
      demoBadge.textContent = "DEMO";
      titleRow.appendChild(demoBadge);
    }

    mainDiv.appendChild(titleRow);

    // Company
    const compDiv = document.createElement("div");
    compDiv.className = "tracker-company";
    compDiv.textContent = app.company || "Unknown Company"; // Safe textContent
    mainDiv.appendChild(compDiv);

    // Meta details row
    const metaDiv = document.createElement("div");
    metaDiv.className = "tracker-meta";

    const deadlineSpan = document.createElement("span");
    deadlineSpan.innerHTML = `<strong>Deadline:</strong> <span class="deadline-pill ${deadlineBadgeClass}">${escapeHtml(deadlineInfo.text)}</span>`;
    metaDiv.appendChild(deadlineSpan);

    const dot1 = document.createElement("span");
    dot1.textContent = "•";
    metaDiv.appendChild(dot1);

    const matchSpan = document.createElement("span");
    matchSpan.textContent = `Alignment: ${matchDisplay}`;
    metaDiv.appendChild(matchSpan);

    if (app.appliedAt) {
      const dot2 = document.createElement("span");
      dot2.textContent = "•";
      metaDiv.appendChild(dot2);

      const appliedSpan = document.createElement("span");
      const d = new Date(app.appliedAt);
      appliedSpan.textContent = `Applied: ${d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
      metaDiv.appendChild(appliedSpan);
    }

    mainDiv.appendChild(metaDiv);
    itemDiv.appendChild(mainDiv);

    // Controls: Status dropdown & Delete button
    const controlsDiv = document.createElement("div");
    controlsDiv.className = "tracker-item-controls";

    // Status Dropdown
    const statusSelect = document.createElement("select");
    statusSelect.className = "status-dropdown";
    ["Saved", "Applied", "Interview", "Offer", "Rejected"].forEach(s => {
      const opt = document.createElement("option");
      opt.value = s;
      opt.textContent = s;
      if (app.status === s) opt.selected = true;
      statusSelect.appendChild(opt);
    });

    statusSelect.addEventListener("change", (e) => {
      const newStatus = e.target.value;
      updateApplication(app.id, { status: newStatus });
      renderAll(); // Immediate refresh of activity report & metrics
    });

    controlsDiv.appendChild(statusSelect);

    // Delete Button
    const deleteBtn = document.createElement("button");
    deleteBtn.className = "btn-delete";
    deleteBtn.title = "Remove application";
    deleteBtn.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>`;
    
    deleteBtn.addEventListener("click", () => {
      const current = loadApplications().filter(a => a.id !== app.id);
      localStorage.setItem("internpilot_apps", JSON.stringify(current));
      renderAll();
    });

    controlsDiv.appendChild(deleteBtn);
    itemDiv.appendChild(controlsDiv);

    return itemDiv;
  }

  // Load Demo Data (With relative dates to today)
  loadDemoBtn.addEventListener("click", () => {
    const now = new Date();
    const MS_PER_DAY = 86400000;
    const rel = (days) => new Date(now.getTime() + days * MS_PER_DAY).toISOString();
    const relDateStr = (days) => {
      const d = new Date(now.getTime() + days * MS_PER_DAY);
      return d.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' });
    };

    // 6 fictional applications:
    // - 2 sent this week (rel(-2), rel(-4))
    // - 1 sent last week (rel(-10)) -> Trend arrow is UP (2 vs 1)
    // - 1 overdue saved application (rel(-2) deadline) -> Overdue warning visible
    // - 1 with status "Interview" progressed this week
    // - 1 with "Offer" and null deadline
    const demoApps = [
      {
        id: "demo_1",
        company: "Acme Cloud Labs",
        role: "Junior Web Developer Intern",
        deadline: relDateStr(2), // 2 days left (orange)
        status: "Applied",
        riskLevel: "low",
        matchPercent: 85,
        createdAt: rel(-3),
        appliedAt: rel(-2), // sent this week (2 days ago)
        updatedAt: rel(-2),
        demo: true
      },
      {
        id: "demo_2",
        company: "Nexus Data Dynamics",
        role: "Data Analyst Intern",
        deadline: relDateStr(5), // 5 days left
        status: "Applied",
        riskLevel: "low",
        matchPercent: 70,
        createdAt: rel(-4),
        appliedAt: rel(-4), // sent this week (4 days ago)
        updatedAt: rel(-4),
        demo: true
      },
      {
        id: "demo_3",
        company: "Starlight Digital Studio",
        role: "Frontend Engineering Intern",
        deadline: relDateStr(-2), // 2 days OVERDUE (red)
        status: "Saved",          // Saved & overdue -> triggers discipline deduction & overdue warning!
        riskLevel: "medium",
        matchPercent: 65,
        createdAt: rel(-10),
        appliedAt: null,
        updatedAt: rel(-10),
        demo: true
      },
      {
        id: "demo_4",
        company: "Vanguard Robotics",
        role: "Software Engineering Intern",
        deadline: relDateStr(12),
        status: "Interview",
        riskLevel: "low",
        matchPercent: 90,
        createdAt: rel(-14),
        appliedAt: rel(-9), // sent last week (9 days ago) -> 1 last week
        updatedAt: rel(-1), // progressed this week (1 day ago)
        demo: true
      },
      {
        id: "demo_5",
        company: "Global Tech Partners",
        role: "Trainee Developer Intern",
        deadline: null,     // No deadline -> tests missing deadline handling (sorted last)
        status: "Offer",
        riskLevel: "low",
        matchPercent: null, // Tests missing match percent ("Not estimated")
        createdAt: rel(-18),
        appliedAt: rel(-15),
        updatedAt: rel(-2),
        demo: true
      },
      {
        id: "demo_6",
        company: "RapidLaunch Ventures",
        role: "Backend Systems Intern",
        deadline: relDateStr(20),
        status: "Rejected",
        riskLevel: "medium",
        matchPercent: 40,
        createdAt: rel(-25),
        appliedAt: rel(-18), // sent 18 days ago (2 weeks ago, outside last week)
        updatedAt: rel(-6),
        demo: true
      }
    ];

    try {
      const existing = loadApplications().filter(a => !a.demo);
      const combined = [...demoApps, ...existing];
      localStorage.setItem("internpilot_apps", JSON.stringify(combined));
      renderAll();
    } catch (err) {
      console.error("Error setting demo data in localStorage:", err);
    }
  });

  // Clear All with confirmation
  clearAllBtn.addEventListener("click", () => {
    if (confirm("Are you sure you want to clear all applications in your tracker?")) {
      try {
        localStorage.removeItem("internpilot_apps");
        aiSummaryCard.style.display = "none";
        renderAll();
      } catch (err) {
        console.error("Error clearing tracker:", err);
      }
    }
  });

  // Optional: AI Weekly Summary
  // Wrapped strictly in try/catch; failure hides it without breaking the page.
  weeklySummaryBtn.addEventListener("click", async () => {
    await generateWeeklySummary();
  });

  async function generateWeeklySummary() {
    try {
      const apps = loadApplications();
      const activity = computeActivity(apps, new Date());

      // Send ONLY anonymous counts (never company names or resume text)
      const countsPayload = {
        sentThisWeek: activity.thisWeek.sent,
        sentLastWeek: activity.lastWeek.sent,
        savedThisWeek: activity.thisWeek.saved,
        progressedThisWeek: activity.thisWeek.progressed,
        overdueSaved: activity.overdueSaved,
        score: activity.score,
        level: activity.level
      };

      weeklySummaryBtn.disabled = true;
      weeklySummaryBtn.textContent = "Summarizing...";

      const prompt = `Based ONLY on these weekly job search activity counts, write a 2 to 3 sentence encouraging summary for a student. Be practical, friendly, and brief. No markdown.
Counts: Sent this week: ${countsPayload.sentThisWeek}, Sent last week: ${countsPayload.sentLastWeek}, Saved this week: ${countsPayload.savedThisWeek}, Progressed to interview/offer: ${countsPayload.progressedThisWeek}, Overdue saved: ${countsPayload.overdueSaved}, Activity score: ${countsPayload.score}/100 (${countsPayload.level}).`;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12000);

      const res = await fetch("/api/gemini", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (!res.ok) {
        throw new Error(`API returned ${res.status}`);
      }

      const data = await res.json();
      if (data.answer && data.answer.trim()) {
        aiSummaryText.textContent = data.answer.trim();
        aiSummaryCard.style.display = "block";
      } else {
        aiSummaryCard.style.display = "none";
      }
    } catch (err) {
      console.warn("AI weekly summary unavailable:", err.message);
      // Graceful fallback: hide without breaking page
      aiSummaryCard.style.display = "none";
    } finally {
      weeklySummaryBtn.disabled = false;
      weeklySummaryBtn.innerHTML = `
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
        Weekly summary
      `;
    }
  }

  function escapeHtml(str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  // Initial render on load
  renderAll();
});
