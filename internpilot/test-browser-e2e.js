const { spawn } = require('child_process');
const path = require('path');
const os = require('os');

const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const PORT = 3000;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runBrowserE2E() {
  console.log("===============================================================");
  console.log("     INTERNPILOT REAL CHROME BROWSER END-TO-END TEST           ");
  console.log("===============================================================\n");

  // 1. Start Server
  let serverProcess = null;
  try {
    const probe = await fetch(`http://localhost:${PORT}/api/test-postings`);
    if (probe.ok) {
      console.log(`1. InternPilot Express server is already running on port ${PORT}...`);
    }
  } catch {
    console.log("1. Starting InternPilot Express server...");
    serverProcess = spawn('node', ['server.js'], {
      cwd: __dirname,
      stdio: 'pipe'
    });
    await sleep(1500);
  }

  // 2. Launch Headless Chrome with Remote Debugging
  console.log("2. Launching Chrome (Headless) on port 9222...");
  const chromeProcess = spawn(CHROME_PATH, [
    '--headless=new',
    '--no-sandbox',
    '--remote-debugging-port=9222',
    `--user-data-dir=${path.join(os.tmpdir(), 'chrome-e2e-' + Date.now())}`,
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    `http://localhost:${PORT}`
  ], { stdio: 'pipe' });

  await sleep(2500);

  // 3. Connect to Chrome CDP WebSocket
  console.log("3. Connecting to Chrome via DevTools Protocol (CDP)...");
  let wsUrl = null;
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const res = await fetch('http://127.0.0.1:9222/json');
      const tabs = await res.json();
      const pageTab = tabs.find(t => t.type === 'page' && t.url.includes(`localhost:${PORT}`));
      if (pageTab) {
        wsUrl = pageTab.webSocketDebuggerUrl;
        break;
      }
    } catch {
      await sleep(1000);
    }
  }

  if (!wsUrl) {
    console.error("Could not obtain Chrome WebSocket URL");
    chromeProcess.kill();
    if (serverProcess) serverProcess.kill();
    process.exit(1);
  }

  const ws = new WebSocket(wsUrl);
  let cmdId = 0;
  const callbacks = new Map();

  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.method === 'Runtime.consoleAPICalled') {
      const text = msg.params.args.map(a => a.value).join(' ');
      console.log(`  [Chrome Console]: ${text}`);
    }
    if (msg.id && callbacks.has(msg.id)) {
      const { resolve, reject } = callbacks.get(msg.id);
      callbacks.delete(msg.id);
      if (msg.error) reject(msg.error);
      else resolve(msg.result);
    }
  };

  await new Promise(resolve => ws.onopen = resolve);

  async function cdpSend(method, params = {}) {
    const id = ++cmdId;
    return new Promise((resolve, reject) => {
      callbacks.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });
  }

  await cdpSend('Runtime.enable');

  async function evalInBrowser(expression) {
    const res = await cdpSend('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true
    });
    return res.result?.value;
  }

  // Helper to select posting and verify value
  async function selectPosting(id) {
    const res = await evalInBrowser(`(() => {
      const sel = document.getElementById('sample-posting-select');
      const idx = Array.from(sel.options).findIndex(o => o.value === '${id}');
      if (idx !== -1) {
        sel.selectedIndex = idx;
        sel.dispatchEvent(new Event('change', { bubbles: true }));
        return { success: true, selectedIndex: idx, val: sel.value, inputVal: document.getElementById('posting-input').value.substring(0, 40) };
      }
      return { success: false };
    })()`);
    console.log("  (selectPosting result:", res, ")");
    await sleep(300);
  }

  async function waitForIdle() {
    for (let i = 0; i < 40; i++) {
      const disabled = await evalInBrowser(`document.getElementById('run-btn').disabled`);
      if (!disabled) return;
      await sleep(300);
    }
  }

  console.log("✓ Connected to browser successfully.\n");

  let allPassed = true;

  // -------------------------------------------------------------
  // Test A: Load Sample Resume & Postings Dropdown
  // -------------------------------------------------------------
  console.log("▶ [BROWSER TEST 1] Testing Sample Resume Loader...");
  await evalInBrowser(`document.getElementById('load-sample-resume-btn').click()`);
  await sleep(600);
  const resumeText = await evalInBrowser(`document.getElementById('resume-input').value`);
  if (resumeText && resumeText.includes("ROHAN SHARMA")) {
    console.log("  ✓ Sample resume loaded into textarea successfully (Rohan Sharma).");
  } else {
    console.error("  ✗ FAILED: Sample resume not loaded.");
    allPassed = false;
  }

  // -------------------------------------------------------------
  // Test B: Test Path 1 - SCAM POSTING
  // -------------------------------------------------------------
  console.log("\n▶ [BROWSER TEST 2] Testing Path 1: Scam Posting (scam-1)...");
  await selectPosting('scam-1');

  // Click Run InternPilot
  await evalInBrowser(`document.getElementById('run-btn').click()`);
  
  // Wait for match-halt or learn-first to render in live-log
  for (let i = 0; i < 30; i++) {
    const hasMatch = await evalInBrowser(`document.getElementById('live-log').innerText.includes('Learn these first')`);
    if (hasMatch) break;
    await sleep(300);
  }

  const logHtmlScam = await evalInBrowser(`document.getElementById('live-log').innerHTML`);
  const logTextScam = await evalInBrowser(`document.getElementById('live-log').innerText`);

  const hasScamHalt = logHtmlScam.includes('High Scam Risk') || logHtmlScam.includes('alert-danger');
  const hasSafetyTips = logTextScam.includes('Never pay any registration fee') && logTextScam.includes('Never share Aadhaar');
  const hasDecisionScam = logTextScam.includes('Decision: high scam risk, skipping matching and email');
  const hasNoEmailScam = !logHtmlScam.includes('email-draft-card');

  if (hasScamHalt && hasSafetyTips && hasDecisionScam && hasNoEmailScam) {
    console.log("  ✓ Scam posting correctly stopped at scam check.");
    console.log("  ✓ Red warning banner displayed with evidence.");
    console.log("  ✓ Essential safety tips displayed.");
    console.log("  ✓ Log shows: 'Decision: high scam risk, skipping matching and email.'");
    console.log("  ✓ No email draft rendered.");
  } else {
    console.error("  ✗ FAILED: Scam posting did not behave as expected.");
    allPassed = false;
  }

  // Test "Continue anyway" button click
  console.log("  Testing 'Continue anyway' button click...");
  await evalInBrowser(`
    const btn = document.querySelector('.btn-continue-anyway');
    if (btn) btn.click();
  `);
  await sleep(1500);
  const logTextAfterContinue = await evalInBrowser(`document.getElementById('live-log').innerText`);
  if (logTextAfterContinue.includes('User chose to continue anyway')) {
    console.log("  ✓ 'Continue anyway' clicked: successfully resumed flow!");
  } else {
    console.error("  ✗ FAILED: 'Continue anyway' did not resume.");
    allPassed = false;
  }

  await waitForIdle();

  // -------------------------------------------------------------
  // Test C: Test Path 2 - LOW MATCH POSTING
  // -------------------------------------------------------------
  console.log("\n▶ [BROWSER TEST 3] Testing Path 2: Low Match Posting (lowmatch-1)...");
  await selectPosting('lowmatch-1');

  // Click Run InternPilot
  await evalInBrowser(`document.getElementById('run-btn').click()`);
  
  // Wait for match-halt or learn-first to render in live-log
  for (let i = 0; i < 30; i++) {
    const hasMatch = await evalInBrowser(`document.getElementById('live-log').innerText.includes('Learn these first')`);
    if (hasMatch) break;
    await sleep(300);
  }

  const logHtmlLow = await evalInBrowser(`document.getElementById('live-log').innerHTML`);
  const logTextLow = await evalInBrowser(`document.getElementById('live-log').innerText`);

  const hasMatchHalt = logTextLow.includes('about 17% match') || logTextLow.includes('about 17%');
  const hasLearnFirst = logTextLow.includes('Learn these first:');
  const hasMissingSkills = logTextLow.includes('pytorch') || logTextLow.includes('tensorflow');
  const hasDecisionLow = logTextLow.includes('Decision: match is very low, suggesting skills to learn first');
  const hasNoEmailLow = !logHtmlLow.includes('email-draft-card');

  if (hasMatchHalt && hasLearnFirst && hasMissingSkills && hasDecisionLow && hasNoEmailLow) {
    console.log("  ✓ Low-match posting correctly stopped at skill match.");
    console.log("  ✓ Calculated alignment: about 17% match.");
    console.log("  ✓ 'Learn these first' list displayed with missing skills.");
    console.log("  ✓ Log shows: 'Decision: match is very low, suggesting skills to learn first.'");
    console.log("  ✓ No email draft rendered.");
  } else {
    console.error("  ✗ FAILED: Low match posting did not halt correctly.");
    console.error("  Log text was:\n", logTextLow);
    allPassed = false;
  }

  // Test "Draft anyway" button click
  console.log("  Testing 'Draft anyway' button click...");
  const btnFound = await evalInBrowser(`(() => {
    const btn = document.querySelector('.btn-draft-anyway');
    if (!btn) return 'NOT_FOUND';
    btn.click();
    return 'CLICKED: ' + btn.textContent + ' (disabled=' + btn.disabled + ')';
  })()`);
  console.log("  btnClick result:", btnFound);
  await sleep(1500);
  const logTextAfterDraft = await evalInBrowser(`document.getElementById('live-log').innerText`);
  if (logTextAfterDraft.includes('User chose to draft email anyway')) {
    console.log("  ✓ 'Draft anyway' clicked: successfully resumed flow!");
  } else {
    console.error("  ✗ FAILED: 'Draft anyway' did not resume.");
    console.log("  [DEBUG logTextAfterDraft]:", logTextAfterDraft);
    allPassed = false;
  }

  await waitForIdle();

  // -------------------------------------------------------------
  // Test D: Test Path 3 - GENUINE POSTING & TRACKER SAVE
  // -------------------------------------------------------------
  console.log("\n▶ [BROWSER TEST 4] Testing Path 3: Genuine Posting (genuine-1)...");
  // Clear localStorage first
  await evalInBrowser(`localStorage.clear()`);
  await selectPosting('genuine-1');

  // Click Run InternPilot
  await evalInBrowser(`document.getElementById('run-btn').click()`);
  
  // Wait for tracker prompt to render in live-log
  for (let i = 0; i < 30; i++) {
    const hasPrompt = await evalInBrowser(`!!document.querySelector('.tracker-yes-btn')`);
    if (hasPrompt) break;
    await sleep(300);
  }

  const logHtmlGen = await evalInBrowser(`document.getElementById('live-log').innerHTML`);
  const logTextGen = await evalInBrowser(`document.getElementById('live-log').innerText`);

  const hasGoodMatch = logTextGen.includes('about 83% match');
  const hasTrackerPrompt = logTextGen.includes('Add this application to your tracker?');

  if (hasGoodMatch && hasTrackerPrompt) {
    console.log("  ✓ Genuine posting evaluated successfully with about 83% match.");
    console.log("  ✓ Tracker prompted user: 'Add this application to your tracker?'");
  } else {
    console.error("  ✗ FAILED: Genuine posting did not prompt tracker.");
    console.error("  Log text was:\n", logTextGen);
    allPassed = false;
  }

  // Check that NOTHING is saved initially in localStorage
  const savedCountBefore = await evalInBrowser(`(JSON.parse(localStorage.getItem('internpilot_apps') || '[]')).length`);
  if (savedCountBefore === 0) {
    console.log("  ✓ Confirmed: 0 applications in localStorage (Never auto-saved).");
  } else {
    console.error("  ✗ FAILED: Application was saved before clicking Yes!");
    allPassed = false;
  }

  // Click "Yes, save"
  console.log("  Clicking 'Yes, save' in browser...");
  await evalInBrowser(`document.querySelector('.tracker-yes-btn').click()`);
  await sleep(600);

  const savedApps = await evalInBrowser(`JSON.parse(localStorage.getItem('internpilot_apps') || '[]')`);
  if (savedApps && savedApps.length === 1) {
    console.log("  ✓ Confirmed: 1 application saved to localStorage on 'Yes' click!");
    console.log(`    Company: ${savedApps[0].company} | Role: ${savedApps[0].role} | Status: ${savedApps[0].status}`);
  } else {
    console.error("  ✗ FAILED: Application not saved after clicking Yes.");
    allPassed = false;
  }

  // -------------------------------------------------------------
  // Test E: Navigate to tracker.html in Browser
  // -------------------------------------------------------------
  console.log("\n▶ [BROWSER TEST 5] Testing Application Tracker Page (tracker.html)...");
  await evalInBrowser(`window.location.href = 'tracker.html'`);
  await sleep(1500);

  const trackerText = await evalInBrowser(`document.body.innerText`);

  if (trackerText.includes("Company from posting") || trackerText.includes("Total applications") || trackerText.includes("Apex Cloud Technologies")) {
    console.log("  ✓ tracker.html successfully loaded and displayed the saved application!");
  } else {
    console.error("  ✗ FAILED: tracker.html did not display the saved application.");
    allPassed = false;
  }

  // -------------------------------------------------------------
  // Test F: Test "Load demo data" and Activity Score in Browser
  // -------------------------------------------------------------
  console.log("\n▶ [BROWSER TEST 6] Testing 'Load demo data' on Tracker Page...");
  await evalInBrowser(`document.getElementById('load-demo-btn').click()`);
  await sleep(600);

  const trackerDemoText = await evalInBrowser(`document.body.innerText`);
  const hasDemoApps = trackerDemoText.includes("Acme Cloud Labs") && trackerDemoText.includes("Nexus Data Dynamics");
  const hasTrendUp = trackerDemoText.includes("↑ from 1 last week");
  const hasOverdueAction = trackerDemoText.includes("You have 1 saved application past their deadline");

  if (hasDemoApps && hasTrendUp && hasOverdueAction) {
    console.log("  ✓ Demo data loaded with relative dates successfully.");
    console.log("  ✓ Activity Report displays trend arrow UP (↑ from 1 last week).");
    console.log("  ✓ Overdue saved warning displayed in Next Action callout.");
  } else {
    console.error("  ✗ FAILED: Demo data or activity report did not update as expected.");
    console.log("  [DEBUG hasDemoApps]:", hasDemoApps);
    console.log("  [DEBUG hasTrendUp]:", hasTrendUp);
    console.log("  [DEBUG hasOverdueAction]:", hasOverdueAction);
    console.log("  [DEBUG trackerDemoText snippet]:", trackerDemoText.substring(0, 400));
    allPassed = false;
  }

  // -------------------------------------------------------------
  // Test G: Tracker Footer & Buttons Height (44px min)
  // -------------------------------------------------------------
  console.log("\n▶ [BROWSER TEST 7] Testing Tracker Footer & Button Heights...");
  const trackerFooterText = await evalInBrowser(`document.querySelector('.app-footer').innerText`);
  const expectedFooter = "InternPilot gives warning signs, not proof. Always verify a company yourself. Your resume stays in your browser; posting and resume text are sent to Google's Gemini API only when you run the agent.";
  if (trackerFooterText.includes("InternPilot gives warning signs, not proof")) {
    console.log("  ✓ tracker.html footer contains required disclaimer.");
  } else {
    console.error("  ✗ FAILED: tracker.html footer missing disclaimer.");
    allPassed = false;
  }

  // Navigate back to index.html to test polish pass requirements
  console.log("\n▶ [BROWSER TEST 8] Testing Polish Pass on index.html (Mobile 375px, 44px buttons, Demo toggle, Edge cases)...");
  await evalInBrowser(`window.location.href = 'index.html'`);
  await sleep(1500);

  // 1. Accessibility: aria-live="polite" on live-log
  const ariaLiveVal = await evalInBrowser(`document.getElementById('live-log').getAttribute('aria-live')`);
  if (ariaLiveVal === 'polite') {
    console.log("  ✓ #live-log has aria-live='polite' for screen readers.");
  } else {
    console.error("  ✗ FAILED: #live-log missing aria-live='polite' (got: " + ariaLiveVal + ")");
    allPassed = false;
  }

  // 2. Buttons min-height >= 44px
  const btnHeights = await evalInBrowser(`(() => {
    const buttons = Array.from(document.querySelectorAll('button, .nav-link-btn, select'));
    return buttons.map(b => ({
      tag: b.tagName,
      id: b.id || b.className,
      height: Math.round(b.getBoundingClientRect().height)
    }));
  })()`);
  const anyTooShort = btnHeights.find(b => b.height < 44);
  if (!anyTooShort) {
    console.log("  ✓ All interactive buttons & inputs meet min 44px touch height.");
  } else {
    console.error("  ✗ FAILED: Button below 44px:", anyTooShort);
    allPassed = false;
  }

  // 3. index.html Footer
  const indexFooterText = await evalInBrowser(`document.querySelector('.app-footer').innerText`);
  if (indexFooterText.includes("InternPilot gives warning signs, not proof")) {
    console.log("  ✓ index.html footer contains required disclaimer.");
  } else {
    console.error("  ✗ FAILED: index.html footer missing disclaimer.");
    allPassed = false;
  }

  // 4. Edge Case: Empty posting submission
  console.log("  Testing edge case: Empty posting...");
  await evalInBrowser(`
    document.getElementById('posting-input').value = '';
    document.getElementById('run-btn').click();
  `);
  await sleep(400);
  const logAfterEmpty = await evalInBrowser(`document.getElementById('live-log').innerText`);
  if (logAfterEmpty.includes("Please paste an internship or job posting text first.")) {
    console.log("  ✓ Empty posting handled gracefully with friendly log message without crashing.");
  } else {
    console.error("  ✗ FAILED: Empty posting did not show friendly message.");
    allPassed = false;
  }

  // 5. Edge Case: Long posting (> 5,000 characters)
  console.log("  Testing edge case: Very long posting (>5,000 chars)...");
  await evalInBrowser(`(() => {
    const longText = "Apex Cloud Technologies is hiring a Junior Web Developer Intern. " + "A".repeat(5200) + " All candidates must pay a registration fee of Rs 500.";
    document.getElementById('posting-input').value = longText;
    document.getElementById('run-btn').click();
  })()`);
  await sleep(1500);
  const logAfterLong = await evalInBrowser(`document.getElementById('live-log').innerText`);
  const hasTrimNotice = logAfterLong.includes("Posting text exceeded 5,000 characters and was trimmed for AI analysis");
  const hasFullScamCheck = logAfterLong.includes("HIGH SCAM RISK") || logAfterLong.includes("Asks for money");
  if (hasTrimNotice && hasFullScamCheck) {
    console.log("  ✓ Very long posting (>5,000 chars) logged trim notice.");
    console.log("  ✓ Scam check ran on FULL posting text and caught registration fee at end!");
  } else {
    console.error("  ✗ FAILED: Long posting handling failed.");
    console.log("  [DEBUG hasTrimNotice]:", hasTrimNotice, "[DEBUG hasFullScamCheck]:", hasFullScamCheck);
    allPassed = false;
  }

  // 6. Demo Mode Toggle & Guardrail Test
  console.log("  Testing Demo Mode Toggle & Guardrails...");
  await evalInBrowser(`(() => {
    const toggle = document.getElementById('demo-mode-toggle');
    toggle.checked = true;
    toggle.dispatchEvent(new Event('change', { bubbles: true }));
  })()`);
  await sleep(300);
  const badgeDisplay = await evalInBrowser(`document.getElementById('demo-badge').style.display`);
  if (badgeDisplay === 'inline-flex') {
    console.log("  ✓ Demo mode toggle shows 'Demo mode: using saved results' badge.");
  } else {
    console.error("  ✗ FAILED: Demo badge not visible when toggle is checked.");
    allPassed = false;
  }

  // Run with non-sample posting while Demo mode is ON
  console.log("  Testing non-sample posting while Demo Mode is ON...");
  await evalInBrowser(`(() => {
    document.getElementById('posting-input').value = "Custom company internship not in samples.";
    document.getElementById('run-btn').click();
  })()`);
  await sleep(800);
  const logDemoGuard = await evalInBrowser(`document.getElementById('live-log').innerText`);
  if (logDemoGuard.includes("Demo mode only covers the sample postings with the sample resume")) {
    console.log("  ✓ Non-sample posting in Demo Mode showed guardrail message.");
  } else {
    console.error("  ✗ FAILED: Demo mode guardrail did not show expected message.");
    console.log("  [DEBUG logDemoGuard]:", logDemoGuard);
    allPassed = false;
  }

  // 7. Mobile 375px Viewport Test (Zero horizontal scrolling)
  console.log("  Testing Mobile 375px Viewport for zero horizontal scroll...");
  await cdpSend('Emulation.setDeviceMetricsOverride', {
    width: 375,
    height: 667,
    deviceScaleFactor: 2,
    mobile: true
  });
  await sleep(500);
  const scrollInfo = await evalInBrowser(`(() => {
    return {
      windowWidth: window.innerWidth,
      docScrollWidth: document.documentElement.scrollWidth,
      bodyScrollWidth: document.body.scrollWidth,
      hasOverflow: document.documentElement.scrollWidth > window.innerWidth
    };
  })()`);
  if (!scrollInfo.hasOverflow) {
    console.log(`  ✓ Mobile 375px verified: viewport=${scrollInfo.windowWidth}px, scrollWidth=${scrollInfo.docScrollWidth}px (No horizontal scroll!).`);
  } else {
    console.error("  ✗ FAILED: Horizontal scroll overflow on 375px mobile viewport:", scrollInfo);
    allPassed = false;
  }

  // Cleanup
  ws.close();
  chromeProcess.kill();
  if (serverProcess) serverProcess.kill();

  console.log("\n===============================================================");
  if (allPassed) {
    console.log("🎉 ALL REAL BROWSER TESTS PASSED 100%!");
  } else {
    console.log("❌ SOME BROWSER TESTS FAILED.");
    process.exit(1);
  }
  console.log("===============================================================");
}

runBrowserE2E().catch(err => {
  console.error("Browser test error:", err);
  process.exit(1);
});
