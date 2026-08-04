// ponytail: grade thresholds for the end-of-drill feedback.
function gradeFromAccuracy(acc) {
  if (acc >= 92) return 'S';
  if (acc >= 80) return 'A';
  if (acc >= 65) return 'B';
  if (acc >= 45) return 'C';
  return 'D';
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

assert(gradeFromAccuracy(100) === 'S', 'perfect should be S');
assert(gradeFromAccuracy(85) === 'A', '85 should be A');
assert(gradeFromAccuracy(70) === 'B', '70 should be B');
assert(gradeFromAccuracy(50) === 'C', '50 should be C');
assert(gradeFromAccuracy(10) === 'D', 'low should be D');

console.log('check-smash: ok');
