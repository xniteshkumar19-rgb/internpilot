/**
 * InternPilot - Original Internship Source Finder Engine
 * 
 * Capabilities:
 * 1. Extraction of structured job metadata from submitted posting text/HTML.
 * 2. Multi-angle official careers search strategy (domain discovery + ATS prioritization).
 * 3. Evidence-based comparator (Company, Title, Location, Skills, Ref ID, Stipend).
 * 4. Four evidence-based result states:
 *    - OFFICIAL_LISTING_FOUND
 *    - POSSIBLE_OFFICIAL_MATCH
 *    - THIRD_PARTY_ONLY
 *    - UNABLE_TO_VERIFY
 * 5. Grounded offline Demo Mode dataset for offline audits and verification.
 */

const { URL } = require('url');
const { safeFetchUrl, sanitizeWebpageText, validateUrlForSSRF } = require('./source-finder-security');
const { executeWebSearch, getSearchStatus } = require('./search-adapter');

// Known 3rd-party job aggregators & boards
const THIRD_PARTY_JOB_BOARDS = [
  'linkedin.com',
  'internshala.com',
  'indeed.com',
  'glassdoor.com',
  'naukri.com',
  'monster.com',
  'simplyhired.com',
  'ziprecruiter.com',
  'foundit.in',
  'shine.com',
  'unstop.com',
  'cuvette.tech',
  'wellfound.com',
  'angel.co'
];

// Verified corporate Applicant Tracking Systems (ATS)
const VERIFIED_ATS_DOMAINS = [
  'greenhouse.io',
  'lever.co',
  'myworkdayjobs.com',
  'workday.com',
  'ashbyhq.com',
  'smartrecruiters.com',
  'jobs.jobvite.com',
  'breezy.hr',
  'workable.com',
  'recruitee.com',
  'pinpointhq.com',
  'applytojob.com',
  'rippling-ats.com'
];

/**
 * Normalizes company names for robust comparison.
 */
function normalizeCompanyName(name) {
  if (!name || typeof name !== 'string') return '';
  return name
    .toLowerCase()
    .replace(/\b(inc|incorporated|corp|corporation|llc|ltd|limited|pvt|private|technologies|tech|solutions|systems|labs|global|services|group)\b/gi, '')
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Normalizes job titles.
 */
function normalizeJobTitle(title) {
  if (!title || typeof title !== 'string') return '';
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Checks if a hostname belongs to a known aggregator.
 */
function isThirdPartyJobBoard(hostname) {
  const h = (hostname || '').toLowerCase();
  return THIRD_PARTY_JOB_BOARDS.some(board => h === board || h.endsWith('.' + board));
}

/**
 * Checks if a hostname belongs to an enterprise ATS.
 */
function isVerifiedATS(hostname) {
  const h = (hostname || '').toLowerCase();
  return VERIFIED_ATS_DOMAINS.some(ats => h === ats || h.endsWith('.' + ats));
}

/**
 * Rule-based fallback extractor for job information from raw posting text.
 */
function extractJobInfoFromText(text, fallbackUrl = '') {
  const str = String(text || '');
  const info = {
    companyName: '',
    jobTitle: '',
    location: '',
    description: '',
    requiredSkills: [],
    preferredSkills: [],
    stipend: '',
    duration: '',
    jobRefId: '',
    publicationDate: '',
    applicationDeadline: ''
  };

  // Job Title extraction
  const titlePatterns = [
    /(?:role|job title|position|hiring for|opening for)[\s:]+([^\n\r,]{3,60})/i,
    /^([A-Z][A-Za-z0-9\s\/\-]{4,50}\s+(?:Intern|Internship|Trainee|Engineer|Developer|Associate))/m,
    /(?:Job Title|Title)\s*[:\-]\s*([^\n\r]+)/i
  ];
  for (const p of titlePatterns) {
    const m = str.match(p);
    if (m && m[1]) {
      info.jobTitle = m[1].trim();
      break;
    }
  }

  // Company Name extraction
  const compPatterns = [
    /(?:company|organization|at|employer)\s*[:\-]\s*([^\n\r,]{2,50})/i,
    /([A-Z][A-Za-z0-9\s]{2,40}(?:Technologies|Labs|Systems|Solutions|Corp|Inc|Pvt|Ltd|Services))\s+(?:is hiring|is looking|welcomes)/i,
    /about\s+([A-Z][A-Za-z0-9\s]{2,40}(?:Technologies|Labs|Systems|Solutions|Corp|Inc|Pvt|Ltd|Services))/i,
    /(?:Welcome to|Join)\s+([A-Z][A-Za-z0-9\s]{2,40})/i
  ];
  for (const p of compPatterns) {
    const m = str.match(p);
    if (m && m[1]) {
      info.companyName = m[1].trim();
      break;
    }
  }

  // Location extraction
  const locMatch = str.match(/(?:location|workplace|work location)\s*[:\-]\s*([^\n\r,]{3,50})/i) ||
                   str.match(/\b(Remote|Hybrid|Bangalore|Bengaluru|San Francisco|New York|London|Delhi|Noida|Gurgaon|Hyderabad|Mumbai|Pune)\b/i);
  if (locMatch) info.location = (locMatch[1] || locMatch[0]).trim();

  // Job Ref ID
  const idMatch = str.match(/(?:Job ID|Ref ID|Req ID|Requisition ID|Reference Code|ID)\s*[:#\-]?\s*([A-Za-z0-9\-]{4,25})/i);
  if (idMatch) info.jobRefId = idMatch[1].trim();

  // Stipend / Compensation
  const stipendMatch = str.match(/(?:stipend|salary|compensation|pay)\s*[:\-]?\s*([^\n\r]{3,40})/i) ||
                       str.match(/(?:₹|\$|£|€|INR|USD)\s*[\d,]+(?:\s*-\s*[\d,]+)?(?:\s*\/\s*(?:month|mo|hr|year))?/i);
  if (stipendMatch) info.stipend = (stipendMatch[1] || stipendMatch[0]).trim();

  // Duration
  const durMatch = str.match(/(?:duration|internship period|period)\s*[:\-]?\s*(\d+\s*(?:months?|weeks?|mo))/i);
  if (durMatch) info.duration = durMatch[1].trim();

  // Deadline
  const deadMatch = str.match(/(?:deadline|apply by|last date to apply)\s*[:\-]?\s*([^\n\r,]{4,35})/i);
  if (deadMatch) info.applicationDeadline = deadMatch[1].trim();

  // Extract skills (common technologies)
  const commonTech = [
    'javascript', 'typescript', 'react', 'python', 'node.js', 'html', 'css',
    'docker', 'aws', 'git', 'sql', 'postgres', 'mongodb', 'graphql', 'java',
    'c++', 'kubernetes', 'linux', 'ci/cd', 'rest api', 'next.js', 'vue', 'tailwind'
  ];
  const lower = str.toLowerCase();
  for (const tech of commonTech) {
    const escaped = tech.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (new RegExp('\\b' + escaped + '\\b', 'i').test(lower)) {
      info.requiredSkills.push(tech);
    }
  }

  info.description = str.slice(0, 3000);
  return info;
}

/**
 * Generates targeted Google and Bing search URLs from extracted job metadata.
 */
function generateSearchLinks(companyName, jobTitle) {
  const comp = (companyName || '').trim();
  const title = (jobTitle || '').trim();
  const parts = [];
  if (comp) parts.push(`"${comp}"`);
  if (title) parts.push(`"${title}"`);
  parts.push('careers');
  const query = parts.join(' ');
  const encoded = encodeURIComponent(query);

  return {
    query,
    google: `https://www.google.com/search?q=${encoded}`,
    bing: `https://www.bing.com/search?q=${encoded}`
  };
}

/**
 * Calculates string similarity between 0 and 1.
 */
function tokenSimilarity(a, b) {
  const normA = new Set(normalizeJobTitle(a).split(' ').filter(w => w.length > 2));
  const normB = new Set(normalizeJobTitle(b).split(' ').filter(w => w.length > 2));
  if (normA.size === 0 || normB.size === 0) return 0;

  let intersection = 0;
  for (const item of normA) {
    if (normB.has(item)) intersection++;
  }
  return (2 * intersection) / (normA.size + normB.size);
}

/**
 * Deterministic Ground-Truth Demo Mode Scenarios.
 */
const DEMO_SCENARIOS = {
  'apex': {
    submittedUrl: 'https://www.linkedin.com/jobs/view/apex-cloud-junior-web-developer-intern-39218',
    submittedInfo: {
      companyName: 'Apex Cloud Technologies',
      jobTitle: 'Junior Web Developer Intern',
      location: 'Bengaluru, India (Hybrid)',
      stipend: '₹25,000 / month',
      duration: '6 Months',
      jobRefId: 'APEX-2026-DEV-04',
      requiredSkills: ['javascript', 'react', 'html', 'css', 'git']
    },
    officialCandidate: {
      url: 'https://careers.apexcloud.io/internships/junior-web-dev',
      domain: 'apexcloud.io',
      sourceType: 'Official Careers Portal',
      jobTitle: 'Junior Web Developer Intern',
      companyName: 'Apex Cloud Technologies',
      location: 'Bengaluru, India (Hybrid)',
      jobRefId: 'APEX-2026-DEV-04',
      stipend: '₹25,000 / month',
      requiredSkills: ['javascript', 'react', 'html', 'css', 'git'],
      applicationDeadline: 'Rolling Admissions 2026'
    },
    expectedState: 'OFFICIAL_LISTING_FOUND',
    confidenceScore: 98,
    evidence: {
      companyMatched: true,
      titleSimilarity: 1.0,
      jobRefIdMatched: true,
      locationMatched: true,
      domainVerified: true,
      explanation: 'Verified official corporate domain apexcloud.io matches company name, job reference ID APEX-2026-DEV-04, and exact title.'
    }
  },

  'vanguard': {
    submittedUrl: 'https://internshala.com/internship/detail/frontend-intern-vanguard-data-labs-8812',
    submittedInfo: {
      companyName: 'Vanguard Data Labs',
      jobTitle: 'Frontend Engineering Intern',
      location: 'Remote',
      stipend: 'Unpaid / Certificate only',
      duration: '3 Months',
      jobRefId: '',
      requiredSkills: ['javascript', 'react', 'css']
    },
    officialCandidate: {
      url: 'https://vanguarddatalabs.com/careers/frontend-engineer-junior',
      domain: 'vanguarddatalabs.com',
      sourceType: 'Official Company Website',
      jobTitle: 'Junior Frontend Engineer',
      companyName: 'Vanguard Data Labs',
      location: 'San Francisco, CA (On-site)',
      stipend: '$75,000 - $90,000 / year',
      requiredSkills: ['javascript', 'react', 'typescript', 'css']
    },
    expectedState: 'POSSIBLE_OFFICIAL_MATCH',
    confidenceScore: 68,
    evidence: {
      companyMatched: true,
      titleSimilarity: 0.75,
      jobRefIdMatched: false,
      locationMatched: false,
      domainVerified: true,
      differingFields: [
        { field: 'Role Type', submitted: '3-Month Intern', official: 'Junior Full-Time Engineer' },
        { field: 'Location', submitted: 'Remote', official: 'San Francisco, CA (On-site)' },
        { field: 'Compensation', submitted: 'Unpaid', official: 'Paid Full-Time Salary ($75k-$90k)' }
      ],
      explanation: 'Official website listing found at vanguarddatalabs.com, but role seniority, location, and compensation parameters differ from the third-party posting.'
    }
  },

  'horizon': {
    submittedUrl: 'https://indeed.com/viewjob?jk=horizon-next-python-intern-4421',
    submittedInfo: {
      companyName: 'Horizon Next Systems',
      jobTitle: 'Python and Web Development Intern',
      location: 'Delhi NCR',
      stipend: '₹8,000 / month',
      jobRefId: ''
    },
    officialCandidate: null,
    expectedState: 'THIRD_PARTY_ONLY',
    confidenceScore: 35,
    evidence: {
      companyMatched: false,
      domainVerified: false,
      explanation: 'The internship was confirmed on Indeed. However, multiple web search queries across official domains and verified ATS portals returned no active direct company listing for Horizon Next Systems.'
    }
  },

  'unknown': {
    submittedUrl: 'https://invalid-unreachable-domain-xyz.com/job/1234',
    submittedInfo: null,
    officialCandidate: null,
    expectedState: 'UNABLE_TO_VERIFY',
    confidenceScore: 0,
    evidence: {
      explanation: 'The submitted URL could not be accessed or resolved. No company information was extracted to perform verified cross-referencing. Note: This does not mean the position is fraudulent.'
    }
  }
};

/**
 * Main verification routine.
 * Handles both Demo Mode and live web searches.
 */
async function verifyInternshipSource(postingUrl, options = {}) {
  const isDemo = Boolean(options.isDemo);
  const rawHtml = options.rawHtml || null;

  // Handle DEMO MODE routing first (works 100% offline without network or DNS)
  if (isDemo) {
    const lowerUrl = (postingUrl || '').toLowerCase();
    let matchKey = 'apex';
    if (lowerUrl.includes('vanguard') || lowerUrl.includes('internshala')) matchKey = 'vanguard';
    else if (lowerUrl.includes('horizon') || lowerUrl.includes('indeed')) matchKey = 'horizon';
    else if (lowerUrl.includes('invalid') || lowerUrl.includes('xyz')) matchKey = 'unknown';

    const scenario = DEMO_SCENARIOS[matchKey];
    const resp = formatVerificationResponse(postingUrl, scenario.submittedInfo, scenario.officialCandidate, scenario.expectedState, scenario.evidence, scenario.confidenceScore);
    resp.isDemo = true;
    return resp;
  }

  // Step 1: Validate URL & check SSRF safety (Live mode)
  const ssrfCheck = await validateUrlForSSRF(postingUrl, { skipDns: Boolean(rawHtml) });
  if (!ssrfCheck.valid) {
    return {
      success: false,
      state: 'UNABLE_TO_VERIFY',
      label: 'Unable to Verify',
      error: `Security Validation Failed: ${ssrfCheck.error}`,
      evidence: {
        sourceUrl: postingUrl,
        reason: ssrfCheck.error,
        explanation: `URL security validation failed: ${ssrfCheck.error}`
      }
    };
  }

  // LIVE MODE
  // Step 1: Fetch submitted posting
  let pageText = '';
  try {
    if (rawHtml) {
      pageText = sanitizeWebpageText(rawHtml);
    } else {
      const fetchResult = await safeFetchUrl(postingUrl);
      pageText = sanitizeWebpageText(fetchResult.body);
    }
  } catch (fetchErr) {
    return {
      success: false,
      state: 'UNABLE_TO_VERIFY',
      label: 'Unable to Verify',
      error: `Could not safely retrieve submitted posting: ${fetchErr.message}`,
      evidence: {
        sourceUrl: postingUrl,
        reason: fetchErr.message,
        explanation: 'The submitted webpage could not be retrieved. Please verify the URL or paste the job description text directly.'
      }
    };
  }

  // Step 2: Extract job info from page text
  const extractedInfo = extractJobInfoFromText(pageText, postingUrl);
  if (!extractedInfo.companyName && !extractedInfo.jobTitle) {
    return {
      success: false,
      state: 'UNABLE_TO_VERIFY',
      label: 'Unable to Verify',
      evidence: {
        sourceUrl: postingUrl,
        explanation: 'Could not reliably identify company name or job title from the provided webpage text.'
      }
    };
  }

  // Step 3: Check search provider status
  const searchStatus = getSearchStatus();
  if (!searchStatus.configured || options.mode === 'assisted') {
    const searchLinks = generateSearchLinks(extractedInfo.companyName, extractedInfo.jobTitle);
    return {
      success: true,
      mode: 'assisted',
      state: 'ASSISTED_READY',
      label: 'Assisted Source Verification Ready',
      searchConfigured: Boolean(searchStatus.configured),
      searchConfigMessage: searchStatus.message,
      requiredEnvVars: searchStatus.requiredEnvVars,
      submittedUrl: postingUrl,
      submittedInfo: extractedInfo,
      extractedJobInfo: extractedInfo,
      searchLinks: searchLinks,
      assistedNotice: 'No external search API required. InternPilot has extracted the role information and prepared direct search links. You can search the official website and paste the discovered posting below to verify matching details.',
      evidence: {
        sourceUrl: postingUrl,
        explanation: `Extracted job information for "${extractedInfo.companyName || 'Company'}" - "${extractedInfo.jobTitle || 'Role'}". Search queries generated for Google and Bing to assist manual inspection.`
      }
    };
  }

  // Step 4: Execute web search queries for official source
  // Query 1: Exact company careers / jobs
  const q1 = `"${extractedInfo.companyName}" "${extractedInfo.jobTitle}" careers OR jobs`;
  const searchResp = await executeWebSearch(q1);

  if (!searchResp.success || !searchResp.results || searchResp.results.length === 0) {
    return formatVerificationResponse(postingUrl, extractedInfo, null, 'THIRD_PARTY_ONLY', {
      sourceUrl: postingUrl,
      explanation: `Search executed across active web providers, but no official company listing was located for "${extractedInfo.companyName}".`
    }, 30);
  }

  // Step 5: Filter candidates for official domain or verified ATS
  const candidates = searchResp.results;
  let officialCandidate = null;
  let isAts = false;
  let domainEvidence = '';

  for (const c of candidates) {
    let candUrl;
    try { candUrl = new URL(c.url); } catch { continue; }
    const host = candUrl.hostname.toLowerCase();

    // Skip known third-party job aggregators
    if (isThirdPartyJobBoard(host)) continue;

    // Check 1: Verified Corporate Applicant Tracking System (ATS)
    if (isVerifiedATS(host)) {
      officialCandidate = c;
      isAts = true;
      domainEvidence = `Verified corporate ATS portal (${host}) linked to ${extractedInfo.companyName}.`;
      break;
    }

    // Check 2: Official Corporate Careers Domain
    // Requires exact root domain match or official careers subdomain (never arbitrary resemblance)
    const normComp = normalizeCompanyName(extractedInfo.companyName).replace(/\s+/g, '');
    const isExactCompanyRoot = host === `${normComp}.com` || host === `${normComp}.io` || host === `${normComp}.org` || host === `${normComp}.net` ||
                               host === `careers.${normComp}.com` || host === `careers.${normComp}.io` || host === `jobs.${normComp}.com`;
    const isOfficialCareersPath = (candUrl.pathname.startsWith('/careers') || candUrl.pathname.startsWith('/jobs') || candUrl.pathname.startsWith('/internships'));

    if (normComp.length >= 3 && (isExactCompanyRoot || (host.endsWith(`.${normComp}.com`) && isOfficialCareersPath))) {
      officialCandidate = c;
      domainEvidence = `Established official corporate domain (${host}) with direct /careers portal.`;
      break;
    }
  }

  if (!officialCandidate) {
    return formatVerificationResponse(postingUrl, extractedInfo, null, 'THIRD_PARTY_ONLY', {
      sourceUrl: postingUrl,
      explanation: `Searched official sources for "${extractedInfo.companyName}", but only third-party listings or unrelated pages were discovered.`
    }, 40);
  }

  // Step 6: Deep comparison between extracted info and candidate listing
  const titleSim = tokenSimilarity(extractedInfo.jobTitle, officialCandidate.title);
  const compMatch = normalizeCompanyName(extractedInfo.companyName).length > 0 &&
                    (officialCandidate.title.toLowerCase().includes(normalizeCompanyName(extractedInfo.companyName)) ||
                     officialCandidate.snippet.toLowerCase().includes(normalizeCompanyName(extractedInfo.companyName)) ||
                     officialCandidate.url.toLowerCase().includes(normalizeCompanyName(extractedInfo.companyName).replace(/\s+/g, '')));

  if (titleSim >= 0.7 && compMatch) {
    return formatVerificationResponse(postingUrl, extractedInfo, {
      url: officialCandidate.url,
      jobTitle: officialCandidate.title,
      companyName: extractedInfo.companyName,
      sourceType: isAts ? 'Verified Corporate ATS' : 'Official Corporate Website'
    }, 'OFFICIAL_LISTING_FOUND', {
      sourceUrl: officialCandidate.url,
      companyMatched: true,
      titleSimilarity: Math.round(titleSim * 100),
      explanation: `Verified official listing found at ${officialCandidate.url}. ${domainEvidence} Title and company alignment confirmed.`
    }, 95);
  } else if (compMatch || titleSim >= 0.5) {
    return formatVerificationResponse(postingUrl, extractedInfo, {
      url: officialCandidate.url,
      jobTitle: officialCandidate.title,
      companyName: extractedInfo.companyName,
      sourceType: isAts ? 'Verified Corporate ATS' : 'Official Corporate Website'
    }, 'POSSIBLE_OFFICIAL_MATCH', {
      sourceUrl: officialCandidate.url,
      differingFields: [
        { field: 'Title match similarity', submitted: extractedInfo.jobTitle, official: officialCandidate.title }
      ],
      explanation: `A related listing was discovered at ${officialCandidate.url}, but specific job parameters show differences.`
    }, 65);
  }

  return formatVerificationResponse(postingUrl, extractedInfo, null, 'THIRD_PARTY_ONLY', {
    sourceUrl: postingUrl,
    explanation: 'A listing on a third-party job board was identified, but an official company publication could not be verified.'
  }, 35);
}

/**
 * Normalizes output according to user specifications.
 */
function formatVerificationResponse(submittedUrl, submittedInfo, officialInfo, state, evidence, score = 0) {
  const labelMap = {
    'OFFICIAL_LISTING_FOUND': 'Official Listing Found',
    'POSSIBLE_OFFICIAL_MATCH': 'Possible Official Match',
    'THIRD_PARTY_ONLY': 'Third-Party Listing Only',
    'UNABLE_TO_VERIFY': 'Unable to Verify'
  };

  return {
    success: true,
    state: state,
    label: labelMap[state] || state,
    submittedUrl: submittedUrl,
    submittedInfo: submittedInfo || {},
    officialListing: officialInfo ? {
      url: officialInfo.url || '',
      jobTitle: officialInfo.jobTitle || submittedInfo?.jobTitle || '',
      companyName: officialInfo.companyName || submittedInfo?.companyName || '',
      location: officialInfo.location || '',
      sourceType: officialInfo.sourceType || 'Official Website',
      stipend: officialInfo.stipend || '',
      applicationDeadline: officialInfo.applicationDeadline || ''
    } : null,
    evidence: evidence || {},
    confidenceScore: score,
    verifiedAt: new Date().toISOString()
  };
}

/**
 * Assisted Source Verification Mode Comparator.
 * Compares a submitted third-party posting with a student-supplied candidate official listing.
 * 
 * Result States:
 * - DETAILS_MATCH: "Details Match"
 * - POSSIBLE_MATCH: "Possible Match"
 * - DETAILS_DIFFER: "Details Differ"
 * - UNABLE_TO_COMPARE: "Unable to Compare"
 */
async function compareAssistedPostings(submittedUrl, officialUrl, options = {}) {
  const isDemo = Boolean(options.isDemo);
  const submittedHtml = options.submittedHtml || null;
  const officialHtml = options.officialHtml || null;

  const disclaimer = 'Assisted Comparison: Comparison performed between student-supplied third-party posting and candidate company listing. InternPilot did not independently discover this official listing.';

  // 1. SSRF check for both URLs if in live mode
  if (!isDemo) {
    const subCheck = await validateUrlForSSRF(submittedUrl, { skipDns: Boolean(submittedHtml) });
    if (!subCheck.valid) {
      return {
        success: false,
        mode: 'assisted',
        state: 'UNABLE_TO_COMPARE',
        label: 'Unable to Compare',
        submittedUrl,
        officialUrl,
        error: `Submitted URL security check failed: ${subCheck.error}`,
        disclaimer,
        evidence: { explanation: `Security check failed for submitted URL: ${subCheck.error}` }
      };
    }

    const offCheck = await validateUrlForSSRF(officialUrl, { skipDns: Boolean(officialHtml) });
    if (!offCheck.valid) {
      return {
        success: false,
        mode: 'assisted',
        state: 'UNABLE_TO_COMPARE',
        label: 'Unable to Compare',
        submittedUrl,
        officialUrl,
        error: `Official URL security check failed: ${offCheck.error}`,
        disclaimer,
        evidence: { explanation: `Security check failed for candidate official URL: ${offCheck.error}` }
      };
    }
  }

  // 2. Demo Mode Handling (Deterministic & Offline)
  if (isDemo) {
    const subLower = (submittedUrl || '').toLowerCase();
    const offLower = (officialUrl || '').toLowerCase();

    // Check invalid/unreachable first
    if (subLower.includes('invalid') || offLower.includes('invalid') || subLower.includes('unreachable') || offLower.includes('unreachable')) {
      return {
        success: false,
        mode: 'assisted',
        state: 'UNABLE_TO_COMPARE',
        label: 'Unable to Compare',
        submittedUrl,
        officialUrl,
        matchingDetails: [],
        differingFields: [],
        disclaimer,
        evidence: {
          explanation: 'Could not access or verify the supplied URL. Verification could not be completed.'
        },
        confidenceScore: 0,
        isDemo: true
      };
    }

    // Apex Match (Details Match)
    if (offLower.includes('apex') || (subLower.includes('apex') && !offLower.includes('differ') && !offLower.includes('other'))) {
      const submitted = {
        companyName: 'Apex Cloud Technologies',
        jobTitle: 'Junior Web Developer Intern',
        location: 'Bengaluru, India (Hybrid)',
        stipend: '₹25,000 / month',
        duration: '6 Months',
        jobRefId: 'APEX-2026-DEV-04',
        requiredSkills: ['javascript', 'react', 'html', 'css', 'git']
      };
      const official = {
        url: officialUrl,
        companyName: 'Apex Cloud Technologies',
        jobTitle: 'Junior Web Developer Intern',
        location: 'Bengaluru, India (Hybrid)',
        stipend: '₹25,000 / month',
        duration: '6 Months',
        jobRefId: 'APEX-2026-DEV-04',
        requiredSkills: ['javascript', 'react', 'html', 'css', 'git'],
        sourceType: 'Student-Provided Official Careers Page'
      };
      return {
        success: true,
        mode: 'assisted',
        state: 'DETAILS_MATCH',
        label: 'Details Match',
        submittedUrl,
        officialUrl,
        submittedInfo: submitted,
        officialListing: official,
        matchingDetails: [
          'Company Name: Apex Cloud Technologies',
          'Job Title: Junior Web Developer Intern',
          'Location: Bengaluru, India (Hybrid)',
          'Job Reference ID: APEX-2026-DEV-04',
          'Stipend: ₹25,000 / month',
          'Required Skills: JavaScript, React, HTML, CSS, Git'
        ],
        differingFields: [],
        confidenceScore: 98,
        disclaimer,
        evidence: {
          sourceUrl: officialUrl,
          explanation: 'Submitted third-party posting details match the provided official company careers listing. Company name, title, reference ID, and compensation align.',
          differingFields: []
        },
        isDemo: true
      };
    }

    // Vanguard (Possible Match)
    if (offLower.includes('vanguard') || (subLower.includes('vanguard') && !offLower.includes('differ'))) {
      const submitted = {
        companyName: 'Vanguard Data Labs',
        jobTitle: 'Frontend Engineering Intern',
        location: 'Remote',
        stipend: 'Unpaid / Certificate only',
        duration: '3 Months',
        jobRefId: '',
        requiredSkills: ['javascript', 'react', 'css']
      };
      const official = {
        url: officialUrl,
        companyName: 'Vanguard Data Labs',
        jobTitle: 'Junior Frontend Engineer',
        location: 'San Francisco, CA (On-site)',
        stipend: '$75,000 - $90,000 / year',
        duration: 'Full-Time',
        jobRefId: '',
        requiredSkills: ['javascript', 'react', 'typescript', 'css'],
        sourceType: 'Student-Provided Official Careers Page'
      };
      const differingFields = [
        { field: 'Role Title & Seniority', submitted: 'Frontend Engineering Intern (3-Month)', official: 'Junior Frontend Engineer (Full-Time)' },
        { field: 'Location', submitted: 'Remote', official: 'San Francisco, CA (On-site)' },
        { field: 'Compensation', submitted: 'Unpaid / Certificate only', official: 'Paid Salary ($75,000 - $90,000 / yr)' }
      ];
      return {
        success: true,
        mode: 'assisted',
        state: 'POSSIBLE_MATCH',
        label: 'Possible Match',
        submittedUrl,
        officialUrl,
        submittedInfo: submitted,
        officialListing: official,
        matchingDetails: [
          'Company Name: Vanguard Data Labs',
          'Core Skill Set: JavaScript, React, CSS'
        ],
        differingFields,
        confidenceScore: 68,
        disclaimer,
        evidence: {
          sourceUrl: officialUrl,
          explanation: 'Provided official listing shows partial alignment with the third-party posting, but role level, location, or compensation parameters differ.',
          differingFields
        },
        isDemo: true
      };
    }

    // Differing (Details Differ)
    const submitted = {
      companyName: 'Horizon Next Systems',
      jobTitle: 'Python and Web Development Intern',
      location: 'Delhi NCR',
      stipend: '₹8,000 / month',
      jobRefId: ''
    };
    const differingFields = [
      { field: 'Company / Position', submitted: 'Horizon Next Systems - Python Intern', official: 'Differing or Unrelated Listing' }
    ];
    return {
      success: true,
      mode: 'assisted',
      state: 'DETAILS_DIFFER',
      label: 'Details Differ',
      submittedUrl,
      officialUrl,
      submittedInfo: submitted,
      officialListing: {
        url: officialUrl,
        jobTitle: 'Differing Role',
        companyName: 'Differing Company',
        sourceType: 'Student-Provided Careers Page'
      },
      matchingDetails: [],
      differingFields,
      confidenceScore: 25,
      disclaimer,
      evidence: {
        sourceUrl: officialUrl,
        explanation: 'The provided careers URL does not correspond to the submitted job posting. Title, role, or company details show significant divergence.',
        differingFields
      },
      isDemo: true
    };
  }

  // 3. Live Mode Fetch & Inspection
  let subText = '';
  let offText = '';

  try {
    if (submittedHtml) {
      subText = sanitizeWebpageText(submittedHtml);
    } else {
      const subFetch = await safeFetchUrl(submittedUrl);
      subText = sanitizeWebpageText(subFetch.body);
    }
  } catch (err) {
    return {
      success: false,
      mode: 'assisted',
      state: 'UNABLE_TO_COMPARE',
      label: 'Unable to Compare',
      submittedUrl,
      officialUrl,
      error: `Could not retrieve submitted posting: ${err.message}`,
      disclaimer,
      evidence: { explanation: `Failed to safely fetch submitted posting: ${err.message}` }
    };
  }

  try {
    if (officialHtml) {
      offText = sanitizeWebpageText(officialHtml);
    } else {
      const offFetch = await safeFetchUrl(officialUrl);
      offText = sanitizeWebpageText(offFetch.body);
    }
  } catch (err) {
    return {
      success: false,
      mode: 'assisted',
      state: 'UNABLE_TO_COMPARE',
      label: 'Unable to Compare',
      submittedUrl,
      officialUrl,
      error: `Could not retrieve candidate official URL: ${err.message}`,
      disclaimer,
      evidence: { explanation: `Failed to safely fetch candidate official URL: ${err.message}` }
    };
  }

  // Extract from both
  const subInfo = extractJobInfoFromText(subText, submittedUrl);
  const offInfo = extractJobInfoFromText(offText, officialUrl);

  if (!subInfo.companyName && !subInfo.jobTitle && !offInfo.companyName && !offInfo.jobTitle) {
    return {
      success: false,
      mode: 'assisted',
      state: 'UNABLE_TO_COMPARE',
      label: 'Unable to Compare',
      submittedUrl,
      officialUrl,
      disclaimer,
      evidence: { explanation: 'Could not extract sufficient job or company details from one or both pages to perform comparison.' }
    };
  }

  // Compare details
  const matchingDetails = [];
  const differingFields = [];

  // Company comparison
  const normSubComp = normalizeCompanyName(subInfo.companyName);
  const normOffComp = normalizeCompanyName(offInfo.companyName);
  let offHost = '';
  try { offHost = new URL(officialUrl).hostname.toLowerCase(); } catch {}

  const compMatch = (normSubComp && normOffComp && (normSubComp.includes(normOffComp) || normOffComp.includes(normSubComp))) ||
                    (normSubComp && offHost.replace(/[^a-z0-9]/g, '').includes(normSubComp.replace(/\s+/g, '')));

  if (compMatch) {
    matchingDetails.push(`Company: ${subInfo.companyName || offInfo.companyName}`);
  } else if (subInfo.companyName || offInfo.companyName) {
    differingFields.push({
      field: 'Company Name',
      submitted: subInfo.companyName || 'Not specified',
      official: offInfo.companyName || 'Not specified'
    });
  }

  // Title similarity
  const titleSim = tokenSimilarity(subInfo.jobTitle, offInfo.jobTitle);
  if (titleSim >= 0.70) {
    matchingDetails.push(`Job Title: ${subInfo.jobTitle}`);
  } else if (subInfo.jobTitle || offInfo.jobTitle) {
    differingFields.push({
      field: 'Job Title',
      submitted: subInfo.jobTitle || 'Not specified',
      official: offInfo.jobTitle || 'Not specified'
    });
  }

  // Location comparison
  if (subInfo.location && offInfo.location) {
    const locSim = tokenSimilarity(subInfo.location, offInfo.location);
    if (locSim >= 0.5 || subInfo.location.toLowerCase() === offInfo.location.toLowerCase()) {
      matchingDetails.push(`Location: ${subInfo.location}`);
    } else {
      differingFields.push({
        field: 'Location',
        submitted: subInfo.location,
        official: offInfo.location
      });
    }
  }

  // Stipend / Compensation
  if (subInfo.stipend && offInfo.stipend) {
    if (subInfo.stipend.toLowerCase() === offInfo.stipend.toLowerCase()) {
      matchingDetails.push(`Compensation: ${subInfo.stipend}`);
    } else {
      differingFields.push({
        field: 'Compensation',
        submitted: subInfo.stipend,
        official: offInfo.stipend
      });
    }
  }

  // Job Reference ID
  if (subInfo.jobRefId && offInfo.jobRefId) {
    if (subInfo.jobRefId.toLowerCase() === offInfo.jobRefId.toLowerCase()) {
      matchingDetails.push(`Job Ref ID: ${subInfo.jobRefId}`);
    } else {
      differingFields.push({
        field: 'Job Ref ID',
        submitted: subInfo.jobRefId,
        official: offInfo.jobRefId
      });
    }
  }

  // Skills intersection
  const subSkills = new Set(subInfo.requiredSkills || []);
  const sharedSkills = (offInfo.requiredSkills || []).filter(s => subSkills.has(s));
  if (sharedSkills.length > 0) {
    matchingDetails.push(`Skills in common: ${sharedSkills.join(', ')}`);
  }

  // Determine State
  let state = 'DETAILS_DIFFER';
  let label = 'Details Differ';
  let score = 30;

  if (compMatch && titleSim >= 0.70) {
    state = 'DETAILS_MATCH';
    label = 'Details Match';
    score = 95;
  } else if ((compMatch && titleSim >= 0.35) || titleSim >= 0.70) {
    state = 'POSSIBLE_MATCH';
    label = 'Possible Match';
    score = 65;
  }

  return {
    success: true,
    mode: 'assisted',
    state,
    label,
    submittedUrl,
    officialUrl,
    submittedInfo: subInfo,
    officialListing: {
      url: officialUrl,
      jobTitle: offInfo.jobTitle || subInfo.jobTitle,
      companyName: offInfo.companyName || subInfo.companyName,
      location: offInfo.location || subInfo.location,
      stipend: offInfo.stipend || subInfo.stipend,
      jobRefId: offInfo.jobRefId || subInfo.jobRefId,
      sourceType: 'Student-Provided Official Listing'
    },
    matchingDetails,
    differingFields,
    confidenceScore: score,
    disclaimer,
    evidence: {
      sourceUrl: officialUrl,
      explanation: state === 'DETAILS_MATCH'
        ? 'Comparison confirmed strong alignment between submitted posting and candidate careers page. Company and title match.'
        : state === 'POSSIBLE_MATCH'
        ? 'Candidate listing partially matches the submitted posting, but some fields differ.'
        : 'Candidate careers listing differs significantly from the submitted posting.',
      differingFields
    },
    isDemo: false
  };
}

module.exports = {
  extractJobInfoFromText,
  verifyInternshipSource,
  compareAssistedPostings,
  generateSearchLinks,
  isThirdPartyJobBoard,
  isVerifiedATS,
  normalizeCompanyName,
  normalizeJobTitle,
  DEMO_SCENARIOS
};
