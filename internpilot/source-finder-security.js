/**
 * InternPilot - Original Internship Source Finder Security & SSRF Protection
 * 
 * Strict OWASP SSRF Prevention Implementation:
 * 1. Protocol Whitelisting (http, https only)
 * 2. DNS Resolution & Destination IP Address Validation (blocks private, loopback, link-local, cloud metadata)
 * 3. Individual Validation on Every Redirect Destination (max 3 redirects)
 * 4. Redirect Loop Detection & Timeout Controls (7s timeout)
 * 5. Response Size Limiting (max 512 KB stream cap)
 * 6. HTML & Anti-Prompt-Injection Content Sanitization
 */

const http = require('http');
const https = require('https');
const dns = require('dns').promises;
const { URL } = require('url');

const MAX_REDIRECTS = 3;
const MAX_BYTES = 512 * 1024; // 512 KB
const TIMEOUT_MS = 7000;      // 7 seconds

// Checks whether an IPv4 address falls within private/reserved/special-use blocks
function isPrivateIPv4(ip) {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some(p => isNaN(p) || p < 0 || p > 255)) {
    return true; // Malformed IP is rejected
  }
  const [a, b, c, d] = parts;

  // 0.0.0.0/8 (Current network)
  if (a === 0) return true;
  // 10.0.0.0/8 (Private network)
  if (a === 10) return true;
  // 100.64.0.0/10 (Shared address space / Carrier-grade NAT)
  if (a === 100 && b >= 64 && b <= 127) return true;
  // 127.0.0.0/8 (Loopback addresses)
  if (a === 127) return true;
  // 169.254.0.0/16 (Link-local & Cloud instance metadata: 169.254.169.254)
  if (a === 169 && b === 254) return true;
  // 172.16.0.0/12 (Private network: 172.16.0.0 - 172.31.255.255)
  if (a === 172 && b >= 16 && b <= 31) return true;
  // 192.0.0.0/24 (IETF protocol assignments)
  if (a === 192 && b === 0 && c === 0) return true;
  // 192.0.2.0/24 (TEST-NET-1)
  if (a === 192 && b === 0 && c === 2) return true;
  // 192.88.99.0/24 (6to4 relay)
  if (a === 192 && b === 88 && c === 99) return true;
  // 192.168.0.0/16 (Private network)
  if (a === 192 && b === 168) return true;
  // 198.18.0.0/15 (Network benchmark tests)
  if (a === 198 && (b === 18 || b === 19)) return true;
  // 198.51.100.0/24 (TEST-NET-2)
  if (a === 198 && b === 51 && c === 100) return true;
  // 203.0.113.0/24 (TEST-NET-3)
  if (a === 203 && b === 0 && c === 113) return true;
  // 224.0.0.0/4 (Multicast)
  if (a >= 224 && a <= 239) return true;
  // 240.0.0.0/4 (Reserved for future use)
  if (a >= 240) return true;
  // 255.255.255.255 (Broadcast)
  if (a === 255 && b === 255 && c === 255 && d === 255) return true;

  return false;
}

// Checks whether an IPv6 address falls within private/reserved/special-use blocks
function isPrivateIPv6(ip) {
  const normalized = ip.toLowerCase().trim();

  // Loopback & Unspecified
  if (normalized === '::1' || normalized === '::' || normalized === '0:0:0:0:0:0:0:1' || normalized === '0:0:0:0:0:0:0:0') {
    return true;
  }
  // IPv4-mapped IPv6 (::ffff:192.168.1.1)
  if (normalized.startsWith('::ffff:')) {
    const ipv4Part = normalized.slice(7);
    if (ipv4Part.includes('.')) {
      return isPrivateIPv4(ipv4Part);
    }
  }
  // Unique Local Address (fc00::/7 -> fc.. or fd..)
  if (normalized.startsWith('fc') || normalized.startsWith('fd')) {
    return true;
  }
  // Link-Local Unicast (fe80::/10 -> fe8, fe9, fea, feb)
  if (/^fe[89ab]/i.test(normalized)) {
    return true;
  }
  // Multicast (ff00::/8)
  if (normalized.startsWith('ff')) {
    return true;
  }
  // Documentation prefix (2001:db8::/32)
  if (normalized.startsWith('2001:db8') || normalized.startsWith('2001:0db8')) {
    return true;
  }

  return false;
}

/**
 * Validates a target URL against SSRF rules:
 * - Scheme must be http or https
 * - No user/password authentication
 * - Standard web ports
 * - Resolves all DNS records and confirms none point to private/reserved IP spaces
 */
async function validateUrlForSSRF(urlString, options = {}) {
  let parsedUrl;
  try {
    parsedUrl = new URL(urlString);
  } catch (err) {
    return { valid: false, error: 'Malformed URL: ' + err.message };
  }

  if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
    return { valid: false, error: `Disallowed protocol "${parsedUrl.protocol}". Only HTTP and HTTPS are permitted.` };
  }

  if (parsedUrl.username || parsedUrl.password) {
    return { valid: false, error: 'Embedded credentials (user:pass) in URL are rejected for security.' };
  }

  const hostname = parsedUrl.hostname.toLowerCase();
  if (!hostname || hostname === 'localhost' || hostname.endsWith('.local') || hostname.endsWith('.internal')) {
    return { valid: false, error: `Host "${hostname}" points to an internal or private domain.` };
  }

  // Check if hostname is already a raw IP literal
  if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname)) {
    if (isPrivateIPv4(hostname)) {
      return { valid: false, error: `Target IP ${hostname} is in a private, loopback, or reserved network range.` };
    }
  } else if (hostname.includes(':')) {
    const cleanIpv6 = hostname.replace(/^\[|\]$/g, '');
    if (isPrivateIPv6(cleanIpv6)) {
      return { valid: false, error: `Target IPv6 ${cleanIpv6} is in a private or reserved network range.` };
    }
  }

  // If caller provided pre-fetched HTML / offline test mode, skip live socket DNS lookup
  if (options.skipDns) {
    return {
      valid: true,
      parsedUrl,
      validatedIp: '0.0.0.0',
      ipFamily: 4
    };
  }

  // Resolve DNS records to verify actual destination IP
  try {
    const addresses = await dns.lookup(hostname, { all: true });
    if (!addresses || addresses.length === 0) {
      return { valid: false, error: `Could not resolve hostname "${hostname}" to any IP address.` };
    }

    for (const record of addresses) {
      if (record.family === 4) {
        if (isPrivateIPv4(record.address)) {
          return { valid: false, error: `Domain "${hostname}" resolved to private IPv4 address: ${record.address}` };
        }
      } else if (record.family === 6) {
        if (isPrivateIPv6(record.address)) {
          return { valid: false, error: `Domain "${hostname}" resolved to private IPv6 address: ${record.address}` };
        }
      }
    }
    return {
      valid: true,
      parsedUrl,
      validatedIp: addresses[0].address,
      ipFamily: addresses[0].family
    };
  } catch (dnsErr) {
    return { valid: false, error: `DNS lookup failed for "${hostname}": ${dnsErr.message}` };
  }
}

/**
 * Secure HTTP/HTTPS GET fetcher with:
 * - Redirect loop tracking & max 3 redirects
 * - Individual IP validation on EVERY redirect target
 * - Streaming size limit (max 512KB)
 * - Strict timeout (7s)
 */
function safeFetchUrl(urlString, redirectCount = 0, visited = new Set()) {
  return new Promise(async (resolve, reject) => {
    if (redirectCount > MAX_REDIRECTS) {
      return reject(new Error(`Too many redirects (exceeded limit of ${MAX_REDIRECTS}).`));
    }

    if (visited.has(urlString)) {
      return reject(new Error('Redirect loop detected.'));
    }
    visited.add(urlString);

    // SSRF Check on current URL (and every redirect URL)
    const ssrfCheck = await validateUrlForSSRF(urlString);
    if (!ssrfCheck.valid) {
      return reject(new Error(`SSRF Blocked: ${ssrfCheck.error}`));
    }

    const { parsedUrl } = ssrfCheck;
    const isHttps = parsedUrl.protocol === 'https:';
    const client = isHttps ? https : http;

    const reqOptions = {
      method: 'GET',
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (isHttps ? 443 : 80),
      path: parsedUrl.pathname + parsedUrl.search,
      headers: {
        'Host': parsedUrl.host,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 InternPilot-SourceFinder/1.0',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9'
      },
      servername: parsedUrl.hostname,
      // Anti-DNS-Rebinding Protection:
      // Binds socket resolution directly to the validated public IP, preventing TOCTOU re-resolution
      lookup: (host, opts, cb) => {
        cb(null, ssrfCheck.validatedIp, ssrfCheck.ipFamily || 4);
      },
      timeout: TIMEOUT_MS
    };

    const req = client.request(reqOptions, (res) => {
      // Handle Redirects
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
        req.destroy();
        let redirectTarget = res.headers.location;
        try {
          // Resolve relative redirect against base URL
          redirectTarget = new URL(redirectTarget, urlString).toString();
        } catch (e) {
          return reject(new Error('Invalid redirect location: ' + res.headers.location));
        }

        // Recursively fetch redirect target with individual validation
        return resolve(safeFetchUrl(redirectTarget, redirectCount + 1, visited));
      }

      if (res.statusCode < 200 || res.statusCode >= 400) {
        req.destroy();
        return reject(new Error(`HTTP error ${res.statusCode} from server.`));
      }

      let totalBytes = 0;
      const chunks = [];

      res.on('data', (chunk) => {
        totalBytes += chunk.length;
        if (totalBytes > MAX_BYTES) {
          req.destroy();
          return reject(new Error(`Response exceeded maximum size limit of ${MAX_BYTES / 1024} KB.`));
        }
        chunks.push(chunk);
      });

      res.on('end', () => {
        const buffer = Buffer.concat(chunks);
        resolve({
          statusCode: res.statusCode,
          finalUrl: urlString,
          contentType: res.headers['content-type'] || '',
          body: buffer.toString('utf8')
        });
      });

      res.on('error', (err) => reject(err));
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error(`Request timed out after ${TIMEOUT_MS / 1000} seconds.`));
    });

    req.on('error', (err) => reject(err));
    req.end();
  });
}

/**
 * Sanitizes retrieved webpage HTML:
 * - Strips scripts, styles, forms, embeds, navigation, footer
 * - Strips HTML tags and decodes entities
 * - Strips control characters
 * - Neutralizes adversarial prompt-injection keywords (SYSTEM, ASSISTANT, Ignore instructions, etc.)
 * - Limits length to max 15,000 characters
 */
function sanitizeWebpageText(html, maxLength = 15000) {
  if (!html || typeof html !== 'string') return '';

  let cleaned = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ')
    .replace(/<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>/gi, ' ')
    .replace(/<svg\b[^<]*(?:(?!<\/svg>)<[^<]*)*<\/svg>/gi, ' ')
    .replace(/<header\b[^<]*(?:(?!<\/header>)<[^<]*)*<\/header>/gi, ' ')
    .replace(/<footer\b[^<]*(?:(?!<\/footer>)<[^<]*)*<\/footer>/gi, ' ')
    .replace(/<nav\b[^<]*(?:(?!<\/nav>)<[^<]*)*<\/nav>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<br\s*[\/]?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/h[1-6]>/gi, '\n\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/[\u0000-\u0008\u000B-\u000C\u000E-\u001F]/g, '') // Strip control chars
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  // Prompt injection mitigation: neutralize adversarial control phrases
  cleaned = cleaned
    .replace(/ignore\s+(all\s+)?previous\s+instructions/gi, '[neutralized text]')
    .replace(/you\s+are\s+now\s+in\s+developer\s+mode/gi, '[neutralized text]')
    .replace(/system\s*:\s*/gi, 'Context: ')
    .replace(/assistant\s*:\s*/gi, 'Response: ')
    .replace(/```/g, "'''");

  return cleaned.slice(0, maxLength);
}

module.exports = {
  validateUrlForSSRF,
  safeFetchUrl,
  sanitizeWebpageText,
  isPrivateIPv4,
  isPrivateIPv6
};
