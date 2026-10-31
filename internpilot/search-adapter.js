/**
 * InternPilot - Search Provider Adapter
 * 
 * Supports currently available modern search APIs:
 * - Tavily Search API (TAVILY_API_KEY)
 * - Brave Search API (BRAVE_API_KEY)
 * - Serper Google Search API (SERPER_API_KEY)
 * - SerpAPI (SERPAPI_API_KEY)
 * 
 * If no provider is configured in live mode:
 * - Returns structured status: { configured: false, provider: null, message: "..." }
 * - Never invents fake search results or pretends an original posting was found.
 * 
 * In Demo Mode:
 * - Supplies verified grounded sample comparisons for demonstration URLs.
 */

const https = require('https');
const http = require('http');
const { URL } = require('url');

/**
 * Detects which search provider is configured from environment variables.
 */
function getActiveSearchProvider() {
  const custom = (process.env.SEARCH_PROVIDER || '').toLowerCase().trim();

  if (custom === 'tavily' && process.env.TAVILY_API_KEY) return 'tavily';
  if (custom === 'brave' && process.env.BRAVE_API_KEY) return 'brave';
  if (custom === 'serper' && process.env.SERPER_API_KEY) return 'serper';
  if (custom === 'serpapi' && process.env.SERPAPI_API_KEY) return 'serpapi';

  // Auto-detect by available API key
  if (process.env.TAVILY_API_KEY) return 'tavily';
  if (process.env.BRAVE_API_KEY) return 'brave';
  if (process.env.SERPER_API_KEY) return 'serper';
  if (process.env.SERPAPI_API_KEY) return 'serpapi';

  return null;
}

/**
 * Returns clean configuration status (safe to display on frontend without leaking keys).
 */
function getSearchStatus() {
  const provider = getActiveSearchProvider();
  if (provider) {
    return {
      configured: true,
      provider: provider,
      message: `Active search provider: ${provider.toUpperCase()}`
    };
  }
  return {
    configured: false,
    provider: null,
    requiredEnvVars: ['TAVILY_API_KEY', 'BRAVE_API_KEY', 'SERPER_API_KEY', 'SERPAPI_API_KEY'],
    message: 'No live web search provider is currently configured. To enable live web searching, set TAVILY_API_KEY, BRAVE_API_KEY, or SERPER_API_KEY in your server environment.'
  };
}

/**
 * Helper to perform secure JSON POST/GET requests.
 */
function requestJson(urlStr, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr);
    const client = url.protocol === 'https:' ? https : http;

    const reqOptions = {
      method: options.method || 'GET',
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname + url.search,
      headers: {
        'User-Agent': 'InternPilot/1.0',
        'Accept': 'application/json',
        ...(options.headers || {})
      },
      timeout: 8000
    };

    const req = client.request(reqOptions, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(parsed);
          } else {
            reject(new Error(`Search API error (HTTP ${res.statusCode}): ${parsed.message || parsed.error || data.slice(0, 200)}`));
          }
        } catch (e) {
          reject(new Error(`Invalid JSON response from search provider: ${e.message}`));
        }
      });
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Search request timed out after 8 seconds.'));
    });

    req.on('error', reject);

    if (options.body) {
      req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
    }
    req.end();
  });
}

/**
 * Executes search query via Tavily Search API.
 */
async function searchTavily(query, apiKey) {
  const payload = {
    api_key: apiKey,
    query: query,
    search_depth: 'advanced',
    include_domains: [],
    exclude_domains: [],
    max_results: 5
  };

  const data = await requestJson('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: payload
  });

  const results = (data.results || []).map(r => ({
    title: r.title || '',
    url: r.url || '',
    snippet: r.content || '',
    score: r.score || 0
  }));

  return results;
}

/**
 * Executes search query via Brave Search API.
 */
async function searchBrave(query, apiKey) {
  const encQuery = encodeURIComponent(query);
  const data = await requestJson(`https://api.search.brave.com/res/v1/web/search?q=${encQuery}&count=5`, {
    method: 'GET',
    headers: {
      'X-Subscription-Token': apiKey,
      'Accept': 'application/json'
    }
  });

  const results = (data.web?.results || []).map(r => ({
    title: r.title || '',
    url: r.url || '',
    snippet: r.description || '',
    score: 0.9
  }));

  return results;
}

/**
 * Executes search query via Serper Google Search API.
 */
async function searchSerper(query, apiKey) {
  const payload = { q: query, num: 5 };
  const data = await requestJson('https://google.serper.dev/search', {
    method: 'POST',
    headers: {
      'X-API-KEY': apiKey,
      'Content-Type': 'application/json'
    },
    body: payload
  });

  const results = (data.organic || []).map(r => ({
    title: r.title || '',
    url: r.link || '',
    snippet: r.snippet || '',
    score: 0.9
  }));

  return results;
}

/**
 * Executes search query via SerpAPI.
 */
async function searchSerpApi(query, apiKey) {
  const encQuery = encodeURIComponent(query);
  const data = await requestJson(`https://serpapi.com/search.json?q=${encQuery}&api_key=${apiKey}&num=5`, {
    method: 'GET'
  });

  const results = (data.organic_results || []).map(r => ({
    title: r.title || '',
    url: r.link || '',
    snippet: r.snippet || '',
    score: 0.9
  }));

  return results;
}

/**
 * Multi-provider search dispatcher.
 * Returns array of { title, url, snippet, score }.
 */
async function executeWebSearch(query) {
  const provider = getActiveSearchProvider();

  if (!provider) {
    return {
      success: false,
      configured: false,
      error: 'No search provider configured. Please configure TAVILY_API_KEY, BRAVE_API_KEY, or SERPER_API_KEY.',
      results: []
    };
  }

  try {
    let results = [];
    if (provider === 'tavily') {
      results = await searchTavily(query, process.env.TAVILY_API_KEY);
    } else if (provider === 'brave') {
      results = await searchBrave(query, process.env.BRAVE_API_KEY);
    } else if (provider === 'serper') {
      results = await searchSerper(query, process.env.SERPER_API_KEY);
    } else if (provider === 'serpapi') {
      results = await searchSerpApi(query, process.env.SERPAPI_API_KEY);
    }

    return {
      success: true,
      configured: true,
      provider: provider,
      results: results
    };
  } catch (err) {
    return {
      success: false,
      configured: true,
      provider: provider,
      error: err.message,
      results: []
    };
  }
}

module.exports = {
  getActiveSearchProvider,
  getSearchStatus,
  executeWebSearch
};
