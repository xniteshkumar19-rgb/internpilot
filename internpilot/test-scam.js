const fs = require('fs');
const path = require('path');
const { scamCheck } = require('./public/tools.js');

const postingsPath = path.join(__dirname, 'test-postings.json');
const postings = JSON.parse(fs.readFileSync(postingsPath, 'utf8'));

console.log('====================================================');
console.log('       INTERNPILOT RULE-BASED SCAM CHECK TEST       ');
console.log('====================================================\n');

postings.forEach((p, idx) => {
  const result = scamCheck(p.text);
  console.log(`[${idx + 1}] ID: ${p.id.padEnd(12)} | Label: ${p.label.toUpperCase().padEnd(8)}`);
  console.log(`    Risk Score: ${result.riskScore}/100  |  Level: ${result.level.toUpperCase()}`);
  if (result.reasons.length > 0) {
    console.log('    Triggered Reasons:');
    result.reasons.forEach(r => {
      console.log(`      - [${r.points} pts] ${r.rule} (Evidence: "${r.evidence}")`);
    });
  } else {
    console.log('    Triggered Reasons: None (Clean posting)');
  }
  console.log('----------------------------------------------------');
});
