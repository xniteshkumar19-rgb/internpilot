/**
 * InternPilot - Capture Job Extraction Screenshots (Inaccessible & Successful)
 */
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const PORT = 3009;
const SHOTS_DIR = path.join(__dirname, 'public', 'screenshots');

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function main() {
  console.log("=== CAPTURING JOB EXTRACTION ACCURACY SCREENSHOTS ===");
  fs.mkdirSync(SHOTS_DIR, { recursive: true });

  // 1. Start server on PORT 3009
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
  const tmp = path.join(os.tmpdir(), 'cap_je_' + Date.now());
  const chr = spawn(CHROME, [
    '--headless=new',
    '--no-sandbox',
    '--disable-gpu',
    '--remote-debugging-port=9229',
    '--user-data-dir=' + tmp,
    '--window-size=1400,900',
    '--force-device-scale-factor=1',
    '--hide-scrollbars',
    '--disable-extensions'
  ], { stdio: 'pipe' });
  await sleep(4000);

  // 3. Connect CDP
  console.log("[3] Connecting CDP on port 9229...");
  let wsUrl = null;
  for (let i = 0; i < 30; i++) {
    try {
      const r = await fetch('http://127.0.0.1:9229/json');
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
      await sleep(1000);
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
    await sleep(3000);
  };

  // ========================================================
  // CAPTURE 1: UNSUCCESSFUL URL EXTRACTION (Inaccessible LinkedIn Short URL)
  // ========================================================
  console.log("\n[4] Capture 1: Inaccessible LinkedIn Short URL (lnkd.in/p/gZWuywFS)...");
  await nav(`http://127.0.0.1:${PORT}/index.html`);

  await ev(`(function(){
    // Uncheck demo mode
    var d = document.getElementById('demo-mode-toggle');
    if (d && d.checked) d.click();

    // Mock the redirect check for offline test environment
    window.originalFetch = window.fetch;
    window.fetch = function(url, opts) {
      if (url === '/api/redirect-check') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            ok: true,
            chain: [
              { url: 'https://lnkd.in/p/gZWuywFS', status: 301, domain: 'lnkd.in' },
              { url: 'https://www.linkedin.com/', status: 200, domain: 'www.linkedin.com' }
            ],
            finalUrl: 'https://www.linkedin.com/',
            finalDomain: 'www.linkedin.com',
            hops: 1,
            message: 'Resolved 1 redirect(s) to www.linkedin.com'
          })
        });
      }
      return window.originalFetch(url, opts);
    };

    var input = document.getElementById('source-url-input');
    if (input) input.value = 'https://lnkd.in/p/gZWuywFS';
    var btn = document.getElementById('btn-find-source');
    if (btn) btn.click();
  })()`);

  await sleep(3000);
  await shot('screenshot-extraction-inaccessible.png', '#source-finder-card');

  // ========================================================
  // CAPTURE 2: MANUAL DESCRIPTION FALLBACK DRAWER OPEN
  // ========================================================
  console.log("\n[5] Capture 2: Manual Description Fallback Drawer...");
  await ev(`(function(){
    var btn = document.getElementById('btn-toggle-manual-paste');
    if (btn) btn.click();
    var sampleBtn = document.getElementById('btn-sample-manual-job');
    if (sampleBtn) sampleBtn.click();
  })()`);

  await sleep(1500);
  await shot('screenshot-extraction-manual-drawer.png', '#source-finder-card');

  // ========================================================
  // CAPTURE 3: SUCCESSFUL EXTRACTION (Evidence-based & Grounded)
  // ========================================================
  console.log("\n[6] Capture 3: Successful Grounded Extraction...");
  await ev(`(function(){
    var submitBtn = document.getElementById('btn-submit-manual-job');
    if (submitBtn) submitBtn.click();
  })()`);

  await sleep(2500);
  await shot('screenshot-extraction-successful.png', '#source-finder-card');

  // ========================================================
  // CAPTURE 4: AI INTERNSHIP AUTHENTICITY ASSESSMENT CARD
  // ========================================================
  console.log("\n[7] Capture 4: AI Internship Authenticity Assessment Card...");
  await shot('screenshot-ai-authenticity-card.png', '#ai-authenticity-card');

  // Cleanup
  console.log("\n[8] Cleanup...");
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
