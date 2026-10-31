/**
 * InternPilot - Sample Test Data Module
 * Self-contained JS module bundled directly into serverless functions
 * Eliminates runtime filesystem dependencies on Vercel.
 */

const samplePostings = [
  {
    "id": "genuine-1",
    "label": "genuine",
    "text": "Apex Cloud Technologies is hiring a Junior Web Developer Intern for our Bengaluru office. In this 3-month paid internship, you will build user-facing components, write maintainable code, and collaborate with experienced mentors. Required skills: HTML, CSS, JavaScript, Git, and strong Communication. Selection includes a take-home coding assignment followed by a technical video interview. Stipend: Rs 15,000 per month. Deadline: November 25, 2026. Application method: Email your resume and portfolio link to careers@apexcloudtech.com with subject 'Junior Web Developer Intern Application'."
  },
  {
    "id": "genuine-2",
    "label": "genuine",
    "text": "Vanguard Data Labs is seeking a passionate Frontend Engineering Intern. You will assist our product team in building interactive dashboards and web applications. Requirements: JavaScript, React, HTML, CSS, and Git version control. Our evaluation process consists of a resume screening and two rounds of live pair programming. Stipend: Rs 20,000 per month. Application deadline: December 10, 2026. Send applications directly to interns@vanguarddatalabs.io."
  },
  {
    "id": "scam-1",
    "label": "scam",
    "text": "Urgent Requirement! QuickCareer Global Services announces direct selection with no interview for immediate joining as Junior Office Assistant & Web Trainee. 100% placement guaranteed with stipend up to Rs 35,000. All selected applicants must pay a registration fee and kit charges of Rs 1,500 for onboarding materials. Contact on WhatsApp only: +91 98765 43210. Limited seats available, apply today!"
  },
  {
    "id": "scam-2",
    "label": "scam",
    "text": "A reputed MNC is urgently hiring Trainee Interns across India for remote positions. Immediate offer letter provided with no assessment required. Candidates must submit their Aadhaar, PAN card, and bank details before selection to process the security deposit and training fee of Rs 2,500. Guaranteed job upon completion. Last chance, apply today by emailing your documents to hr.recruitment.team.india@gmail.com."
  },
  {
    "id": "tricky-1",
    "label": "tricky",
    "text": "Horizon Next Systems is looking for a Python and Web Development Intern. We build enterprise workflow automation tools using Python, JavaScript, and Git. The internship includes hands-on mentorship and Rs 18,000 monthly stipend. Please note: selected candidates must pay a refundable security deposit of Rs 1,000 prior to training kit shipment, which will be reimbursed in your first month stipend. Send your profile to contact@horizonnext.com. Deadline: December 5, 2026."
  },
  {
    "id": "tricky-2",
    "label": "tricky",
    "text": "Starlight Creative Studio is looking for an enthusiastic Web Design Intern to help create responsive landing pages and user interfaces using HTML, CSS, and Figma. We offer Rs 12,000 monthly stipend and flexible hours for college students. Limited seats, last chance to apply today! Applications close November 20, 2026. Please send your design portfolio to starlight.creative.team@gmail.com."
  },
  {
    "id": "lowmatch-1",
    "label": "lowmatch",
    "text": "NeuroData Technologies is hiring an Associate Machine Learning Intern for our AI Research lab. Candidates will assist research engineers in building neural networks and evaluating datasets. Required skills: PyTorch, TensorFlow, Statistics, Python, and SQL. Candidates must pass a 60-minute algorithmic coding round followed by an ML research discussion. Stipend: Rs 25,000 per month. Deadline: November 30, 2026. Apply by emailing ml-interns@neurodatatech.ai."
  }
];

const sampleResume = `ROHAN SHARMA
Email: rohan.sharma.student@example.com | Phone: +91 98765 01234
Location: New Delhi, India | GitHub: github.com/rohan-sharma-dev

OBJECTIVE
Motivated first-year Computer Science undergraduate eager to apply foundational programming and web development skills in an internship role.

EDUCATION
Green Valley Institute of Technology
Bachelor of Technology in Computer Science and Engineering (1st Year)
Expected Graduation: 2028 | Current CGPA: 8.6 / 10

TECHNICAL SKILLS
- Languages: Python, JavaScript, HTML, CSS
- Version Control: Git, GitHub
- Soft Skills: Communication, Problem Solving, Team Collaboration

PROJECTS
Student Study Tracker (Web App)
- Developed a lightweight, responsive task and revision tracker using HTML, CSS, and vanilla JavaScript.
- Implemented localStorage to persist student daily tasks and subject schedules across browser sessions.
- Maintained code versioning and commit history on GitHub using Git.

ADDITIONAL ACTIVITIES
- Active member of the College Open Source Coding Club.
- Completed 30 Days of Python coding challenge.`;

let interviewDemoCache = {};
try {
  interviewDemoCache = require('./interview-demo-cache.json');
} catch (e) {
  try {
    interviewDemoCache = require('./public/interview-demo-cache.json');
  } catch (e2) {
    try {
      interviewDemoCache = require('../public/interview-demo-cache.json');
    } catch {}
  }
}

module.exports = {
  samplePostings,
  sampleResume,
  interviewDemoCache
};
