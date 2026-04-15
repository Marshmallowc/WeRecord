
// identity-mapping.test.js

const testCases = [
  {
    name: "TC-01: 男方发话 - 我支付了 24 元 (AA)",
    identity: "me",
    ai_result: { payer: "me", total: 24, my_share: 12 },
    expected_db: { payer: "me", my_share: 12 }
  },
  {
    name: "TC-02: 女方发话 - 我支付了 24 元 (AA)",
    identity: "her",
    ai_result: { payer: "me", total: 24, my_share: 12 },
    expected_db: { payer: "her", my_share: 12 }
  },
  {
    name: "TC-03: 女方发话 - 我送了他一个礼物",
    identity: "her",
    ai_result: { from: "me", to: "her" },
    expected_db: { from_user: "her", to_user: "me" }
  },
  {
    name: "TC-04: 女方发话 - 他付了24块，但我请 (即我负责全部)",
    identity: "her",
    ai_result: { payer: "her", total: 24, my_share: 24 },
    expected_db: { payer: "me", my_share: 0 }
  }
];

function resolve(val, identity) {
  if (identity !== 'her') return val;
  if (val === 'me') return 'her';
  if (val === 'her') return 'me';
  return val;
}

console.log("\n🚀 Starting WeRecord Identity Mapping Logic Test Suite...\n");
console.log("----------------------------------------------------------");

let passed = 0;

testCases.forEach((tc, index) => {
  console.log(`[Test ${index + 1}] ${tc.name}`);
  
  let actual_db = {};
  
  if (tc.ai_result.payer) {
    actual_db.payer = resolve(tc.ai_result.payer, tc.identity);
    if (tc.ai_result.my_share !== undefined) {
      actual_db.my_share = tc.identity === 'her' ? (tc.ai_result.total - tc.ai_result.my_share) : tc.ai_result.my_share;
    }
  } else if (tc.ai_result.from) {
    actual_db.from_user = resolve(tc.ai_result.from, tc.identity);
    actual_db.to_user = resolve(tc.ai_result.to, tc.identity);
  }

  const isMatch = JSON.stringify(actual_db) === JSON.stringify(tc.expected_db);
  
  if (isMatch) {
    console.log("✅ PASS");
    passed++;
  } else {
    console.log("❌ FAIL");
    console.log(`   Expect: ${JSON.stringify(tc.expected_db)}`);
    console.log(`   Actual: ${JSON.stringify(actual_db)}`);
  }
  console.log("----------------------------------------------------------");
});

console.log(`\n📊 Final Result: ${passed}/${testCases.length} Passed`);
if (passed === testCases.length) {
  console.log("✨ ALL TESTS PASSED. ✨\n");
} else {
  console.log("⚠️ Some tests failed.\n");
  process.exit(1);
}
