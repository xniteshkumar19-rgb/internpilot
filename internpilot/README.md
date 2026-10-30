# InternPilot 🚀

**InternPilot** is a smart, privacy-first internship assistant built with Node.js, Express, and Google Gemini API. It assists students (especially first-years) by detecting predatory scam postings, estimating skill alignment, and drafting grounded application emails.

---

## 📁 Project Structure

```text
internpilot/
├── public/
│   ├── index.html         # Main UI with resume & posting inputs, live log, disclaimer
│   ├── tracker.html       # Application tracker & weekly activity report
│   ├── tracker.js         # Tracker UI controller & activity score visualizer
│   ├── style.css          # Modern light theme, single accent color, mobile-responsive
│   ├── app.js             # UI controller, AI posting reader & email writer
│   ├── agent.js           # Autonomous agent decision loop & interactive state machine
│   └── tools.js           # Scam check, skill matcher, computeActivity, and local storage tools
├── server.js              # Express server & secure POST /api/gemini proxy
├── sample-resume.txt      # Fictional 1st-year student resume (Rohan Sharma)
├── test-postings.json     # 7 fictional postings (genuine, scam, tricky, lowmatch)
├── test-scam.js           # CLI test runner for scam checker
├── test-match.js          # CLI test runner for skill matcher
├── test-score.js          # CLI test runner for weekly activity score
├── test-reader.js         # CLI test runner for AI posting reader
├── test-email.js          # CLI test runner for AI email drafter
├── test-agent-paths.js    # Integration test for agent decision paths
├── test-browser-e2e.js    # End-to-end browser tests in Chrome via CDP
├── package.json           # Dependencies and test scripts
├── .gitignore             # Excludes node_modules and .env
└── README.md              # Project documentation
```

---

## ⚡ Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment Variables
Create a `.env` file in the `internpilot` root directory:
```env
GEMINI_API_KEY=your_gemini_api_key_here
PORT=3000
```
*(The Gemini API key is securely handled by the backend server and is never sent to the browser.)*

### 3. Start the Server
```bash
npm start
```
Open [http://localhost:3000](http://localhost:3000) in your web browser.

---

## 🧪 Testing

You can run each component's test suite independently via npm:

### Rule-Based Tests (No API key required)
- **Scam Checker Test**: Evaluates all 7 postings against risk rules and prints evidence phrases:
  ```bash
  npm run test:scam
  ```
- **Skill Matcher Test**: Matches `sample-resume.txt` against all 7 postings:
  ```bash
  npm run test:match
  ```
- **Weekly Activity Score Test**: Evaluates `computeActivity` on fixed cases with fixed dates and breakdowns:
  ```bash
  npm run test:score
  ```
- **Decision Paths Integration Test**: Tests all 3 agent branches and user overrides:
  ```bash
  npm run test:paths
  ```
- **Real Chrome Browser E2E Test**: Drives live browser clicks and verifies all UI views:
  ```bash
  npm run test:browser
  ```

### AI-Powered Tests (Requires server running & `GEMINI_API_KEY` set)
1. Start the server in one terminal: `npm start`
2. Run the tests in another terminal:
   - **AI Posting Reader Test**:
     ```bash
     npm run test:reader
     ```
   - **AI Email Drafter Test**:
     ```bash
     npm run test:email
     ```

---

## 🧠 Core Features & Architecture

### 1. Rule-Based Scam Checker (`tools.js`)
- Weighted point scoring system capped at 100:
  - Asks for money (fees, kit charges, security deposits): **40 pts**
  - Sensitive identity / financial details before selection (Aadhaar, PAN, bank): **25 pts**
  - Free domain email addresses (`@gmail.com`, etc.): **20 pts**
  - Contact exclusively on WhatsApp or Telegram: **15 pts**
  - Guaranteed placement / 100% job claims: **15 pts**
  - Heavy urgency (*limited seats*, *apply today*): **10 pts**
  - Direct selection without assessment: **10 pts**
  - Vague company identity (*a reputed MNC*): **10 pts**
- Risk Levels:
  - **Low Risk** (< 30 pts)
  - **Medium Risk** (30 - 59 pts)
  - **High Risk** ($\ge$ 60 pts)

### 2. Rule-Based Skill Matcher (`tools.js`)
- Curated list of ~60 common internship skills with an alias dictionary.
- Boundary-aware token matching (e.g. `c++`, `c#`, `node.js`, `ui/ux`, avoiding `"java"` inside `"javascript"`).
- Levels: `< 30%` ("very low"), `30% - 59%` ("low"), `$\ge$ 60%` ("good").

### 3. AI Posting Reader (`app.js`)
- Structured extraction using Gemini (`role`, `company`, `deadline`, `contactEmail`, `requiredSkills`, `stipend`).
- Injection-hardened prompt declaring input text as untrusted data.
- Built-in 20-second timeout with single-attempt retry and fallback to keyword extraction.

### 4. Grounded AI Email Writer (`app.js`)
- Generates polite, professional outreach strictly under 150 words.
- Strictly forbidden from inventing skills, coursework, or experiences not present in the resume.
- User retains full agency: provides editable inputs, a copy button, and an `"Open in my email app"` `mailto:` button. The application **never** sends emails automatically.

### 5. Autonomous Agent Loop (`agent.js`)
- State machine evaluating input step-by-step with explicit `Decision:` logs:
  - **High Scam Risk**: Halts execution, presents safety tips, and offers a *"Continue anyway"* override.
  - **Low Skill Match (< 30%)**: Halts execution, generates a *"Learn these first"* list of missing skills, and offers a *"Draft anyway"* override.
  - **Application Tracker**: Prompts the user before saving (`Yes` / `No`) to `localStorage`. Never saves silently.

---

## 🛡️ Disclaimer
*Scam check shows warning signs, not proof. Verify the company independently.*
