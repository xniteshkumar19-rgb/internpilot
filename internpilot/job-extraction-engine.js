/**
 * InternPilot - Job Page Detection & Evidence-Based Extraction Engine
 * 
 * Strict Accuracy & Non-Hallucination Guarantees:
 * 1. URL Classification: Distinguishes actual job URLs from platform homepages, login walls, and generic search pages.
 * 2. Page Type Detection: Identifies LOGIN_REQUIRED, GENERIC_LANDING_PAGE, JOB_EXPIRED, ACCESS_DENIED, and IRRELEVANT_PAGE.
 * 3. Evidence-Based Extraction: Extracts from Schema.org (JobPosting), OpenGraph metadata, and validated semantic text.
 * 4. Grounded Attributes: If stipend, location, duration, deadline, or jobRefId are absent, outputs "Not mentioned in job posting." NEVER invents details.
 * 5. Quality States:
 *    - JOB_POSTING_EXTRACTED
 *    - PARTIALLY_EXTRACTED
 *    - JOB_POSTING_INACCESSIBLE
 *    - INVALID_URL
 * 6. Manual Fallback: Facilitates student pasting actual job description when blocked by authentication.
 * 7. Targeted Queries: Generates Google & Bing queries using exact company and role keywords.
 */

const { URL } = require('url');
const { sanitizeWebpageText } = require('./source-finder-security');

const NOT_MENTIONED = 'Not mentioned in job posting.';

// Generic platform terms that must NEVER be accepted as real company names
const BLOCKED_COMPANY_NAMES = new Set([
  'linkedin',
  'linkedin corporation',
  'internshala',
  'indeed',
  'glassdoor',
  'naukri',
  'sign in',
  'log in',
  'join now',
  'orders',
  'terms',
  'privacy',
  'cookie policy',
  'user agreement',
  'organization',
  'company',
  'by clicking continue'
]);

// Generic role words that must NEVER be accepted as specific job titles
const BLOCKED_JOB_TITLES = new Set([
  'internship role',
  'job title',
  'role',
  'position',
  'sign in',
  'log in',
  'join linkedin',
  'by clicking continue',
  'by clicking continue to join or sign in',
  'orders',
  'terms of service',
  'cookie policy'
]);

// Known words that should not be matched as job reference IDs
const BLOCKED_REF_IDS = new Set([
  'orders',
  'order',
  'submit',
  'login',
  'signin',
  'search',
  'button',
  'input',
  'false',
  'true',
  'null',
  'undefined'
]);

/**
 * Checks if a URL specifically targets a LinkedIn job posting.
 */
function isLinkedInJobUrl(urlStr) {
  if (!urlStr || typeof urlStr !== 'string') return false;
  try {
    const parsed = new URL(urlStr);
    const host = parsed.hostname.toLowerCase();
    if (!host.includes('linkedin.com')) return false;

    // Direct job view pattern: /jobs/view/123456 or /jobs/view/title-slug-123456
    if (/\/jobs\/view\/[^\/\?\#]+/i.test(parsed.pathname)) return true;

    // Jobs collections / search pattern with specific currentJobId query param
    const currentJobId = parsed.searchParams.get('currentJobId');
    if (currentJobId && /^\d+$/.test(currentJobId)) return true;

    return false;
  } catch {
    return false;
  }
}

/**
 * Checks if a LinkedIn URL points to a generic landing, homepage, or login wall.
 */
function isLinkedInGenericUrl(urlStr) {
  if (!urlStr || typeof urlStr !== 'string') return false;
  try {
    const parsed = new URL(urlStr);
    const host = parsed.hostname.toLowerCase();
    if (!host.includes('linkedin.com')) return false;

    const path = parsed.pathname.replace(/\/+$/, '') || '/';

    // Homepage or feed
    if (path === '/' || path === '/feed') return true;

    // Auth / login / registration pages
    if (/^\/(login|uas\/login|authwall|checkpoint|signup|reg|start)\b/i.test(path)) return true;

    // Generic jobs listings without currentJobId
    if (path === '/jobs' || path === '/jobs/search' || path === '/jobs/collections') {
      const currentJobId = parsed.searchParams.get('currentJobId');
      if (!currentJobId) return true;
    }

    // Company or school profile landing page (not a specific job posting)
    if (/^\/(company|school|pulse)\b/i.test(path) && !path.includes('/jobs/')) return true;

    return false;
  } catch {
    return false;
  }
}

/**
 * Checks if any aggregator URL points to a generic homepage or landing page.
 */
function isGenericAggregatorLanding(urlStr) {
  if (!urlStr || typeof urlStr !== 'string') return false;
  try {
    const parsed = new URL(urlStr);
    const host = parsed.hostname.toLowerCase();
    const path = parsed.pathname.replace(/\/+$/, '') || '/';

    if (host.includes('linkedin.com')) return isLinkedInGenericUrl(urlStr);

    if (host.includes('internshala.com')) {
      return path === '/' || (!path.includes('/internship/detail') && !path.includes('/job/detail'));
    }

    if (host.includes('indeed.com')) {
      return path === '/' || (!path.includes('/viewjob') && !path.includes('/rc/clk'));
    }

    return false;
  } catch {
    return false;
  }
}

/**
 * Inspects webpage HTML, URL, and HTTP status to classify the page type.
 */
function detectJobPageType(html, url = '', statusCode = 200) {
  const urlStr = String(url || '');
  const htmlStr = String(html || '');
  const lowerHtml = htmlStr.toLowerCase();

  // 1. Status Code Checks
  if (statusCode === 404 || statusCode === 410) {
    return {
      type: 'JOB_EXPIRED',
      reason: 'HTTP 404/410 status returned. The posting URL has expired or was removed by the employer.',
      accessible: false,
      message: 'This job posting has expired or is no longer available.'
    };
  }

  if (statusCode === 403 || statusCode === 429) {
    return {
      type: 'ACCESS_DENIED',
      reason: `The host website restricted access (HTTP ${statusCode}).`,
      accessible: false,
      message: 'Access to this job posting was restricted by the host website.'
    };
  }

  // 2. Authentication Barrier / LinkedIn Authwall Check
  const isAuthUrl = isLinkedInGenericUrl(urlStr) && /login|authwall|checkpoint|uas\/login/i.test(urlStr);
  const titleMatch = htmlStr.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const pageTitle = titleMatch ? titleMatch[1].trim() : '';
  const isAuthTitle = /log in|sign in|join linkedin|sign in to linkedin|security verification|checkpoint/i.test(pageTitle);

  const hasAuthwallText =
    lowerHtml.includes('by clicking continue to join or sign in') ||
    lowerHtml.includes('by clicking continue, you agree to linkedin') ||
    lowerHtml.includes('sign in with google') ||
    lowerHtml.includes('new to linkedin? join now') ||
    lowerHtml.includes('sign in to see who you already know') ||
    lowerHtml.includes('authwall-join-form') ||
    lowerHtml.includes('join now to see all activity') ||
    /<form[^>]+(login|signin|authwall)/i.test(htmlStr);

  if (isAuthUrl || (isAuthTitle && hasAuthwallText) || (urlStr.includes('linkedin.com') && (hasAuthwallText || isAuthTitle))) {
    return {
      type: 'LOGIN_REQUIRED',
      reason: "We couldn't retrieve the complete job description from LinkedIn because authentication is required.",
      accessible: false,
      platform: 'LinkedIn',
      message: "We couldn't retrieve the complete job description from LinkedIn."
    };
  }

  // 3. Expired or Closed Job Check
  const hasExpiredText =
    lowerHtml.includes('this job is no longer available') ||
    lowerHtml.includes('this job is no longer accepting applications') ||
    lowerHtml.includes('this listing has expired') ||
    lowerHtml.includes('job has expired') ||
    lowerHtml.includes('this position has been closed') ||
    lowerHtml.includes('position closed') ||
    lowerHtml.includes('job is closed') ||
    lowerHtml.includes('no longer accepting applications') ||
    lowerHtml.includes('posting has been taken down');

  if (hasExpiredText && !lowerHtml.includes('apply now') && !lowerHtml.includes('submit application')) {
    return {
      type: 'JOB_EXPIRED',
      reason: 'This job posting has expired or is no longer accepting applications.',
      accessible: false,
      message: 'This job posting has expired or is no longer accepting applications.'
    };
  }

  // 4. Access Denied / Bot Challenge / Cloudflare Check
  const hasAccessDenied =
    lowerHtml.includes('attention required! | cloudflare') ||
    lowerHtml.includes('access denied') ||
    lowerHtml.includes('verify you are human') ||
    lowerHtml.includes('cloudflare ray id') ||
    lowerHtml.includes('security check to continue') ||
    lowerHtml.includes('please enable cookies') ||
    lowerHtml.includes('captcha');

  if (hasAccessDenied && !lowerHtml.includes('responsibilities') && !lowerHtml.includes('requirements')) {
    return {
      type: 'ACCESS_DENIED',
      reason: 'Access to this job posting was restricted by the host website security check.',
      accessible: false,
      message: 'Access to this job posting was restricted by the host website.'
    };
  }

  // 5. Generic Homepage / Landing Page Check
  if (isGenericAggregatorLanding(urlStr)) {
    return {
      type: 'GENERIC_LANDING_PAGE',
      reason: 'The submitted link redirected to the platform homepage rather than a specific job posting.',
      accessible: false,
      message: "The submitted link redirected to the homepage rather than an active job posting."
    };
  }

  // 6. Content Availability Check
  if (!htmlStr || htmlStr.trim().length < 50) {
    return {
      type: 'CONTENT_UNAVAILABLE',
      reason: 'Webpage content was empty or could not be loaded.',
      accessible: false,
      message: "Webpage content was empty or could not be loaded."
    };
  }

  // 7. Schema.org JobPosting or Rich Job Markers Check
  const hasSchemaJob = /"@type"\s*:\s*"JobPosting"/i.test(htmlStr);
  const hasJobKeywords =
    lowerHtml.includes('job description') ||
    lowerHtml.includes('responsibilities') ||
    lowerHtml.includes('requirements') ||
    lowerHtml.includes('qualifications') ||
    lowerHtml.includes('about the role') ||
    lowerHtml.includes('what you will do') ||
    lowerHtml.includes('role overview') ||
    (lowerHtml.includes('intern') && lowerHtml.includes('skills'));

  if (hasSchemaJob || hasJobKeywords) {
    return {
      type: 'VALID_JOB_PAGE',
      reason: 'Active job posting detected.',
      accessible: true,
      message: 'Job posting retrieved successfully.'
    };
  }

  return {
    type: 'IRRELEVANT_PAGE',
    reason: 'The webpage content does not appear to contain an internship or job posting.',
    accessible: false,
    message: 'The webpage content does not appear to contain an internship or job posting.'
  };
}

/**
 * Parses Schema.org JSON-LD from HTML.
 */
function extractJsonLdJobPosting(html) {
  if (!html || typeof html !== 'string') return null;
  const scriptRegex = /<script\s+[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = scriptRegex.exec(html)) !== null) {
    const raw = match[1].trim();
    try {
      const data = JSON.parse(raw);
      if (data && typeof data === 'object') {
        if (data['@type'] === 'JobPosting') return data;
        if (Array.isArray(data['@graph'])) {
          const found = data['@graph'].find(item => item && item['@type'] === 'JobPosting');
          if (found) return found;
        }
        if (Array.isArray(data)) {
          const found = data.find(item => item && item['@type'] === 'JobPosting');
          if (found) return found;
        }
      }
    } catch {}
  }
  return null;
}

/**
 * Extracts OpenGraph and Meta tags.
 */
function extractMetaTags(html) {
  const meta = { ogTitle: '', ogDescription: '', ogSiteName: '', metaDesc: '' };
  if (!html || typeof html !== 'string') return meta;

  const ogTitleMatch = html.match(/<meta\s+[^>]*property=["']og:title["'][^>]*content=["']([^"']*)["']/i) ||
                       html.match(/<meta\s+[^>]*content=["']([^"']*)["'][^>]*property=["']og:title["']/i);
  if (ogTitleMatch) meta.ogTitle = ogTitleMatch[1].trim();

  const ogDescMatch = html.match(/<meta\s+[^>]*property=["']og:description["'][^>]*content=["']([^"']*)["']/i) ||
                      html.match(/<meta\s+[^>]*content=["']([^"']*)["'][^>]*property=["']og:description["']/i);
  if (ogDescMatch) meta.ogDescription = ogDescMatch[1].trim();

  const descMatch = html.match(/<meta\s+[^>]*name=["']description["'][^>]*content=["']([^"']*)["']/i) ||
                    html.match(/<meta\s+[^>]*content=["']([^"']*)["'][^>]*name=["']description["']/i);
  if (descMatch) meta.metaDesc = descMatch[1].trim();

  return meta;
}

/**
 * Extracts technical and domain skills mentioned in text.
 */
function extractSkillsFromText(text) {
  if (!text || typeof text !== 'string') return { requiredSkills: [], preferredSkills: [] };
  const lower = text.toLowerCase();

  const techDictionary = [
    'javascript', 'typescript', 'react', 'python', 'node.js', 'html', 'css',
    'docker', 'aws', 'git', 'sql', 'postgresql', 'postgres', 'mongodb', 'graphql',
    'java', 'c++', 'c#', 'kubernetes', 'linux', 'ci/cd', 'rest api', 'next.js',
    'vue', 'angular', 'tailwind', 'express', 'flask', 'django', 'pandas', 'numpy',
    'scikit-learn', 'tensorflow', 'pytorch', 'figma', 'jest', 'cypress'
  ];

  const required = [];
  const preferred = [];

  // Check preferred skills section
  const prefSectionMatch = text.match(/(?:preferred|bonus|nice to have|good to have|desired)[\s\S]{0,500}/i);
  const prefText = prefSectionMatch ? prefSectionMatch[0].toLowerCase() : '';

  for (const skill of techDictionary) {
    const escaped = skill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const startBoundary = /^\w/.test(skill) ? '\\b' : '(?:^|\\s)';
    const endBoundary = /\w$/.test(skill) ? '\\b' : '(?=[^\\w]|$)';
    const regex = new RegExp(startBoundary + escaped + endBoundary, 'i');
    if (regex.test(lower)) {
      if (prefText && regex.test(prefText)) {
        if (!preferred.includes(skill)) preferred.push(skill);
      } else {
        if (!required.includes(skill)) required.push(skill);
      }
    }
  }

  return { requiredSkills: required, preferredSkills: preferred };
}

/**
 * Normalizes company names.
 */
function cleanCompanyName(name) {
  if (!name || typeof name !== 'string') return '';
  let cleaned = name.trim().replace(/^["']|["']$/g, '');
  cleaned = cleaned.replace(/\s+/g, ' ');

  const lower = cleaned.toLowerCase();
  // Reject login, authwall, navigation, cookie, or platform terms
  if (
    lower.includes('by clicking continue') ||
    lower.includes('sign in') ||
    lower.includes('log in') ||
    lower.includes('join now') ||
    lower.includes('join linkedin') ||
    lower.includes('cookie policy') ||
    lower.includes('user agreement') ||
    lower.includes('privacy policy') ||
    lower.includes('terms of service')
  ) {
    return '';
  }

  for (const blocked of BLOCKED_COMPANY_NAMES) {
    if (lower === blocked || lower.startsWith(blocked + ' ') || lower.startsWith(blocked + ' by') || lower.endsWith(' ' + blocked)) {
      return '';
    }
  }

  // Strip trailing platform suffixes if present e.g. "Apex Cloud | LinkedIn"
  cleaned = cleaned.replace(/\s*[|\-•]\s*(?:LinkedIn|Internshala|Indeed|Glassdoor).*$/i, '').trim();

  if (cleaned.length > 60 || cleaned.length < 2) return '';
  return cleaned;
}

/**
 * Normalizes job titles.
 */
function cleanJobTitle(title) {
  if (!title || typeof title !== 'string') return '';
  let cleaned = title.trim().replace(/^["']|["']$/g, '');
  cleaned = cleaned.replace(/\s+/g, ' ');

  const lower = cleaned.toLowerCase();
  // Reject login, authwall, or generic placeholder titles
  if (
    lower.includes('by clicking continue') ||
    lower.includes('sign in') ||
    lower.includes('log in') ||
    lower.includes('join now') ||
    lower.includes('join linkedin') ||
    lower.includes('cookie policy') ||
    lower.includes('terms of service')
  ) {
    return '';
  }

  // Exact fallback words check
  if (lower === 'internship role' || lower === 'job title' || lower === 'role' || lower === 'position' || lower === 'internship') {
    return '';
  }

  for (const blocked of BLOCKED_JOB_TITLES) {
    if (lower === blocked || lower.startsWith(blocked + ' ') || lower.startsWith(blocked + ' at linkedin') || lower.endsWith(' ' + blocked)) {
      return '';
    }
  }

  // Strip trailing company or platform suffixes e.g. "Frontend Intern at Apex Cloud | LinkedIn"
  cleaned = cleaned.replace(/\s*[|\-•]\s*(?:LinkedIn|Internshala|Indeed|Glassdoor).*$/i, '').trim();

  if (cleaned.length > 80 || cleaned.length < 3) return '';
  return cleaned;
}

/**
 * Validates extracted or user-provided company name and job title before generating searches.
 */
function validateSearchMetadata(companyName, jobTitle) {
  const comp = cleanCompanyName(companyName);
  const title = cleanJobTitle(jobTitle);

  if (!comp || comp === NOT_MENTIONED) {
    return {
      valid: false,
      reason: 'Company name is missing, generic, or could not be verified from the posting.',
      needsManualInput: true
    };
  }

  if (!title || title === NOT_MENTIONED) {
    return {
      valid: false,
      reason: 'Job title is missing, generic, or could not be verified from the posting.',
      needsManualInput: true
    };
  }

  return {
    valid: true,
    companyName: comp,
    jobTitle: title
  };
}

/**
 * Extracts grounded, evidence-based job details from HTML or plain text.
 */
function extractGroundedJobInfo(content, url = '', isManualText = false) {
  const contentStr = String(content || '');
  const urlStr = String(url || '');

  const result = {
    companyName: NOT_MENTIONED,
    jobTitle: NOT_MENTIONED,
    jobDescription: '',
    location: NOT_MENTIONED,
    workMode: NOT_MENTIONED,
    requiredSkills: [],
    preferredSkills: [],
    stipend: NOT_MENTIONED,
    duration: NOT_MENTIONED,
    applicationDeadline: NOT_MENTIONED,
    jobRefId: NOT_MENTIONED,
    evidence: {}
  };

  if (!contentStr.trim()) return result;

  // Handle Manually Pasted Text
  if (isManualText || !contentStr.includes('<')) {
    const text = contentStr.trim();
    result.jobDescription = text.slice(0, 3000);
    result.evidence.jobDescription = { value: 'Full description', source: 'Manually pasted job description' };

    // 1. Title extraction from manual text
    const titlePatterns = [
      /(?:role|job title|position|hiring for|opening for)\s*[:\-]\s*([^\n\r,]{3,60})/i,
      /(?:is looking for a|is looking for an|looking for a|looking for an|is hiring for a|is hiring for an)\s+([^\n\r,]{3,60}?)(?:\.|$|\n)/i,
      /^([A-Z][A-Za-z0-9\s\/\-]{3,50}\s+(?:Intern|Internship|Trainee|Engineer|Developer|Associate|Specialist|Analyst))\b/m,
      /(?:Job Title|Title)\s*[:\-]\s*([^\n\r]+)/i
    ];
    for (const p of titlePatterns) {
      const m = text.match(p);
      if (m && m[1]) {
        const cleaned = cleanJobTitle(m[1]);
        if (cleaned) {
          result.jobTitle = cleaned;
          result.evidence.jobTitle = { value: cleaned, source: `Headline from pasted text: "${m[0].trim()}"` };
          break;
        }
      }
    }

    // 2. Company extraction from manual text
    const compPatterns = [
      /(?:company|organization|employer|at)\s*[:\-]\s*([^\n\r,]{2,50})/i,
      /([A-Z][A-Za-z0-9\s]{2,40}(?:Technologies|Labs|Systems|Solutions|Corp|Inc|Pvt|Ltd|Services|LLC))\s+(?:is looking for|is hiring|welcomes|invites|seeks)/i,
      /([A-Z][A-Za-z0-9\s]{2,40})\s+(?:is looking for|is hiring|welcomes|invites|seeks)/i,
      /about\s+([A-Z][A-Za-z0-9\s]{2,40}(?:Technologies|Labs|Systems|Solutions|Corp|Inc|Pvt|Ltd|Services))/i,
      /([A-Z][A-Za-z0-9\s]{2,40}(?:Technologies|Labs|Systems|Solutions|Corp|Inc|Pvt|Ltd|Services))\s+(?:is hiring|welcomes)/i
    ];
    for (const p of compPatterns) {
      const m = text.match(p);
      if (m && m[1]) {
        const cleaned = cleanCompanyName(m[1]);
        if (cleaned) {
          result.companyName = cleaned;
          result.evidence.companyName = { value: cleaned, source: `Company field from pasted text: "${m[0].trim()}"` };
          break;
        }
      }
    }

    // 3. Location extraction from manual text
    const locMatch = text.match(/(?:location|workplace|work location)\s*[:\-]\s*([^\n\r]{3,50})/i) ||
                     text.match(/\b(Remote|Hybrid|Bangalore|Bengaluru|San Francisco|New York|London|Delhi|Noida|Gurgaon|Hyderabad|Mumbai|Pune|Chandigarh|Korba)\b/i);
    if (locMatch) {
      const locVal = (locMatch[1] || locMatch[0]).trim();
      result.location = locVal;
      result.evidence.location = { value: locVal, source: `Location specified in text: "${locMatch[0].trim()}"` };
    } else {
      result.evidence.location = { value: NOT_MENTIONED, source: 'Not specified in pasted text' };
    }

    // 4. Work mode
    if (/\bremote\b/i.test(text)) {
      result.workMode = 'Remote';
      result.evidence.workMode = { value: 'Remote', source: 'Remote work mode stated in text' };
    } else if (/\bhybrid\b/i.test(text)) {
      result.workMode = 'Hybrid';
      result.evidence.workMode = { value: 'Hybrid', source: 'Hybrid work mode stated in text' };
    } else if (/\bon[\-\s]?site\b/i.test(text)) {
      result.workMode = 'On-site';
      result.evidence.workMode = { value: 'On-site', source: 'On-site work mode stated in text' };
    } else {
      result.evidence.workMode = { value: NOT_MENTIONED, source: 'Work mode not specified' };
    }

    // 5. Stipend / Compensation
    const stipendMatch = text.match(/(?:stipend|salary|compensation|pay)\s*[:\-]?\s*([^\n\r]{3,40})/i) ||
                         text.match(/(?:₹|\$|£|€|INR|USD)\s*[\d,]+(?:\s*-\s*[\d,]+)?(?:\s*\/\s*(?:month|mo|hr|year))?/i);
    if (stipendMatch) {
      const val = (stipendMatch[1] || stipendMatch[0]).trim();
      result.stipend = val;
      result.evidence.stipend = { value: val, source: `Compensation field: "${stipendMatch[0].trim()}"` };
    } else {
      result.evidence.stipend = { value: NOT_MENTIONED, source: 'Stipend not mentioned in job posting' };
    }

    // 6. Duration
    const durMatch = text.match(/(?:duration|internship period|period)\s*[:\-]?\s*(\d+\s*(?:months?|weeks?|mo))/i);
    if (durMatch) {
      result.duration = durMatch[1].trim();
      result.evidence.duration = { value: durMatch[1].trim(), source: `Duration specification: "${durMatch[0].trim()}"` };
    } else {
      result.evidence.duration = { value: NOT_MENTIONED, source: 'Duration not mentioned in job posting' };
    }

    // 7. Job Reference ID (strictly requires ID or Ref ID followed by separator)
    const idMatch = text.match(/(?:Job\s*ID|Req\s*ID|Requisition\s*ID|Job\s*Ref|Ref\s*ID)\s*[:#\-]\s*([A-Za-z0-9\-]{4,25})/i);
    if (idMatch && !BLOCKED_REF_IDS.has(idMatch[1].toLowerCase())) {
      result.jobRefId = idMatch[1].trim();
      result.evidence.jobRefId = { value: idMatch[1].trim(), source: `Requisition code: "${idMatch[0].trim()}"` };
    } else {
      result.evidence.jobRefId = { value: NOT_MENTIONED, source: 'Job reference ID not mentioned in job posting' };
    }

    // 8. Application Deadline
    const deadMatch = text.match(/(?:deadline|apply by|last date to apply)\s*[:\-]?\s*([^\n\r,]{4,35})/i);
    if (deadMatch) {
      result.applicationDeadline = deadMatch[1].trim();
      result.evidence.applicationDeadline = { value: deadMatch[1].trim(), source: `Deadline: "${deadMatch[0].trim()}"` };
    } else {
      result.evidence.applicationDeadline = { value: NOT_MENTIONED, source: 'Deadline not mentioned in job posting' };
    }

    // 9. Skills
    const skills = extractSkillsFromText(text);
    result.requiredSkills = skills.requiredSkills;
    result.preferredSkills = skills.preferredSkills;

    return result;
  }

  // HTML Webpage Extraction
  // -------------------------------------------------------------
  // STRATEGY 1: Structured Schema.org JSON-LD (Highest Precision)
  // -------------------------------------------------------------
  const jsonLd = extractJsonLdJobPosting(contentStr);
  if (jsonLd) {
    if (jsonLd.title) {
      const cleaned = cleanJobTitle(jsonLd.title);
      if (cleaned) {
        result.jobTitle = cleaned;
        result.evidence.jobTitle = { value: cleaned, source: `Schema.org JobPosting.title: "${cleaned}"` };
      }
    }

    if (jsonLd.hiringOrganization && (jsonLd.hiringOrganization.name || typeof jsonLd.hiringOrganization === 'string')) {
      const rawName = jsonLd.hiringOrganization.name || jsonLd.hiringOrganization;
      const cleaned = cleanCompanyName(rawName);
      if (cleaned) {
        result.companyName = cleaned;
        result.evidence.companyName = { value: cleaned, source: `Schema.org hiringOrganization: "${cleaned}"` };
      }
    }

    if (jsonLd.description) {
      const cleanDesc = sanitizeWebpageText(jsonLd.description, 3000);
      result.jobDescription = cleanDesc;
      result.evidence.jobDescription = { value: 'Verified description body', source: 'Schema.org description' };
    }

    // Location
    if (jsonLd.jobLocation) {
      const addr = jsonLd.jobLocation.address;
      if (addr) {
        const parts = [addr.addressLocality, addr.addressRegion, addr.addressCountry].filter(Boolean);
        if (parts.length > 0) {
          result.location = parts.join(', ');
          result.evidence.location = { value: result.location, source: `Schema.org jobLocation: "${result.location}"` };
        }
      }
    }

    // Work Mode
    if (jsonLd.jobLocationType === 'TELECOMMUTE') {
      result.workMode = 'Remote';
      result.evidence.workMode = { value: 'Remote', source: 'Schema.org jobLocationType: TELECOMMUTE' };
    } else if (jsonLd.description && /\bhybrid\b/i.test(jsonLd.description)) {
      result.workMode = 'Hybrid';
      result.evidence.workMode = { value: 'Hybrid', source: 'Hybrid workplace noted in Schema.org description' };
    } else if (result.location !== NOT_MENTIONED) {
      result.workMode = 'On-site';
      result.evidence.workMode = { value: 'On-site', source: 'Physical address specified in job location' };
    }

    // Stipend / Salary
    if (jsonLd.baseSalary) {
      const s = jsonLd.baseSalary;
      const cur = s.currency || '';
      const val = s.value ? (s.value.value || `${s.value.minValue || ''} - ${s.value.maxValue || ''}`) : '';
      const unit = s.value?.unitText || s.unitText || '';
      if (val) {
        result.stipend = `${cur} ${val} ${unit}`.trim();
        result.evidence.stipend = { value: result.stipend, source: `Schema.org baseSalary specification` };
      }
    }

    // Identifier / Job Ref ID
    if (jsonLd.identifier && (jsonLd.identifier.value || jsonLd.identifier.name)) {
      const idVal = String(jsonLd.identifier.value || jsonLd.identifier.name).trim();
      if (!BLOCKED_REF_IDS.has(idVal.toLowerCase())) {
        result.jobRefId = idVal;
        result.evidence.jobRefId = { value: idVal, source: `Schema.org identifier: "${idVal}"` };
      }
    }

    // Deadline
    if (jsonLd.validThrough) {
      result.applicationDeadline = String(jsonLd.validThrough).trim();
      result.evidence.applicationDeadline = { value: result.applicationDeadline, source: `Schema.org validThrough: "${result.applicationDeadline}"` };
    }

    // Employment type / duration
    if (jsonLd.employmentType) {
      result.duration = String(jsonLd.employmentType).trim();
      result.evidence.duration = { value: result.duration, source: `Schema.org employmentType` };
    }

    const skills = extractSkillsFromText(result.jobDescription);
    result.requiredSkills = skills.requiredSkills;
    result.preferredSkills = skills.preferredSkills;
  }

  // -------------------------------------------------------------
  // STRATEGY 2: OpenGraph & Semantic HTML Metadata (if Schema missing/partial)
  // -------------------------------------------------------------
  const meta = extractMetaTags(contentStr);

  // If job title still missing, try OpenGraph title e.g. "Frontend Intern at Apex Cloud | LinkedIn"
  if (result.jobTitle === NOT_MENTIONED && meta.ogTitle) {
    const rawOg = meta.ogTitle.replace(/\s*[|\-•]\s*(?:LinkedIn|Internshala|Indeed).*$/i, '').trim();
    if (rawOg.includes(' at ')) {
      const parts = rawOg.split(/\s+at\s+/i);
      const cleanedTitle = cleanJobTitle(parts[0]);
      const cleanedComp = cleanCompanyName(parts[1]);
      if (cleanedTitle) {
        result.jobTitle = cleanedTitle;
        result.evidence.jobTitle = { value: cleanedTitle, source: `OpenGraph og:title: "${meta.ogTitle}"` };
      }
      if (result.companyName === NOT_MENTIONED && cleanedComp) {
        result.companyName = cleanedComp;
        result.evidence.companyName = { value: cleanedComp, source: `OpenGraph og:title company: "${cleanedComp}"` };
      }
    } else {
      const cleaned = cleanJobTitle(rawOg);
      if (cleaned) {
        result.jobTitle = cleaned;
        result.evidence.jobTitle = { value: cleaned, source: `OpenGraph og:title: "${meta.ogTitle}"` };
      }
    }
  }

  // Heading tags inspection (h1, h2, h3)
  const headingMatches = Array.from(contentStr.matchAll(/<h[1-3]\b[^>]*>([\s\S]*?)<\/h[1-3]>/gi));
  for (const hm of headingMatches) {
    const hText = sanitizeWebpageText(hm[1]).trim();
    if (!hText) continue;

    // Check if heading is a job title
    if (result.jobTitle === NOT_MENTIONED) {
      if (/intern|internship|developer|engineer|designer|analyst|trainee|associate/i.test(hText)) {
        const cleanedTitle = cleanJobTitle(hText);
        if (cleanedTitle) {
          result.jobTitle = cleanedTitle;
          result.evidence.jobTitle = { value: cleanedTitle, source: `HTML Heading <${hm[0].slice(1, 3)}>: "${cleanedTitle}"` };
          continue;
        }
      }
    }

    // Check if heading is a company name
    if (result.companyName === NOT_MENTIONED) {
      if (!/intern|developer|engineer|analyst|job|role|posting/i.test(hText) || /(?:Technologies|Labs|Systems|Solutions|Corp|Inc|Pvt|Ltd|Services)/i.test(hText)) {
        const cleanedComp = cleanCompanyName(hText);
        if (cleanedComp) {
          result.companyName = cleanedComp;
          result.evidence.companyName = { value: cleanedComp, source: `HTML Heading <${hm[0].slice(1, 3)}>: "${cleanedComp}"` };
        }
      }
    }
  }

  // Text-level title patterns if still missing
  if (result.jobTitle === NOT_MENTIONED) {
    const textTitleMatch = contentStr.match(/(?:role|job title|position|hiring for|opening for)\s*[:\-]\s*([^\n\r,<]{3,60})/i) ||
                           contentStr.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (textTitleMatch && textTitleMatch[1]) {
      const raw = textTitleMatch[1].replace(/\s*[|\-•]\s*(?:LinkedIn|Internshala|Indeed).*$/i, '').trim();
      const cleaned = cleanJobTitle(raw);
      if (cleaned) {
        result.jobTitle = cleaned;
        result.evidence.jobTitle = { value: cleaned, source: `Title pattern match: "${cleaned}"` };
      }
    }
  }

  // Text-level company patterns if still missing
  if (result.companyName === NOT_MENTIONED) {
    const compTagMatch = contentStr.match(/<a\b[^>]*class=["'][^"']*company[^"']*["'][^>]*>([^<]+)<\/a>/i) ||
                         contentStr.match(/<span\b[^>]*class=["'][^"']*company[^"']*["'][^>]*>([^<]+)<\/span>/i) ||
                         contentStr.match(/(?:company|organization|employer)\s*[:\-]\s*([^\n\r,<]{2,50})/i) ||
                         contentStr.match(/about\s+([A-Z][A-Za-z0-9\s]{2,40}(?:Technologies|Labs|Systems|Solutions|Corp|Inc|Pvt|Ltd|Services))/i) ||
                         contentStr.match(/([A-Z][A-Za-z0-9\s]{2,40}(?:Technologies|Labs|Systems|Solutions|Corp|Inc|Pvt|Ltd|Services))\s+(?:is hiring|welcomes)/i);
    if (compTagMatch && compTagMatch[1]) {
      const cleaned = cleanCompanyName(compTagMatch[1]);
      if (cleaned) {
        result.companyName = cleaned;
        result.evidence.companyName = { value: cleaned, source: `Posting employer element: "${cleaned}"` };
      }
    }
  }

  // Clean description if still missing
  if (!result.jobDescription) {
    const sanitized = sanitizeWebpageText(contentStr, 3000);
    result.jobDescription = sanitized;
    result.evidence.jobDescription = { value: 'Sanitized page text', source: 'Webpage text content' };
  }

  // Location if still missing
  if (result.location === NOT_MENTIONED) {
    const locTagMatch = contentStr.match(/<span\b[^>]*class=["'][^"']*(?:location|city|workplace)[^"']*["'][^>]*>([^<]+)<\/span>/i) ||
                        result.jobDescription.match(/(?:location|workplace)\s*[:\-]\s*([^\n\r,]{3,40})/i);
    if (locTagMatch && locTagMatch[1]) {
      const locVal = locTagMatch[1].trim();
      if (!BLOCKED_COMPANY_NAMES.has(locVal.toLowerCase())) {
        result.location = locVal;
        result.evidence.location = { value: locVal, source: `Location badge: "${locTagMatch[0].trim()}"` };
      }
    }
  }

  // Work Mode if still missing
  if (result.workMode === NOT_MENTIONED) {
    if (/\bremote\b/i.test(result.jobDescription)) {
      result.workMode = 'Remote';
      result.evidence.workMode = { value: 'Remote', source: 'Remote work mentioned in posting' };
    } else if (/\bhybrid\b/i.test(result.jobDescription)) {
      result.workMode = 'Hybrid';
      result.evidence.workMode = { value: 'Hybrid', source: 'Hybrid work model specified' };
    } else if (result.location !== NOT_MENTIONED) {
      result.workMode = 'On-site';
      result.evidence.workMode = { value: 'On-site', source: 'Physical office location specified' };
    }
  }

  // Stipend if still missing
  if (result.stipend === NOT_MENTIONED) {
    const stipendMatch = result.jobDescription.match(/(?:stipend|salary|compensation|pay)\s*[:\-]?\s*([^\n\r]{3,40})/i) ||
                         result.jobDescription.match(/(?:₹|\$|£|€|INR|USD)\s*[\d,]+(?:\s*-\s*[\d,]+)?(?:\s*\/\s*(?:month|mo|hr|year))?/i);
    if (stipendMatch) {
      result.stipend = (stipendMatch[1] || stipendMatch[0]).trim();
      result.evidence.stipend = { value: result.stipend, source: `Posting compensation text: "${stipendMatch[0].trim()}"` };
    }
  }

  // Job Ref ID if still missing (strictly requires separator and valid format)
  if (result.jobRefId === NOT_MENTIONED) {
    const idMatch = result.jobDescription.match(/(?:Job\s*ID|Req\s*ID|Requisition\s*ID|Job\s*Ref|Ref\s*ID)\s*[:#\-]\s*([A-Za-z0-9\-]{4,25})/i);
    if (idMatch && !BLOCKED_REF_IDS.has(idMatch[1].toLowerCase())) {
      result.jobRefId = idMatch[1].trim();
      result.evidence.jobRefId = { value: idMatch[1].trim(), source: `Requisition reference: "${idMatch[0].trim()}"` };
    }
  }

  // Skills if not already populated
  if (result.requiredSkills.length === 0) {
    const skills = extractSkillsFromText(result.jobDescription);
    result.requiredSkills = skills.requiredSkills;
    result.preferredSkills = skills.preferredSkills;
  }

  // Ensure every evidence item has a default if not found
  for (const field of ['companyName', 'jobTitle', 'location', 'workMode', 'stipend', 'duration', 'applicationDeadline', 'jobRefId']) {
    if (!result.evidence[field]) {
      result.evidence[field] = { value: result[field], source: 'Not specified in posting' };
    }
  }

  return result;
}

/**
 * Generates targeted Google and Bing search URLs from verified company & title metadata.
 * Format: "Company Name" "Job Title" Location careers
 */
function generateCompanySearchQueries(companyName, jobTitle, location = '', jobRefId = '') {
  const validation = validateSearchMetadata(companyName, jobTitle);
  if (!validation.valid) {
    return {
      valid: false,
      reason: validation.reason,
      needsManualInput: true,
      query: '',
      google: null,
      bing: null
    };
  }

  const comp = validation.companyName;
  const title = validation.jobTitle;
  const parts = [`"${comp}"`, `"${title}"`];

  if (location && location !== NOT_MENTIONED && typeof location === 'string') {
    const cleanLoc = location.replace(/^["']|["']$/g, '').trim();
    if (cleanLoc && !BLOCKED_COMPANY_NAMES.has(cleanLoc.toLowerCase())) {
      parts.push(cleanLoc);
    }
  }

  if (jobRefId && jobRefId !== NOT_MENTIONED && typeof jobRefId === 'string' && !BLOCKED_REF_IDS.has(jobRefId.toLowerCase())) {
    parts.push(`"${jobRefId.trim()}"`);
  }

  parts.push('careers');

  const query = parts.join(' ');
  const encoded = encodeURIComponent(query);

  return {
    valid: true,
    query,
    google: `https://www.google.com/search?q=${encoded}`,
    bing: `https://www.bing.com/search?q=${encoded}`
  };
}

module.exports = {
  NOT_MENTIONED,
  BLOCKED_COMPANY_NAMES,
  BLOCKED_JOB_TITLES,
  BLOCKED_REF_IDS,
  isLinkedInJobUrl,
  isLinkedInGenericUrl,
  isGenericAggregatorLanding,
  detectJobPageType,
  extractJsonLdJobPosting,
  extractMetaTags,
  extractSkillsFromText,
  cleanCompanyName,
  cleanJobTitle,
  validateSearchMetadata,
  extractGroundedJobInfo,
  generateCompanySearchQueries
};
