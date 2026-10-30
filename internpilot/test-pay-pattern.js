const { scamCheck } = require('./public/tools.js');

console.log('====================================================');
console.log('    INTERNPILOT PAYMENT DETECTION CONTEXT TEST     ');
console.log('====================================================\n');

// Scenarios that MUST trigger the "Asks for money" rule (40 points)
const shouldTriggerScenarios = [
  {
    description: 'Pay registration fees to apply',
    text: 'Apex Infotech is hiring interns. Pay registration fees to apply. Stipend Rs 10,000.'
  },
  {
    description: 'Candidates must pay ₹5,000',
    text: 'Summer internship program. Candidates must pay ₹5,000 for verification and access.'
  },
  {
    description: 'Pay an upfront security deposit',
    text: 'Exciting remote opportunity. Pay an upfront security deposit of Rs 1,000 before onboarding.'
  },
  {
    description: 'Training fees are mandatory',
    text: 'Full stack development internship. Training fees are mandatory prior to project allocation.'
  },
  {
    description: 'Pay to secure your internship',
    text: 'Join as marketing trainee. Pay to secure your internship slot before seats fill up.'
  },
  {
    description: 'Processing fees required',
    text: 'Data science internship. Processing fees required at the time of documentation submission.'
  },
  {
    description: 'Applicants must pay documentation charges',
    text: 'Shortlisted applicants must pay a documentation fee to proceed to final selection.'
  },
  {
    description: 'Pay upfront to confirm enrollment',
    text: 'Selected candidates have to pay upfront to confirm their internship position.'
  }
];

// Scenarios that MUST NOT trigger the "Asks for money" rule
const shouldNotTriggerScenarios = [
  {
    description: 'We pay a monthly stipend of ₹20,000',
    text: 'We are seeking a frontend intern. We pay a monthly stipend of ₹20,000 for 3 months.'
  },
  {
    description: 'Competitive salary will be provided',
    text: 'Join our backend team. A competitive salary will be provided along with mentorship.'
  },
  {
    description: 'Payment will be made monthly',
    text: 'Web developer internship. Payment will be made monthly based on project deliverables.'
  },
  {
    description: 'Paid internship opportunity',
    text: 'Paid internship opportunity in AI and ML with direct guidance from senior engineers.'
  },
  {
    description: 'Salary is negotiable',
    text: 'Software engineering trainee. Salary is negotiable based on candidate skills and interview performance.'
  },
  {
    description: 'Pay shorthand (Pay: ₹25,000/month)',
    text: 'Junior Graphic Designer intern. Pay: ₹25,000 per month. Apply with portfolio.'
  },
  {
    description: 'Equal pay and growth benefits',
    text: 'We offer equal pay, health coverage, and flexible working hours for all interns.'
  },
  {
    description: 'Selected candidates will be paid bi-weekly',
    text: 'Mobile app developer internship. Selected candidates will be paid bi-weekly upon milestone reviews.'
  }
];

let failed = 0;
let passed = 0;

console.log('--- TEST GROUP 1: FEE REQUESTS (Must trigger "Asks for money") ---');
shouldTriggerScenarios.forEach((item, idx) => {
  const result = scamCheck(item.text);
  const moneyReason = result.reasons.find(r => r.rule === 'Asks for money');
  
  if (moneyReason && moneyReason.points === 40) {
    console.log(`[PASS] Case ${idx + 1}: ${item.description}`);
    console.log(`       Evidence: "${moneyReason.evidence}" | Points: ${moneyReason.points}`);
    passed++;
  } else {
    console.error(`[FAIL] Case ${idx + 1}: ${item.description}`);
    console.error(`       Expected "Asks for money" rule (40 pts), but got:`, result.reasons);
    failed++;
  }
});

console.log('\n--- TEST GROUP 2: LEGITIMATE COMPENSATION (Must NOT trigger "Asks for money") ---');
shouldNotTriggerScenarios.forEach((item, idx) => {
  const result = scamCheck(item.text);
  const moneyReason = result.reasons.find(r => r.rule === 'Asks for money');
  
  if (!moneyReason) {
    console.log(`[PASS] Case ${idx + 1}: ${item.description}`);
    console.log(`       Scam score for rule: 0 pts (No false positive)`);
    passed++;
  } else {
    console.error(`[FAIL] Case ${idx + 1}: ${item.description}`);
    console.error(`       FALSE POSITIVE! Triggered: "${moneyReason.evidence}" (${moneyReason.points} pts)`);
    failed++;
  }
});

console.log('\n====================================================');
console.log(`TOTAL: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
console.log('====================================================');

if (failed > 0) {
  process.exit(1);
} else {
  console.log('All payment detection scenarios verified successfully!\n');
  process.exit(0);
}
