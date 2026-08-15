// tests.js - TDD test suite for Idle Skill Tree
// Run with: node tests.js

// --- Simple assertion helpers ---
let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${message}`);
  } else {
    failed++;
    console.error(`  ✗ FAIL: ${message}`);
  }
}

function assertEq(actual, expected, message) {
  assert(actual === expected, `${message} (got ${actual}, expected ${expected})`);
}

function assertNear(actual, expected, epsilon, message) {
  assert(Math.abs(actual - expected) < epsilon, `${message} (got ${actual}, expected ${expected} ±${epsilon})`);
}

// --- Inline game logic for testing ---
// (In production, this would come from game.js)

function getMeditationCost(level) {
  return Math.pow(2, level);
}

function getFocusedMindCost(level) {
  return Math.pow(3, level) + 1;
}

function getResonanceCost(level) {
  return Math.pow(3, level) + 1;
}

function getWillpowerCost(level) {
  return Math.pow(3, level) + 1;
}

function getArcaneFlowCost(level) {
  return Math.pow(5, level) + 1;
}

function getTranscendenceCost(level) {
  return Math.pow(8, level) + 1;
}

function getXPToLevelUp(level) {
  return 100 * level;
}

function getMeditationXPPerSecond(meditationLevel, focusedMindLevel) {
  const base = 10 * meditationLevel;
  const multiplier = 1 + focusedMindLevel * 0.5;
  return base * multiplier;
}

function getClickXP(clickLevel, willpowerLevel, arcaneFlowLevel) {
  const base = 10 + clickLevel * 5;
  const willpowerMult = 1 + willpowerLevel * 0.5;
  const arcaneFlat = arcaneFlowLevel * 5;
  return Math.floor(base * willpowerMult) + arcaneFlat;
}

function getResonanceDiscount(resonanceLevel) {
  return resonanceLevel * 0.05; // 5% per level
}

// --- Test Suites ---

console.log("\n=== Skill Tree Tests ===\n");

// --- Meditation cost scaling (2^level) ---
console.log("--- Meditation Cost ---");
assertEq(getMeditationCost(1), 2, "Level 1 cost = 2");
assertEq(getMeditationCost(2), 4, "Level 2 cost = 4");
assertEq(getMeditationCost(3), 8, "Level 3 cost = 8");
assertEq(getMeditationCost(5), 32, "Level 5 cost = 32");
assertEq(getMeditationCost(10), 1024, "Level 10 cost = 1024");

// --- Focused Mind cost scaling (3^level + 1) ---
console.log("\n--- Focused Mind Cost ---");
assertEq(getFocusedMindCost(1), 4, "Level 1 cost = 4");
assertEq(getFocusedMindCost(2), 10, "Level 2 cost = 10");
assertEq(getFocusedMindCost(3), 28, "Level 3 cost = 28");
assertEq(getFocusedMindCost(5), 244, "Level 5 cost = 244");

// --- Resonance cost scaling (3^level + 1) ---
console.log("\n--- Resonance Cost ---");
assertEq(getResonanceCost(1), 4, "Level 1 cost = 4");
assertEq(getResonanceCost(2), 10, "Level 2 cost = 10");

// --- Willpower cost scaling (3^level + 1) ---
console.log("\n--- Willpower Cost ---");
assertEq(getWillpowerCost(1), 4, "Level 1 cost = 4");
assertEq(getWillpowerCost(3), 28, "Level 3 cost = 28");

// --- Arcane Flow cost scaling (5^level + 1) ---
console.log("\n--- Arcane Flow Cost ---");
assertEq(getArcaneFlowCost(1), 6, "Level 1 cost = 6");
assertEq(getArcaneFlowCost(2), 26, "Level 2 cost = 26");
assertEq(getArcaneFlowCost(3), 126, "Level 3 cost = 126");

// --- Transcendence cost scaling (8^level + 1) ---
console.log("\n--- Transcendence Cost ---");
assertEq(getTranscendenceCost(1), 9, "Level 1 cost = 9");
assertEq(getTranscendenceCost(2), 65, "Level 2 cost = 65");
assertEq(getTranscendenceCost(3), 513, "Level 3 cost = 513");

// --- XP to level up ---
console.log("\n--- XP to Level Up ---");
assertEq(getXPToLevelUp(1), 100, "Level 1 needs 100 XP");
assertEq(getXPToLevelUp(2), 200, "Level 2 needs 200 XP");
assertEq(getXPToLevelUp(5), 500, "Level 5 needs 500 XP");
assertEq(getXPToLevelUp(10), 1000, "Level 10 needs 1000 XP");

// --- Meditation XP/s ---
console.log("\n--- Meditation XP/s ---");
assertEq(getMeditationXPPerSecond(1, 0), 10, "1 med, 0 focus = 10");
assertEq(getMeditationXPPerSecond(2, 0), 20, "2 med, 0 focus = 20");
assertEq(getMeditationXPPerSecond(1, 1), 15, "1 med, 1 focus = 15");
assertEq(getMeditationXPPerSecond(2, 1), 30, "2 med, 1 focus = 30");
assertEq(getMeditationXPPerSecond(3, 2), 60, "3 med, 2 focus = 60");

// --- Click XP ---
console.log("\n--- Click XP ---");
assertEq(getClickXP(0, 0, 0), 10, "Base click = 10");
assertEq(getClickXP(1, 0, 0), 15, "Click level 1 = 15");
assertEq(getClickXP(0, 1, 0), 15, "Willpower 1 = 15");
assertEq(getClickXP(0, 2, 0), 20, "Willpower 2 = 20");
assertEq(getClickXP(0, 0, 1), 15, "Arcane 1 = 15");
assertEq(getClickXP(1, 1, 1), 27, "All at 1 = 27 (15 * 1.5 = 22 + 5)");

// --- Resonance discount ---
console.log("\n--- Resonance Discount ---");
assertEq(getResonanceDiscount(0), 0, "No discount at level 0");
assertEq(getResonanceDiscount(1), 0.05, "5% at level 1");
assertEq(getResonanceDiscount(2), 0.10, "10% at level 2");
assertEq(getResonanceDiscount(10), 0.50, "50% at level 10");

// --- Summary ---
console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
if (failed > 0) {
  process.exit(1);
}
