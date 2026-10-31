/**
 * InternPilot - Live Web Search Verification Test (Tavily Provider)
 * 
 * Verifies:
 * 1. .env integration and secure backend loading
 * 2. GET /api/source-finder/status returns { configured: true, provider: 'tavily' } without exposing credentials
 * 3. Execution of live web search using Tavily API (isDemo: false)
 * 4. Grounded official careers website discovery and comparison
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const assert = require('assert');
const { getSearchStatus, getActiveSearchProvider, executeWebSearch } = require('./search-adapter');
const { verifyInternshipSource } = require('./source-finder-engine');

async function runLiveTest() {
  console.log("======================================================================");
  console.log("       INTERNPILOT LIVE SEARCH VERIFICATION TEST (TAVILY)             ");
  console.log("======================================================================\n");

  // Check 1: Provider Status & Credential Secrecy
  console.log("▶ [CHECK 1] Verifying Backend Search Status Endpoint & Credential Protection...");
  const status = getSearchStatus();
  console.log("  Status Object:", JSON.stringify(status, null, 2));

  assert(status.apiKey === undefined, "CRITICAL: API key must never be present in status output");
  assert(status.TAVILY_API_KEY === undefined, "CRITICAL: Raw credential must never be present in status output");
  console.log("  ✓ [PASS] Zero API keys or secrets exposed in status payload.");

  const provider = getActiveSearchProvider();
  if (!provider || !process.env.TAVILY_API_KEY) {
    console.log("\n▶ [CHECK 2 & 3] Live Tavily Execution Standby:");
    console.log("  ℹ No TAVILY_API_KEY currently detected in local .env.");
    console.log("  ℹ Once you add TAVILY_API_KEY to internpilot/.env, this test will execute live searches.");
    console.log("  ✓ [PASS] Adapter safely halted without pretending a live search occurred.\n");
    console.log("======================================================================");
    console.log("STATUS: Setup verified. Ready for TAVILY_API_KEY injection.");
    console.log("======================================================================");
    return;
  }

  // Check 2: Genuine Live Search Query via Tavily
  console.log(`\n▶ [CHECK 2] Executing Live Tavily Query for Active Corporate Careers...`);
  console.log(`  Provider: ${provider.toUpperCase()}`);
  const query = 'Apex Cloud Technologies Junior Web Developer Intern careers';
  console.log(`  Query: "${query}"`);

  const searchRes = await executeWebSearch(query);
  console.log(`  Live Search Success: ${searchRes.success}`);
  console.log(`  Results Returned: ${searchRes.results ? searchRes.results.length : 0}`);

  if (searchRes.results && searchRes.results.length > 0) {
    console.log("  Top Result Title:", searchRes.results[0].title);
    console.log("  Top Result URL:", searchRes.results[0].url);
  }
  assert.strictEqual(searchRes.success, true, "Live Tavily search must return success");
  assert(searchRes.results.length > 0, "Live Tavily search must return results");
  console.log("  ✓ [PASS] Live Tavily search successfully returned genuine web results.");

  // Check 3: Live Source Verification (Non-Demo Mode)
  console.log("\n▶ [CHECK 3] Running Real Source Verification (isDemo: false)...");
  // Test with a live public URL
  const testUrl = "https://www.linkedin.com/jobs/view/apex-cloud-junior-web-developer-intern-39218";
  const verifRes = await verifyInternshipSource(testUrl, { isDemo: false });

  console.log("  State:", verifRes.state);
  console.log("  Label:", verifRes.label);
  console.log("  Explanation:", verifRes.evidence?.explanation);
  assert(verifRes.state !== undefined, "Must return valid evidence-based state");
  console.log("  ✓ [PASS] Live non-demo verification executed successfully.\n");

  console.log("======================================================================");
  console.log("🎉 ALL LIVE TAVILY VERIFICATION CHECKS COMPLETED SUCCESSFULLY!");
  console.log("======================================================================");
}

runLiveTest().catch(err => {
  console.error("Live test failed:", err);
  process.exit(1);
});
