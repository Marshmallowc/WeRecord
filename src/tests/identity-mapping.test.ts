import { calculateDbMyShare } from '../lib/agents/skills/billing';

// identity-mapping.test.ts
// 这是一个模拟 save/route.ts / billing.ts 中 resolveIdentity 逻辑和新 calculateDbMyShare 逻辑的单元测试集

const testCases = [
  // --- 原有 AA 分摊逻辑测试 ---
  {
    name: "TC-01: 男方发话 - 我支付了 24 元 (AA)",
    identity: "me",
    ai_result: { payer: "me", split_type: "average", total: 24, my_share: 12 },
    expected_db: { payer: "me", my_share: 12 }
  },
  {
    name: "TC-02: 女方发话 - 我支付了 24 元 (AA) [翻转校验]",
    identity: "her",
    ai_result: { payer: "me", split_type: "average", total: 24, my_share: 12 },
    expected_db: { payer: "her", my_share: 12 }
  },
  {
    name: "TC-03: 女方发话 - 他付了24块，但我请 (即我负责全部，女方发话的 partner_all)",
    identity: "her",
    ai_result: { payer: "her", split_type: "partner_all", total: 24, my_share: 24 },
    expected_db: { payer: "me", my_share: 0 }
  },

  // --- 新增：请客 (payer_all) 场景 ---
  {
    name: "TC-04: 女方发话 - 我请他吃花 80.5 元 (AI 正常返回 my_share)",
    identity: "her",
    ai_result: { payer: "me", split_type: "payer_all", total: 80.5, my_share: 80.5 },
    expected_db: { payer: "her", my_share: 0 }
  },
  {
    name: "TC-05: [边界防御] 女方发话 - 我请他吃花 80.5 元 (AI 错误返回 my_share: 0)",
    identity: "her",
    ai_result: { payer: "me", split_type: "payer_all", total: 80.5, my_share: 0 },
    expected_db: { payer: "her", my_share: 0 } // 后端需靠 split_type 防御性纠正为 0
  },
  {
    name: "TC-06: 女方发话 - 他请我喝饮料 14 元 (AI 正常返回 my_share)",
    identity: "her",
    ai_result: { payer: "her", split_type: "payer_all", total: 14, my_share: 0 },
    expected_db: { payer: "me", my_share: 14 }
  },
  {
    name: "TC-07: [边界防御] 女方发话 - 他请我喝饮料 14 元 (AI 错误返回 my_share: 14)",
    identity: "her",
    ai_result: { payer: "her", split_type: "payer_all", total: 14, my_share: 14 },
    expected_db: { payer: "me", my_share: 14 } // 后端需靠 split_type 防御性纠正为 14
  },
  {
    name: "TC-08: 男方发话 - 我请她吃饭 100 元 (payer_all)",
    identity: "me",
    ai_result: { payer: "me", split_type: "payer_all", total: 100, my_share: 100 },
    expected_db: { payer: "me", my_share: 100 }
  },
  {
    name: "TC-09: [边界防御] 男方发话 - 我请她吃饭 100 元 (AI 错误返回 my_share: 0)",
    identity: "me",
    ai_result: { payer: "me", split_type: "payer_all", total: 100, my_share: 0 },
    expected_db: { payer: "me", my_share: 100 } // 防御纠正
  },
  {
    name: "TC-10: 男方发话 - 她请我喝奶茶 20 元 (payer_all)",
    identity: "me",
    ai_result: { payer: "her", split_type: "payer_all", total: 20, my_share: 0 },
    expected_db: { payer: "her", my_share: 0 }
  },

  // --- 新增：代付垫付 (partner_all) 场景 ---
  {
    name: "TC-11: 男方发话 - 我帮她垫付了 50 元 (她应全额承担)",
    identity: "me",
    ai_result: { payer: "me", split_type: "partner_all", total: 50, my_share: 0 },
    expected_db: { payer: "me", my_share: 0 }
  },
  {
    name: "TC-12: [边界防御] 男方发话 - 我帮她垫付了 50 元 (AI 错误返回 my_share: 50)",
    identity: "me",
    ai_result: { payer: "me", split_type: "partner_all", total: 50, my_share: 50 },
    expected_db: { payer: "me", my_share: 0 } // 防御纠正
  },
  {
    name: "TC-13: 女方发话 - 他帮我垫付了 50 元 (我应全额承担)",
    identity: "her",
    ai_result: { payer: "her", split_type: "partner_all", total: 50, my_share: 50 },
    expected_db: { payer: "me", my_share: 0 }
  },
  {
    name: "TC-14: [边界防御] 女方发话 - 他帮我垫付了 50 元 (AI 错误返回 my_share: 0)",
    identity: "her",
    ai_result: { payer: "her", split_type: "partner_all", total: 50, my_share: 0 },
    expected_db: { payer: "me", my_share: 0 } // 防御纠正
  }
];

function resolveIdentity(val: string, identity: string) {
  if (identity !== 'her') return val;
  if (val === 'me') return 'her';
  if (val === 'her') return 'me';
  return val;
}

console.log("\n🚀 Starting WeRecord Identity Mapping & Split Calculation Test Suite...\n");
console.log("----------------------------------------------------------");

let passed = 0;

testCases.forEach((tc, index) => {
  console.log(`[Test ${String(index + 1).padStart(2, '0')}] ${tc.name}`);
  
  const dbPayer = resolveIdentity(tc.ai_result.payer, tc.identity) as 'me' | 'her';
  const dbMyShare = calculateDbMyShare({
    splitType: (tc.ai_result.split_type ?? 'average') as 'average' | 'payer_all' | 'partner_all' | 'custom',
    total: tc.ai_result.total ?? 0,
    aiMyShare: tc.ai_result.my_share ?? 0,
    dbPayer,
    identity: tc.identity as 'me' | 'her'
  });

  const actual_db = {
    payer: dbPayer,
    my_share: dbMyShare
  };

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
  console.log("✨ ALL TESTS PASSED. The identity mapping and split logic is robust. ✨\n");
} else {
  console.log("⚠️ Some tests failed. Investigation required.\n");
  process.exit(1);
}
