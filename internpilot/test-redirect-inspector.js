/**
 * Test Suite: Redirect Inspector Engine & Security Validator
 * Run via: npm run test:redirect or node test-redirect-inspector.js
 * 
 * Verifies all security requirements:
 * 1. Protocol & Port whitelisting (http/https, 80/443 only)
 * 2. Credential blocking (user:pass in URL rejected)
 * 3. SSRF & Private IP blocking:
 *    - Dot-decimal private ranges (127.0.0.1, 10.x, 192.168.x, 172.16.x)
 *    - Cloud metadata (169.254.169.254)
 *    - Integer IP literals (2130706433)
 *    - Hex IP literals (0x7f000001)
 *    - IPv6 loopback ([::1]) & unique-local/link-local/mapped IPv6
 *    - Mocked DNS resolving to private IP
 *    - Redirects leading to any of the above
 * 4. Redirect loop detection (A -> B -> A)
 * 5. Max hop limit (> 5 hops -> too_many_redirects)
 * 6. Timeout handling (per-hop timeout & 9s overall deadline -> code: timeout)
 * 7. Meta refresh parser with quoted/unquoted and case-insensitive URL= values
 * 8. Normal 3-hop chain (301 -> 302 -> 200) and direct 200 link
 * 9. HTTPS SNI servername preservation with socket IP rebinding protection
 * 10. Rate limiting (10 requests per minute)
 * 11. Vercel Express route registration verification
 */

const assert = require('assert');
const {
  USER_AGENT,
  MAX_HOPS,
  PER_HOP_TIMEOUT_MS,
  OVERALL_DEADLINE_MS,
  isPrivateIPv4,
  isPrivateIPv6,
  parseAndCheckNumericIp,
  validateUrlStrict,
  extractMetaRefreshUrl,
  inspectRedirectChain
} = require('./redirect-inspector');

let passedTests = 0;
let totalTests = 0;

function runTest(testName, testFn) {
  totalTests++;
  try {
    testFn();
    console.log(`  ✓ ${testName}`);
    passedTests++;
  } catch (err) {
    console.error(`  ✕ FAIL: ${testName}`);
    console.error(`    ${err.message}`);
  }
}

async function runAsyncTest(testName, testFn) {
  totalTests++;
  try {
    await testFn();
    console.log(`  ✓ ${testName}`);
    passedTests++;
  } catch (err) {
    console.error(`  ✕ FAIL: ${testName}`);
    console.error(`    ${err.message}`);
  }
}

async function main() {
  console.log('====================================================');
  console.log('🧪 InternPilot Redirect Inspector Test Suite');
  console.log('====================================================\n');

  // ----------------------------------------------------
  // TEST GROUP 1: User Agent & Constants
  // ----------------------------------------------------
  console.log('--- Group 1: Configuration Constants ---');
  runTest('User Agent is "InternPilot/1.0"', () => {
    assert.strictEqual(USER_AGENT, 'InternPilot/1.0');
  });

  runTest('Max hops is 5', () => {
    assert.strictEqual(MAX_HOPS, 5);
  });

  runTest('Timeouts are 8s per-hop and 9s overall', () => {
    assert.strictEqual(PER_HOP_TIMEOUT_MS, 8000);
    assert.strictEqual(OVERALL_DEADLINE_MS, 9000);
  });

  // ----------------------------------------------------
  // TEST GROUP 2: Meta Refresh Parser
  // ----------------------------------------------------
  console.log('\n--- Group 2: Meta Refresh Tag Parsing ---');
  runTest('Parses content="0; url=\'https://dest.com/job\'" (single quotes)', () => {
    const html = `<html><head><meta http-equiv="refresh" content="0; url='https://dest.com/job'"></head></html>`;
    const res = extractMetaRefreshUrl(html);
    assert.strictEqual(res, 'https://dest.com/job');
  });

  runTest('Parses content="0; url=\\"https://dest.com/job\\"" (double quotes)', () => {
    const html = `<html><head><meta http-equiv="refresh" content='0; url="https://dest.com/job"'></head></html>`;
    const res = extractMetaRefreshUrl(html);
    assert.strictEqual(res, 'https://dest.com/job');
  });

  runTest('Parses content="0; url=https://dest.com/job" (unquoted URL)', () => {
    const html = `<html><head><meta http-equiv="refresh" content="0; url=https://dest.com/job"></head></html>`;
    const res = extractMetaRefreshUrl(html);
    assert.strictEqual(res, 'https://dest.com/job');
  });

  runTest('Parses uppercase URL= and arbitrary whitespace', () => {
    const html = `<html><head><META HTTP-EQUIV="REFRESH" CONTENT="2; URL='https://company.org/careers'"></head></html>`;
    const res = extractMetaRefreshUrl(html);
    assert.strictEqual(res, 'https://company.org/careers');
  });

  runTest('Returns null when no refresh tag is present', () => {
    const html = `<html><head><title>Standard Page</title></head><body><h1>Hello</h1></body></html>`;
    const res = extractMetaRefreshUrl(html);
    assert.strictEqual(res, null);
  });

  // ----------------------------------------------------
  // TEST GROUP 3: Private IP, Numeric & Encoded IP Checking
  // ----------------------------------------------------
  console.log('\n--- Group 3: IP Encodings & Private Range Blocking ---');
  runTest('Blocks integer IP literal http://2130706433 (127.0.0.1)', () => {
    const check = parseAndCheckNumericIp('2130706433');
    assert.strictEqual(check.isIp, true);
    assert.strictEqual(check.private, true);
    assert.strictEqual(check.ip, '127.0.0.1');
  });

  runTest('Blocks hex IP literal http://0x7f000001 (127.0.0.1)', () => {
    const check = parseAndCheckNumericIp('0x7f000001');
    assert.strictEqual(check.isIp, true);
    assert.strictEqual(check.private, true);
    assert.strictEqual(check.ip, '127.0.0.1');
  });

  runTest('Blocks AWS/cloud metadata IP 169.254.169.254', () => {
    assert.strictEqual(isPrivateIPv4('169.254.169.254'), true);
  });

  runTest('Blocks IPv6 loopback [::1]', () => {
    assert.strictEqual(isPrivateIPv6('::1'), true);
    assert.strictEqual(isPrivateIPv6('[::1]'), true);
  });

  runTest('Blocks IPv6 link-local and unique-local ranges (fc00::, fe80::)', () => {
    assert.strictEqual(isPrivateIPv6('fc00::1'), true);
    assert.strictEqual(isPrivateIPv6('fd12:3456::1'), true);
    assert.strictEqual(isPrivateIPv6('fe80::1'), true);
  });

  runTest('Blocks IPv4-mapped IPv6 (::ffff:127.0.0.1, ::ffff:10.0.0.1)', () => {
    assert.strictEqual(isPrivateIPv6('::ffff:127.0.0.1'), true);
    assert.strictEqual(isPrivateIPv6('::ffff:192.168.1.1'), true);
    assert.strictEqual(isPrivateIPv6('::ffff:10.0.0.1'), true);
  });

  runTest('Allows valid public IPv4 and IPv6 addresses', () => {
    assert.strictEqual(isPrivateIPv4('8.8.8.8'), false);
    assert.strictEqual(isPrivateIPv4('93.184.216.34'), false);
    assert.strictEqual(isPrivateIPv6('2606:2800:220:1:248:1893:25c8:1946'), false);
  });

  // ----------------------------------------------------
  // TEST GROUP 4: Strict URL Validation
  // ----------------------------------------------------
  console.log('\n--- Group 4: Strict URL Validation ---');
  await runAsyncTest('Rejects non-http/https protocols (e.g. ftp:, javascript:, file:)', async () => {
    const r1 = await validateUrlStrict('ftp://example.com/job');
    assert.strictEqual(r1.ok, false);
    assert.strictEqual(r1.code, 'invalid_url');

    const r2 = await validateUrlStrict('javascript:alert(1)');
    assert.strictEqual(r2.ok, false);
    assert.strictEqual(r2.code, 'invalid_url');

    const r3 = await validateUrlStrict('file:///etc/passwd');
    assert.strictEqual(r3.ok, false);
    assert.strictEqual(r3.code, 'invalid_url');
  });

  await runAsyncTest('Rejects URLs exceeding 2048 characters', async () => {
    const longUrl = 'https://example.com/' + 'a'.repeat(2040);
    const res = await validateUrlStrict(longUrl);
    assert.strictEqual(res.ok, false);
    assert.strictEqual(res.code, 'invalid_url');
  });

  await runAsyncTest('Rejects URLs with embedded credentials (user:pass)', async () => {
    const res = await validateUrlStrict('https://admin:secret123@example.com/careers');
    assert.strictEqual(res.ok, false);
    assert.strictEqual(res.code, 'invalid_url');
  });

  await runAsyncTest('Allows only ports 80 and 443; blocks other ports (e.g. 8080, 22)', async () => {
    const rBlocked = await validateUrlStrict('http://example.com:8080/careers');
    assert.strictEqual(rBlocked.ok, false);
    assert.strictEqual(rBlocked.code, 'blocked_destination');

    const rSsh = await validateUrlStrict('http://example.com:22/careers');
    assert.strictEqual(rSsh.ok, false);
    assert.strictEqual(rSsh.code, 'blocked_destination');

    const rValidHttp = await validateUrlStrict('http://example.com:80/careers', {
      mockDns: { 'example.com': '93.184.216.34' }
    });
    assert.strictEqual(rValidHttp.ok, true);

    const rValidHttps = await validateUrlStrict('https://example.com:443/careers', {
      mockDns: { 'example.com': '93.184.216.34' }
    });
    assert.strictEqual(rValidHttps.ok, true);
  });

  await runAsyncTest('Blocks encoded IP URLs: 2130706433, 0x7f000001, 169.254.169.254, [::1]', async () => {
    const urls = [
      'http://2130706433/job',
      'http://0x7f000001/job',
      'http://169.254.169.254/latest/meta-data',
      'http://[::1]/job'
    ];
    for (const u of urls) {
      const res = await validateUrlStrict(u);
      assert.strictEqual(res.ok, false, `Expected ${u} to be blocked`);
      assert.strictEqual(res.code, 'blocked_destination');
    }
  });

  await runAsyncTest('Blocks domain whose DNS resolves to a private IP', async () => {
    const res = await validateUrlStrict('https://evil-internal.example.org/job', {
      mockDns: { 'evil-internal.example.org': '10.0.0.12' }
    });
    assert.strictEqual(res.ok, false);
    assert.strictEqual(res.code, 'blocked_destination');
  });

  // ----------------------------------------------------
  // TEST GROUP 5: Redirect Chain Inspection (Mock Transport)
  // ----------------------------------------------------
  console.log('\n--- Group 5: Redirect Chain Tracing Scenarios ---');

  await runAsyncTest('Scenario 1: Direct link (0 redirects, 1 hop 200 OK)', async () => {
    const mockTransport = {
      'https://company.com/careers/intern': async () => ({
        statusCode: 200,
        headers: {},
        bodyChunk: '<html><body>Welcome to Company Careers</body></html>'
      })
    };
    const mockDns = { 'company.com': '93.184.216.34' };

    const result = await inspectRedirectChain('https://company.com/careers/intern', { mockTransport, mockDns });
    assert.strictEqual(result.ok, true);
    assert.strictEqual(result.hops, 0);
    assert.strictEqual(result.chain.length, 1);
    assert.strictEqual(result.finalDomain, 'company.com');
    assert.strictEqual(result.finalUrl, 'https://company.com/careers/intern');
    assert.strictEqual(result.chain[0].status, 200);
  });

  await runAsyncTest('Scenario 2: Normal 3-hop chain (301 -> 302 -> 200)', async () => {
    const mockTransport = {
      'https://short.io/xyz': async () => ({
        statusCode: 301,
        headers: { location: 'https://aggregator.net/redir?id=123' },
        bodyChunk: ''
      }),
      'https://aggregator.net/redir?id=123': async () => ({
        statusCode: 302,
        headers: { location: 'https://careers.targetcompany.com/job/456' },
        bodyChunk: ''
      }),
      'https://careers.targetcompany.com/job/456': async () => ({
        statusCode: 200,
        headers: {},
        bodyChunk: '<html><body>Software Intern Job Description</body></html>'
      })
    };
    const mockDns = {
      'short.io': '93.184.216.34',
      'aggregator.net': '93.184.216.35',
      'careers.targetcompany.com': '93.184.216.36'
    };

    const result = await inspectRedirectChain('https://short.io/xyz', { mockTransport, mockDns });
    assert.strictEqual(result.ok, true);
    assert.strictEqual(result.hops, 2);
    assert.strictEqual(result.chain.length, 3);
    assert.strictEqual(result.chain[0].domain, 'short.io');
    assert.strictEqual(result.chain[0].status, 301);
    assert.strictEqual(result.chain[1].domain, 'aggregator.net');
    assert.strictEqual(result.chain[1].status, 302);
    assert.strictEqual(result.chain[2].domain, 'careers.targetcompany.com');
    assert.strictEqual(result.chain[2].status, 200);
    assert.strictEqual(result.finalDomain, 'careers.targetcompany.com');
    assert.strictEqual(result.finalUrl, 'https://careers.targetcompany.com/job/456');
  });

  await runAsyncTest('Scenario 3: Meta refresh redirect detection', async () => {
    const mockTransport = {
      'https://portal.com/splash': async () => ({
        statusCode: 200,
        headers: {},
        bodyChunk: `<html><head><meta http-equiv="refresh" content="0; url='https://portal.com/real-job'"></head></html>`
      }),
      'https://portal.com/real-job': async () => ({
        statusCode: 200,
        headers: {},
        bodyChunk: '<html><body>Final landing page</body></html>'
      })
    };
    const mockDns = { 'portal.com': '93.184.216.34' };

    const result = await inspectRedirectChain('https://portal.com/splash', { mockTransport, mockDns });
    assert.strictEqual(result.ok, true);
    assert.strictEqual(result.hops, 1);
    assert.strictEqual(result.chain.length, 2);
    assert.strictEqual(result.finalUrl, 'https://portal.com/real-job');
  });

  await runAsyncTest('Scenario 4: Redirect loop detection (A -> B -> A)', async () => {
    const mockTransport = {
      'https://loop.com/a': async () => ({
        statusCode: 302,
        headers: { location: 'https://loop.com/b' },
        bodyChunk: ''
      }),
      'https://loop.com/b': async () => ({
        statusCode: 302,
        headers: { location: 'https://loop.com/a' },
        bodyChunk: ''
      })
    };
    const mockDns = { 'loop.com': '93.184.216.34' };

    const result = await inspectRedirectChain('https://loop.com/a', { mockTransport, mockDns });
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.code, 'redirect_loop');
    assert(result.message.includes('Redirect loop detected'));
  });

  await runAsyncTest('Scenario 5: More than 5 hops triggers too_many_redirects', async () => {
    const mockTransport = {};
    const mockDns = {};
    for (let i = 0; i <= 6; i++) {
      mockDns[`hop${i}.com`] = '93.184.216.34';
      if (i < 6) {
        mockTransport[`https://hop${i}.com/go`] = async () => ({
          statusCode: 302,
          headers: { location: `https://hop${i + 1}.com/go` },
          bodyChunk: ''
        });
      } else {
        mockTransport[`https://hop${i}.com/go`] = async () => ({
          statusCode: 200,
          headers: {},
          bodyChunk: 'OK'
        });
      }
    }

    const result = await inspectRedirectChain('https://hop0.com/go', { mockTransport, mockDns });
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.code, 'too_many_redirects');
    assert(result.message.includes('Exceeded maximum redirect limit'));
  });

  await runAsyncTest('Scenario 6: Redirect to private IP is blocked (SSRF at hop 2)', async () => {
    const mockTransport = {
      'https://harmless-looking.org/link': async () => ({
        statusCode: 302,
        headers: { location: 'http://169.254.169.254/latest/meta-data' },
        bodyChunk: ''
      })
    };
    const mockDns = { 'harmless-looking.org': '93.184.216.34' };

    const result = await inspectRedirectChain('https://harmless-looking.org/link', { mockTransport, mockDns });
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.code, 'blocked_destination');
    assert(result.message.includes('blocked'));
  });

  await runAsyncTest('Scenario 7: Redirect to integer encoded IP is blocked', async () => {
    const mockTransport = {
      'https://relay.net/go': async () => ({
        statusCode: 302,
        headers: { location: 'http://2130706433/admin' },
        bodyChunk: ''
      })
    };
    const mockDns = { 'relay.net': '93.184.216.34' };

    const result = await inspectRedirectChain('https://relay.net/go', { mockTransport, mockDns });
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.code, 'blocked_destination');
  });

  await runAsyncTest('Scenario 8: Redirect to DNS private IP is blocked', async () => {
    const mockTransport = {
      'https://initial.org/go': async () => ({
        statusCode: 302,
        headers: { location: 'https://internal-dns.corp/data' },
        bodyChunk: ''
      })
    };
    const mockDns = {
      'initial.org': '93.184.216.34',
      'internal-dns.corp': '192.168.1.50'
    };

    const result = await inspectRedirectChain('https://initial.org/go', { mockTransport, mockDns });
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.code, 'blocked_destination');
  });

  await runAsyncTest('Scenario 9: Timeout during hop request triggers code: timeout', async () => {
    const mockTransport = {
      'https://slow-site.com/hang': async () => {
        const err = new Error('Connection timed out');
        err.code = 'ETIMEDOUT';
        throw err;
      }
    };
    const mockDns = { 'slow-site.com': '93.184.216.34' };

    const result = await inspectRedirectChain('https://slow-site.com/hang', { mockTransport, mockDns });
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.code, 'timeout');
  });

  // ----------------------------------------------------
  // TEST GROUP 6: HTTPS SNI Preservation & Route Integration
  // ----------------------------------------------------
  console.log('\n--- Group 6: Architecture, SNI & Server Integration ---');

  runTest('HTTPS SNI preservation logic structure in executeSingleHop', () => {
    // Read the module source code to ensure servername: parsedUrl.hostname is explicitly configured
    const fs = require('fs');
    const source = fs.readFileSync(__dirname + '/redirect-inspector.js', 'utf8');
    assert(source.includes('servername: parsedUrl.hostname'), 'Missing SNI servername configuration');
    assert(source.includes('lookup:'), 'Missing custom lookup for anti-DNS rebinding');
  });

  runTest('Express app in server.js registers POST /api/redirect-check', () => {
    const app = require('./server');
    const routes = [];
    app._router.stack.forEach((middleware) => {
      if (middleware.route) {
        routes.push({
          path: middleware.route.path,
          methods: Object.keys(middleware.route.methods)
        });
      }
    });

    const hasRedirectCheckRoute = routes.some(
      r => r.path === '/api/redirect-check' && r.methods.includes('post')
    );
    assert.strictEqual(hasRedirectCheckRoute, true, 'server.js must expose POST /api/redirect-check');
  });

  runTest('Vercel entrypoint api/index.js imports the same Express app', () => {
    const serverApp = require('./server');
    const vercelApp = require('./api/index');
    assert.strictEqual(serverApp, vercelApp, 'api/index.js must export the exact same app from server.js');
  });

  // ----------------------------------------------------
  // TEST GROUP 7: Express Route & Rate Limiting Middleware
  // ----------------------------------------------------
  console.log('\n--- Group 7: Express Route & Rate Limiting Middleware ---');
  await runAsyncTest('POST /api/redirect-check route handler and rate limiting', async () => {
    const app = require('./server');

    // Helper to find the registered route layer
    const routeLayer = app._router.stack.find(s => s.route && s.route.path === '/api/redirect-check');
    assert(routeLayer, 'Route /api/redirect-check must exist in Express router stack');

    // The route stack has [redirectRateLimitMiddleware, routeHandler]
    const [rateLimiter, handler] = routeLayer.route.stack.map(s => s.handle);
    assert(rateLimiter, 'Missing rate limiting middleware on /api/redirect-check');
    assert(handler, 'Missing handler function on /api/redirect-check');

    function createMockRes() {
      return {
        statusCode: 200,
        headers: {},
        jsonData: null,
        status(code) {
          this.statusCode = code;
          return this;
        },
        json(data) {
          this.jsonData = data;
          return this;
        }
      };
    }

    // Test 1: Direct call to handler with private IP 127.0.0.1
    const req1 = { ip: '100.1.2.3', body: { url: 'http://127.0.0.1' }, headers: {} };
    const res1 = createMockRes();
    await handler(req1, res1);
    assert.strictEqual(res1.jsonData.ok, false);
    assert.strictEqual(res1.jsonData.code, 'blocked_destination');

    // Test 2: Direct call to handler with integer encoded IP 2130706433
    const req2 = { ip: '100.1.2.3', body: { url: 'http://2130706433' }, headers: {} };
    const res2 = createMockRes();
    await handler(req2, res2);
    assert.strictEqual(res2.jsonData.ok, false);
    assert.strictEqual(res2.jsonData.code, 'blocked_destination');

    // Test 3: Direct call to handler with credentials
    const req3 = { ip: '100.1.2.3', body: { url: 'http://user:pass@example.com' }, headers: {} };
    const res3 = createMockRes();
    await handler(req3, res3);
    assert.strictEqual(res3.jsonData.ok, false);
    assert.strictEqual(res3.jsonData.code, 'invalid_url');

    // Test 4: Rate Limiting middleware (10 requests per minute per IP)
    const testIp = '198.51.100.77';
    let nextCalledCount = 0;
    const mockNext = () => { nextCalledCount++; };

    // Send 10 allowed requests
    for (let i = 0; i < 10; i++) {
      const rlReq = { ip: testIp, headers: {}, socket: { remoteAddress: testIp } };
      const rlRes = createMockRes();
      rateLimiter(rlReq, rlRes, mockNext);
    }
    assert.strictEqual(nextCalledCount, 10, 'First 10 requests should be allowed through');

    // 11th request must be rejected with 429
    const rlReq11 = { ip: testIp, headers: {}, socket: { remoteAddress: testIp } };
    const rlRes11 = createMockRes();
    let next11Called = false;
    rateLimiter(rlReq11, rlRes11, () => { next11Called = true; });

    assert.strictEqual(next11Called, false, '11th request must not call next()');
    assert.strictEqual(rlRes11.statusCode, 429, '11th request should return HTTP 429');
    assert.strictEqual(rlRes11.jsonData.ok, false);
    assert.strictEqual(rlRes11.jsonData.code, 'rate_limited');
    assert(rlRes11.jsonData.message.includes('10 requests per minute'));
  });

  console.log('\n====================================================');
  console.log(`📊 Test Summary: ${passedTests} / ${totalTests} tests passed`);
  console.log('====================================================');

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
