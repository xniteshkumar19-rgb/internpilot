/**
 * InternPilot Screenshot Capture v4
 * Uses Node 24 native fetch and WebSocket.
 * Filters CDP targets to only "page" type.
 */
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const PORT = 3003;
const SHOTS_DIR = path.join(__dirname, 'public', 'screenshots');

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function main() {
  console.log("=== CAPTURE v4 START ===");
  fs.mkdirSync(SHOTS_DIR, { recursive: true });

  // 1. Start server
  console.log("[1] Server...");
  const srv = spawn('node', ['server.js'], {
    cwd: __dirname, stdio: 'pipe',
    env: { ...process.env, PORT: String(PORT) }
  });
  srv.stdout.on('data', d => process.stdout.write('[srv] ' + d));
  srv.stderr.on('data', d => process.stderr.write('[srv-err] ' + d));
  await sleep(3000);

  const healthRes = await fetch(`http://127.0.0.1:${PORT}/api`);
  const health = await healthRes.json();
  console.log("  Health:", health.status);

  // 2. Chrome
  console.log("[2] Chrome...");
  const tmp = path.join(os.tmpdir(), 'cap4_' + Date.now());
  const chr = spawn(CHROME, [
    '--headless=new', '--no-sandbox', '--disable-gpu',
    '--remote-debugging-port=9225',
    '--user-data-dir=' + tmp,
    '--window-size=1400,900',
    '--force-device-scale-factor=1',
    '--hide-scrollbars',
    '--disable-extensions'
  ], { stdio: 'pipe' });
  chr.stderr.on('data', d => {
    const s = d.toString();
    if (s.includes('DevTools')) console.log('  ' + s.trim());
  });
  await sleep(5000);

  // 3. CDP
  console.log("[3] CDP connect...");
  let wsUrl = null;
  for (let i = 0; i < 30; i++) {
    try {
      const r = await fetch('http://127.0.0.1:9225/json');
      const tabs = await r.json();
      // Filter to page type only
      const page = tabs.find(t => t.type === 'page');
      if (page && page.webSocketDebuggerUrl) {
        wsUrl = page.webSocketDebuggerUrl;
        break;
      }
    } catch (e) {
      if (i % 5 === 0) console.log('  retry ' + i + '...');
    }
    await sleep(500);
  }

  if (!wsUrl) {
    console.error("FATAL: No CDP page target found");
    chr.kill(); srv.kill(); process.exit(1);
  }
  console.log("  WS:", wsUrl);

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

  await new Promise(r => { ws.onopen = r; });
  console.log("  Connected!");

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
  const shot = async name => {
    const { data } = await cdp('Page.captureScreenshot', { format: 'png' });
    const fp = path.join(SHOTS_DIR, name);
    fs.writeFileSync(fp, Buffer.from(data, 'base64'));
    console.log('  >> ' + name + ' (' + (fs.statSync(fp).size / 1024).toFixed(1) + 'KB)');
  };

  const go = async url => {
    await cdp('Page.navigate', { url });
    await sleep(3500);
  };

  // ========== CAREERMATCH ==========
  console.log("\n[4] CareerMatch...");
  await go(`http://127.0.0.1:${PORT}/index.html`);

  await ev(`(function(){var d=document.getElementById('demo-mode-toggle');if(d&&!d.checked)d.click()})()`);
  await sleep(300);
  await ev(`(function(){var b=document.getElementById('load-sample-resume-btn');if(b)b.click()})()`);
  await sleep(300);
  await ev(`(function(){var s=document.getElementById('sample-posting-select');if(s){s.value='genuine-1';s.dispatchEvent(new Event('change',{bubbles:true}))}})()`);
  await sleep(800);

  console.log("  Run analysis...");
  await ev(`(function(){document.getElementById('run-btn').click()})()`);
  await sleep(6000);

  // Save
  await ev(`(function(){var b=document.querySelector('.btn-cm-save-progress');if(b)b.click()})()`);
  await sleep(1500);

  // Shot 1: PDF report area
  await ev(`(function(){var c=document.querySelector('.careermatch-container');if(c)c.scrollIntoView({behavior:'instant',block:'start'})})()`);
  await sleep(800);
  await shot('screenshot-pdf-report.png');

  // Shot 2: Saved analyses
  await ev(`(function(){var s=document.getElementById('saved-analyses-section');if(s)s.scrollIntoView({behavior:'instant',block:'start'})})()`);
  await sleep(800);
  await shot('screenshot-saved-analyses.png');

  // ========== INTERVIEW ==========
  console.log("\n[5] Interview...");
  await go(`http://127.0.0.1:${PORT}/interview.html`);

  await ev(`(function(){var b=document.getElementById('btn-prefill-sample');if(b)b.click()})()`);
  await sleep(300);
  await ev(`(function(){var d=document.getElementById('studio-demo-toggle');if(d&&!d.checked)d.click()})()`);
  await sleep(800);

  // Shot 3: Dashboard
  await shot('screenshot-interview-dashboard.png');

  // Start
  console.log("  Start interview...");
  await ev(`(function(){document.getElementById('btn-start-interview').click()})()`);
  await sleep(3500);

  // Shot 4: Question
  await shot('screenshot-interview-question.png');

  // Answer + submit
  console.log("  Submit answer...");
  await ev(`(function(){var t=document.getElementById('student-answer-input');if(t){t.value="React uses a Virtual DOM, an in-memory lightweight copy of the real DOM. On state change, React builds a new virtual tree, diffs it with the old one via reconciliation, then patches only changed nodes. In my project I used React.memo and useMemo to cut re-renders by 60 percent, improving load time from 2.8s to 1.1s.";t.dispatchEvent(new Event('input',{bubbles:true}))}})()`);
  await sleep(300);
  await ev(`(function(){var b=document.getElementById('btn-submit-answer');if(b)b.click()})()`);
  await sleep(3500);

  // Shot 5: Evaluation
  await ev(`(function(){var e=document.getElementById('live-eval-card');if(e)e.scrollIntoView({behavior:'instant',block:'start'})})()`);
  await sleep(800);
  await shot('screenshot-interview-evaluation.png');

  // Remaining questions
  console.log("  Remaining Qs...");
  const ans = [
    "Using STAR method in my capstone: two teammates disagreed on API design. I organized a review meeting to compare REST vs GraphQL for our latency needs. We agreed on REST with field selection, satisfying both and shipping on time.",
    "My debugging skill is my core strength. When CI broke before demo day, I traced 12 log files, found a race condition in DB seeding, and fixed it in 4 hours with thorough documentation for the team.",
    "I chose your company because your accessible design systems align with my thesis on inclusive UI patterns. I contributed to open-source accessibility tools and want to apply evidence-based testing at enterprise scale.",
    "Under a tight deadline I prioritized the core onboarding flow, broke work into 4-hour sprint blocks, communicated blockers via daily standups, and delivered MVP 2 days ahead of schedule."
  ];
  for (let i = 0; i < 4; i++) {
    await ev(`(function(){var b=document.getElementById('btn-next-question');if(b)b.click()})()`);
    await sleep(2000);
    await ev(`(function(){var t=document.getElementById('student-answer-input');if(t){t.value=${JSON.stringify(ans[i])};t.dispatchEvent(new Event('input',{bubbles:true}))}})()`);
    await sleep(200);
    await ev(`(function(){var b=document.getElementById('btn-submit-answer');if(b)b.click()})()`);
    await sleep(3000);
  }

  // Final report
  console.log("  Final report...");
  await ev(`(function(){var b=document.getElementById('btn-next-question');if(b)b.click()})()`);
  await sleep(3500);
  await ev(`(function(){var r=document.getElementById('view-report');if(r)r.scrollIntoView({behavior:'instant',block:'start'})})()`);
  await sleep(1200);

  // Shot 6: Report
  await shot('screenshot-interview-report.png');

  // Done
  ws.close();
  chr.kill();
  srv.kill();

  console.log("\n[6] Final check:");
  const names = [
    'screenshot-pdf-report.png','screenshot-saved-analyses.png',
    'screenshot-interview-dashboard.png','screenshot-interview-question.png',
    'screenshot-interview-evaluation.png','screenshot-interview-report.png'
  ];
  let pass = true;
  for (const n of names) {
    const p = path.join(SHOTS_DIR, n);
    if (fs.existsSync(p)) {
      const sz = fs.statSync(p).size;
      const ok = sz > 5000;
      console.log(`  ${ok?'OK':'WARN'}: ${n} (${(sz/1024).toFixed(1)} KB)`);
      if (!ok) pass = false;
    } else { console.log('  MISSING: ' + n); pass = false; }
  }
  console.log(pass ? "\n=== ALL 6 CAPTURED ===" : "\n=== ISSUES ===");
  process.exit(pass ? 0 : 1);
}

setTimeout(() => { console.error("GLOBAL TIMEOUT"); process.exit(2); }, 120000);
main().catch(e => { console.error("ERR:", e); process.exit(1); });
