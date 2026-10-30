# InternPilot 🚀

## The Problem
First-year college students searching for internships face a surge of predatory fake job postings asking for registration fees, training charges, or sensitive identity documents before interviews. At the same time, managing application deadlines across multiple platforms leads to missed opportunities and scattered notes.

## What It Does
InternPilot is a privacy-first assistant that evaluates internship postings and streamlines applications:
- **Scam Detection:** Flags red flags like upfront fees, free email domains, and direct hiring claims.
- **Skill Alignment:** Compares student resumes against posting requirements without guesswork.
- **Grounded Email Drafter:** Writes concise (<150 words) outreach emails using only facts from the resume.
- **Application Tracker:** Locally tracks deadlines with color-coded urgency and weekly momentum scores.

## How the Agent Decides
The agent pipeline runs sequentially and pauses on critical decisions:
1. **Halts on High Scam Risk:** Stops before skill matching and email drafting. Displays evidence, safety tips, and a manual "Continue anyway" override.
2. **Suggests Skills on Very Low Match:** If match is below 30%, stops email generation and suggests missing skills under "Learn these first" with a "Draft anyway" override.
3. **Asks Before Saving:** Never auto-saves applications. Explicitly prompts the user (`Yes`/`No`) before adding items to the tracker.

## AI vs. Rule-Based Division
- **What Gemini AI Does:**
  - Extracts structured metadata (`role`, `company`, `deadline`, `requiredSkills`, `contactEmail`) under an injection-hardened prompt.
  - Drafts grounded emails strictly referencing facts in the candidate's resume.
- **What Deterministic Rules Do:**
  - Risk scoring and weighted point math for scam detection.
  - Token-boundary skill extraction and percentage calculation.
  - Weekly activity scoring and prioritized next action selection.
  - Local browser persistence in `localStorage`.

## Scoring Rules

### Scam Check (0–100 pts)
Points are summed and capped at 100. Levels: `<30` Low, `30–59` Medium, `≥60` High.
- Asks for money (registration/training/kit fee, security deposit): **40 pts**
- Asks for Aadhaar, PAN, or bank details before selection: **25 pts**
- Free domain email address (`gmail.com`, `yahoo.com`, etc.): **20 pts**
- Contact only on WhatsApp or Telegram: **15 pts**
- Guaranteed job, placement, or stipend claims: **15 pts**
- Heavy urgency (*limited seats*, *apply today*): **10 pts**
- Direct selection with no interview or assessment: **10 pts**
- Vague or missing company name (*a reputed MNC*): **10 pts**

### Weekly Activity Score (0–100 pts)
Uses start-inclusive, end-exclusive time windows (`[start, end)`) over the past 7 days:
- **Applications sent this week:** 15 pts each (max 45 pts)
- **Applications saved this week:** 5 pts each (max 15 pts)
- **Progress this week (Interview / Offer):** 10 pts each (max 20 pts)
- **Deadline discipline:** Starts at 20 pts, $-10$ pts per overdue saved application (min 0 pts)
- **Levels:** `0–29` Getting started, `30–59` Building momentum, `60–79` Active, `80–100` Very active.

## Tech Stack
- **Backend:** Node.js, Express, `dotenv`
- **AI Integration:** Google Gemini API (`gemini-1.5-flash` REST endpoint via native `fetch`)
- **Frontend:** Vanilla JavaScript (ES6+), HTML5, CSS3 (responsive light theme)
- **Storage:** Browser `localStorage` (no external database required)

## Setup & Running

### Prerequisites
- Node.js (v18 or higher)
- npm

### Installation
```bash
cd internpilot
npm install
```

### Environment Configuration
Create a `.env` file in the `internpilot` root:
```env
GEMINI_API_KEY=your_gemini_api_key_here
PORT=3000
```
*(The key is handled securely on the server and is never sent to the browser).*

### Start the Application
```bash
npm start
```
Open [http://localhost:3000](http://localhost:3000) in your web browser.

## Running Tests & Offline Demo Cache
Run automated test suites from the `internpilot` directory:
- `npm run build:demo-cache`: Generates `public/demo-cache.json` for offline Demo Mode using sample postings.
- `npm run test:scam`: Tests rule-based scam check across 7 test postings.
- `npm run test:match`: Tests skill matcher against `sample-resume.txt`.
- `npm run test:score`: Tests weekly activity scoring across 4 edge cases.
- `npm run test:paths`: Tests all 3 agent decision branches and user overrides.
- `npm run test:browser`: Runs full end-to-end browser tests in Chrome via CDP.
- `npm run test:reader`: Tests AI posting extraction *(requires server running)*.
- `npm run test:email`: Tests AI email drafting *(requires server running)*.

## Privacy & Responsible Use
- **Client-Side Privacy:** Your resume text is stored only in browser memory and local storage.
- **Minimal AI Data Sharing:** Posting and resume text are sent to the Gemini API only when running the agent.
- **Human in the Loop:** InternPilot never sends emails automatically; users must review, edit, and click send in their own email client.
- **Advisory Only:** Scam checks identify suspicious patterns, not legal proof. Always independently verify employers.

## Known Limitations
- **Keyword Skill Extraction:** Keyword tokenization can miss implied skills or novel terminology.
- **Scam Detection Scope:** Unlisted scam variations may score low; manual verification remains essential.
- **API Rate Limits:** Free-tier Gemini keys have request quotas and concurrency limits.

## Screenshots
- `docs/screenshot-main.png`: Genuine posting analysis view with live decision log and email draft.
- `docs/screenshot-scam.png`: High risk scam detection warning and essential safety tips.
- `docs/screenshot-lowmatch.png`: Low skill match decision with "Learn these first" missing skills list.
- `docs/screenshot-tracker.png`: Application tracker, nearest deadline sorting, and weekly activity report.

## Future Ideas
- Direct PDF/DOCX resume file upload parser.
- Company domain reputation checks via WHOIS and public registry lookups.
- Calendar export integration for approaching internship deadlines.

## Team
- **Team Member 1:** [Name / Role Placeholder]
- **Team Member 2:** [Name / Role Placeholder]
- **Team Member 3:** [Name / Role Placeholder]
