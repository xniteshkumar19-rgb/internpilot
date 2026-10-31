/**
 * InternPilot - Capture Source Finder and Updated Workflow Screenshots
 */
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const PORT = 3006;
const SHOTS_DIR = path.join(__dirname, 'public', 'screenshots');

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function main() {
  console.log("=== CAPTURING SOURCE FINDER & UPDATED WORKFLOW SCREENSHOTS ===");
  fs.mkdirSync(SHOTS_DIR, { recursive: true });

  // 1. Start server on PORT 3004
  console.log("[1] Starting server on port " + PORT + "...");
  const srv = spawn('node', ['server.js'], {
    cwd: __dirname,
    stdio: 'pipe',
    env: { ...process.env, PORT: String(PORT) }
  });
  srv.stdout.on('data', d => process.stdout.write('[srv] ' + d));
  await sleep(3000);

  // 2. Launch Chrome
  console.log("[2] Launching Chrome headless...");
  const tmp = path.join(os.tmpdir(), 'cap_sf_' + Date.now());
  const chr = spawn(CHROME, [
    '--headless=new',
    '--no-sandbox',
    '--disable-gpu',
    '--remote-debugging-port=9226',
    '--user-data-dir=' + tmp,
    '--window-size=1400,900',
    '--force-device-scale-factor=1',
    '--hide-scrollbars',
    '--disable-extensions'
  ], { stdio: 'pipe' });
  await sleep(5000);

  // 3. Connect CDP
  console.log("[3] Connecting CDP on port 9226...");
  let wsUrl = null;
  for (let i = 0; i < 30; i++) {
    try {
      const r = await fetch('http://127.0.0.1:9226/json');
      const tabs = await r.json();
      const page = tabs.find(t => t.type === 'page');
      if (page && page.webSocketDebuggerUrl) {
        wsUrl = page.webSocketDebuggerUrl;
        break;
      }
    } catch {}
    await sleep(500);
  }

  if (!wsUrl) {
    console.error("FATAL: No CDP connection");
    chr.kill(); srv.kill(); process.exit(1);
  }

  const ws = new WebSocket(wsUrl);
  let cmdId = 0;
  const pending = new Map();

  ws.onmessage = evt => {
    try {
      const msg = JSON.parse(evt.data);
      if (msg.id && pending.has(msg.id)) {
        const { res, rej } = pending.get(msg.id);
        pending.delete(msg.id);
        msg.error ? rej(new Error(JSON.stringify(msg.error))) : res(msg.result);
      }
    } catch {}
  };

  await new Promise(r => ws.onopen = r);
  console.log("  CDP connected.");

  const cdp = (method, params = {}) => {
    const id = ++cmdId;
    return new Promise((res, rej) => {
      const t = setTimeout(() => { pending.delete(id); rej(new Error('timeout:' + method)); }, 20000);
      pending.set(id, {
        res: v => { clearTimeout(t); res(v); },
        rej: e => { clearTimeout(t); rej(e); }
      });
      ws.send(JSON.stringify({ id, method, params }));
    });
  };

  await cdp('Page.enable');
  await cdp('Runtime.enable');

  const ev = code => cdp('Runtime.evaluate', { expression: code, returnByValue: true });
  const shot = async (name, scrollSelector = null) => {
    if (scrollSelector) {
      await ev(`(function(){
        var el = document.querySelector('${scrollSelector}');
        if (el) {
          el.scrollIntoView({ behavior: 'instant', block: 'start' });
        }
      })()`);
      await sleep(1200);
    }
    const { data } = await cdp('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    const fp = path.join(SHOTS_DIR, name);
    fs.writeFileSync(fp, Buffer.from(data, 'base64'));
    const sz = (fs.statSync(fp).size / 1024).toFixed(1);
    console.log(`  >> Saved: ${name} (${sz} KB)`);
    return fp;
  };

  const nav = async url => {
    await cdp('Page.navigate', { url });
    await sleep(3500);
  };

  // ========================================================
  // SCENARIO 1: SOURCE FINDER - OFFICIAL LISTING FOUND
  // ========================================================
  console.log("\n[4] Scenario 1: Source Finder - Official Listing Found (Apex Cloud)...");
  await nav(`http://127.0.0.1:${PORT}/index.html`);

  // Enable demo mode for deterministic verification
  await ev(`(function(){ var d = document.getElementById('demo-mode-toggle'); if(d && !d.checked) d.click(); })()`);
  await sleep(400);

  // Set input and click Find Original Posting
  await ev(`(function(){
    var input = document.getElementById('source-url-input');
    if (input) input.value = 'https://www.linkedin.com/jobs/view/apex-cloud-junior-web-developer-intern-39218';
    var btn = document.getElementById('btn-find-source');
    if (btn) btn.click();
  })()`);
  await sleep(3000);
  await shot('screenshot-source-finder-official.png', '#source-finder-result');

  // ========================================================
  // SCENARIO 2: SOURCE FINDER - POSSIBLE OFFICIAL MATCH (DIFFS)
  // ========================================================
  console.log("\n[5] Scenario 2: Source Finder - Possible Official Match (Vanguard Labs)...");
  await ev(`(function(){
    var input = document.getElementById('source-url-input');
    if (input) input.value = 'https://internshala.com/internship/detail/frontend-intern-vanguard-data-labs-8812';
    var btn = document.getElementById('btn-find-source');
    if (btn) btn.click();
  })()`);
  await sleep(3000);
  await shot('screenshot-source-finder-diff.png', '#source-finder-result');

  // ========================================================
  // SCENARIO 3: SOURCE FINDER - THIRD-PARTY ONLY
  // ========================================================
  console.log("\n[6] Scenario 3: Source Finder - Third-Party Listing Only (Horizon Next)...");
  await ev(`(function(){
    var input = document.getElementById('source-url-input');
    if (input) input.value = 'https://indeed.com/viewjob?jk=horizon-next-python-intern-4421';
    var btn = document.getElementById('btn-find-source');
    if (btn) btn.click();
  })()`);
  await sleep(3000);
  await shot('screenshot-source-finder-thirdparty.png', '#source-finder-result');

  // ========================================================
  // SCENARIO 4: UPDATED MAIN REVIEW DESK WORKFLOW
  // (Shows 1-click CareerMatch handoff & direct execution)
  // ========================================================
  console.log("\n[7] Scenario 4: Updated Main Review Desk Workflow...");
  // Re-select Apex Cloud and click "Analyse This Internship"
  await ev(`(function(){
    var input = document.getElementById('source-url-input');
    if (input) input.value = 'https://www.linkedin.com/jobs/view/apex-cloud-junior-web-developer-intern-39218';
    var btn = document.getElementById('btn-find-source');
    if (btn) btn.click();
  })()`);
  await sleep(2500);

  // Click Analyse This Internship
  console.log("  Clicking 'Analyse This Internship'...");
  await ev(`(function(){
    var b = document.getElementById('btn-analyse-found-internship');
    if (b) b.click();
  })()`);
  await sleep(1000);

  // Also load sample resume so analysis completes fully
  await ev(`(function(){
    var b = document.getElementById('load-sample-resume-btn');
    if (b) b.click();
    var r = document.getElementById('run-btn');
    if (r) r.click();
  })()`);
  await sleep(5000);
  await shot('screenshot-main-updated.png', '#log');

  // ========================================================
  // SCENARIO 5: ASSISTED SOURCE VERIFICATION OVERVIEW
  // ========================================================
  console.log("\n[8] Scenario 5: Assisted Mode Overview (No API Key Required)...");
  await nav(`http://127.0.0.1:${PORT}/index.html`);

  await ev(`(function(){
    var d = document.getElementById('demo-mode-toggle');
    if (d && !d.checked) d.click();
    var input = document.getElementById('source-url-input');
    if (input) input.value = 'https://www.linkedin.com/jobs/view/apex-cloud-junior-web-developer-intern-39218';
    var btn = document.getElementById('btn-find-source');
    if (btn) btn.click();
  })()`);
  await sleep(3000);
  await shot('screenshot-assisted-mode-overview.png', '.assisted-compare-section');

  // ========================================================
  // SCENARIO 6: ASSISTED MODE COMPARISON - "DETAILS MATCH"
  // ========================================================
  console.log("\n[9] Scenario 6: Assisted Mode Comparison - Details Match...");
  await ev(`(function(){
    var inp = document.getElementById('assisted-official-url-input');
    if (inp) inp.value = 'https://careers.apexcloud.io/internships/junior-web-dev';
    var compBtn = document.getElementById('btn-compare-assisted');
    if (compBtn) compBtn.click();
  })()`);
  await sleep(2500);
  await shot('screenshot-assisted-mode-match.png', '#assisted-comparison-output');

  // ========================================================
  // SCENARIO 7: ASSISTED MODE COMPARISON - "POSSIBLE MATCH" / DIFFS
  // ========================================================
  console.log("\n[10] Scenario 7: Assisted Mode Comparison - Possible Match with Diffs...");
  await ev(`(function(){
    var inp = document.getElementById('assisted-official-url-input');
    if (inp) inp.value = 'https://vanguarddatalabs.com/careers/frontend-engineer-junior';
    var compBtn = document.getElementById('btn-compare-assisted');
    if (compBtn) compBtn.click();
  })()`);
  await sleep(2500);
  await shot('screenshot-assisted-mode-diff.png', '#assisted-comparison-output');

  // Cleanup
  console.log("\n[11] Cleanup...");
  ws.close();
  chr.kill();
  srv.kill();
  console.log("=== ALL CAPTURES COMPLETE ===");
  process.exit(0);
}

main().catch(err => {
  console.error("Capture failed:", err);
  process.exit(1);
});
