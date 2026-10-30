const fs = require('fs');
const path = require('path');
const { matchSkills } = require('./public/tools.js');

const postingsPath = path.join(__dirname, 'test-postings.json');
const resumePath = path.join(__dirname, 'sample-resume.txt');

const postings = JSON.parse(fs.readFileSync(postingsPath, 'utf8'));
const resumeText = fs.readFileSync(resumePath, 'utf8');

console.log('====================================================');
console.log('      INTERNPILOT RULE-BASED SKILL MATCHER TEST     ');
console.log('====================================================\n');

postings.forEach((p, idx) => {
  const result = matchSkills(resumeText, p.text);
  const percentDisplay = result.percent !== null ? `about ${result.percent}%` : 'null (None identified)';
  console.log(`[${idx + 1}] ID: ${p.id.padEnd(12)} | Label: ${p.label.toUpperCase().padEnd(8)}`);
  console.log(`    Match Percent : ${percentDisplay}`);
  console.log(`    Match Level   : ${result.level.toUpperCase()}`);
  console.log(`    Matched Skills: [${result.matched.join(', ')}]`);
  console.log(`    Missing Skills: [${result.missing.join(', ')}]`);
  if (result.note) {
    console.log(`    Note          : ${result.note}`);
  }
  console.log('----------------------------------------------------');
});
