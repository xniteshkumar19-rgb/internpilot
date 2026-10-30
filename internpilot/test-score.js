const { computeActivity } = require('./public/tools.js');

console.log('====================================================');
console.log('     INTERNPILOT WEEKLY ACTIVITY SCORE TEST         ');
console.log('====================================================\n');

// Fixed baseline "now" date
const fixedNow = new Date('2026-10-30T12:00:00.000Z');
const MS_PER_DAY = 86400000;

function daysAgo(n) {
  return new Date(fixedNow.getTime() - n * MS_PER_DAY).toISOString();
}

function daysAhead(n) {
  return new Date(fixedNow.getTime() + n * MS_PER_DAY).toISOString();
}

function printResult(caseName, result, expectedScore) {
  console.log(`▶ [${caseName}]`);
  console.log(`  Calculated Score: ${result.score}/100 (Expected: ${expectedScore}) | Level: ${result.level}`);
  console.log(`  This Week Stats : Sent=${result.thisWeek.sent}, Saved=${result.thisWeek.saved}, Progressed=${result.thisWeek.progressed}`);
  console.log(`  Last Week Stats : Sent=${result.lastWeek.sent}`);
  console.log(`  Overdue Saved   : ${result.overdueSaved}`);
  console.log(`  Next Action     : "${result.nextAction}"`);
  console.log('  Point Breakdown :');
  result.breakdown.forEach(b => {
    console.log(`    - ${b.label.padEnd(35)} : ${String(b.points).padStart(2)} / ${b.max} pts  (${b.detail})`);
  });
  const passed = result.score === expectedScore;
  console.log(`  Status: ${passed ? '✓ PASSED' : '✗ FAILED'}`);
  console.log('----------------------------------------------------\n');
  return passed;
}

let allPassed = true;

// ---------------------------------------------------------------
// CASE 1: No applications
// Expected: 20 points from deadline discipline only, level "Getting started"
// ---------------------------------------------------------------
const case1 = computeActivity([], fixedNow);
if (!printResult('CASE 1: No Applications', case1, 20)) allPassed = false;

// ---------------------------------------------------------------
// CASE 2a: 3 sent this week, also created this week, no overdue
// 45 (sent) + 15 (saved) + 20 (discipline) = 80 ("Very active")
// ---------------------------------------------------------------
const case2aApps = [
  {
    id: 'app_1',
    company: 'Alpha Corp',
    role: 'Intern',
    status: 'Applied',
    createdAt: daysAgo(2),
    appliedAt: daysAgo(2),
    deadline: daysAhead(10)
  },
  {
    id: 'app_2',
    company: 'Beta Labs',
    role: 'Intern',
    status: 'Applied',
    createdAt: daysAgo(4),
    appliedAt: daysAgo(4),
    deadline: daysAhead(14)
  },
  {
    id: 'app_3',
    company: 'Gamma Tech',
    role: 'Intern',
    status: 'Applied',
    createdAt: daysAgo(6),
    appliedAt: daysAgo(6),
    deadline: daysAhead(20)
  }
];
const case2a = computeActivity(case2aApps, fixedNow);
if (!printResult('CASE 2a: 3 Sent This Week (Also Created This Week, No Overdue)', case2a, 80)) allPassed = false;

// ---------------------------------------------------------------
// CASE 2b: 3 sent this week, created > 7 days ago, no overdue
// 45 (sent) + 0 (saved this week) + 20 (discipline) = 65 ("Active")
// ---------------------------------------------------------------
const case2bApps = [
  {
    id: 'app_4',
    company: 'Delta Corp',
    role: 'Intern',
    status: 'Applied',
    createdAt: daysAgo(10), // created > 7 days ago
    appliedAt: daysAgo(1),  // sent this week
    deadline: daysAhead(5)
  },
  {
    id: 'app_5',
    company: 'Epsilon Labs',
    role: 'Intern',
    status: 'Applied',
    createdAt: daysAgo(12), // created > 7 days ago
    appliedAt: daysAgo(3),  // sent this week
    deadline: daysAhead(12)
  },
  {
    id: 'app_6',
    company: 'Zeta Software',
    role: 'Intern',
    status: 'Applied',
    createdAt: daysAgo(15), // created > 7 days ago
    appliedAt: daysAgo(5),  // sent this week
    deadline: daysAhead(18)
  }
];
const case2b = computeActivity(case2bApps, fixedNow);
if (!printResult('CASE 2b: 3 Sent This Week (Created > 7 Days Ago, No Overdue)', case2b, 65)) allPassed = false;

// ---------------------------------------------------------------
// CASE 3: 2 overdue saved applications
// Starting discipline 20 - 2 * 10 = 0 points; overdue warning in nextAction
// ---------------------------------------------------------------
const case3Apps = [
  {
    id: 'app_7',
    company: 'Late Corp',
    role: 'Intern',
    status: 'Saved',
    createdAt: daysAgo(10),
    deadline: daysAgo(2) // 2 days past deadline!
  },
  {
    id: 'app_8',
    company: 'Expired Labs',
    role: 'Intern',
    status: 'Saved',
    createdAt: daysAgo(15),
    deadline: daysAgo(5) // 5 days past deadline!
  }
];
const case3 = computeActivity(case3Apps, fixedNow);
if (!printResult('CASE 3: 2 Overdue Saved Applications', case3, 0)) allPassed = false;

console.log('====================================================');
if (allPassed) {
  console.log('🎉 ALL ACTIVITY SCORE TEST CASES PASSED!');
} else {
  console.error('❌ SOME TEST CASES FAILED.');
  process.exit(1);
}
console.log('====================================================');
