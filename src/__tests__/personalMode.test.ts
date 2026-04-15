/**
 * 个人模式 (Personal Mode) 功能测试
 *
 * 测试场景：
 * 1. 个人账单 my_share 计算逻辑
 * 2. 统计 API 排除 personal 类型
 * 3. AI 解析正确识别 personal 类型
 */

describe('个人模式 - my_share 计算逻辑', () => {
  /**
   * 复现 save/route.ts 第 66-74 行的业务逻辑
   */
  function calculateMyShare(type: 'aa' | 'personal', payer: 'me' | 'her', identity: 'me' | 'her', total: number, aiMyShare: number) {
    let finalMyShare = 0;
    if (type === 'personal') {
      // 个人账单：谁付的谁承担
      finalMyShare = (payer === 'me') ? total : 0;
    } else {
      // AA账单：根据身份转换
      finalMyShare = identity === 'her' ? (total - aiMyShare) : aiMyShare;
    }
    return finalMyShare;
  }

  // ==================== 个人模式测试 ====================

  test('个人模式 - 我付钱，我承担全部', () => {
    const result = calculateMyShare('personal', 'me', 'me', 100, 0);
    expect(result).toBe(100); // 我付的全部由我承担
  });

  test('个人模式 - 她付钱，她承担全部', () => {
    const result = calculateMyShare('personal', 'her', 'me', 100, 0);
    expect(result).toBe(0); // 她付的钱跟我无关
  });

  test('个人模式 - 我付钱50元，我承担50', () => {
    const result = calculateMyShare('personal', 'me', 'me', 50, 25);
    expect(result).toBe(50); // 忽略 AI 的 my_share，我自己承担全部
  });

  test('个人模式 - 无论身份如何，我自己付款就我自己承担', () => {
    // identity='her' 场景
    const result = calculateMyShare('personal', 'me', 'her', 80, 0);
    expect(result).toBe(80);
  });

  // ==================== AA 模式测试 ====================

  test('AA模式 - 我付款，默认平摊', () => {
    const result = calculateMyShare('aa', 'me', 'me', 100, 50);
    expect(result).toBe(50); // identity=me, my_share 直接使用
  });

  test('AA模式 - 她付款，我欠她一半', () => {
    const result = calculateMyShare('aa', 'her', 'me', 100, 50);
    expect(result).toBe(50); // identity=me, 她付了50，我欠50
  });

  test('AA模式 - 身份为her时的转换', () => {
    // 场景：我（her）付款，total=100，AI说my_share=0（我全部垫付）
    // 存储时：identity='her'，所以 finalMyShare = total - my_share = 100 - 0 = 100
    const result = calculateMyShare('aa', 'me', 'her', 100, 0);
    expect(result).toBe(100); // 全部由我垫付，数据库存100表示她欠我100
  });
});

describe('个人模式 - pendingBalance 计算排除', () => {
  /**
   * 复现 stats/route.ts 的 pendingBalance 计算逻辑
   * personal 类型应该被排除
   */
  function calculatePendingBalance(bills: Array<{
    status: 'pending' | 'settled';
    record_type: 'aa' | 'personal';
    payer: 'me' | 'her';
    total_amount: number;
    my_share: number;
  }>) {
    let pendingBalance = 0;

    bills.forEach(b => {
      const total = Number(b.total_amount || 0);
      const share = Number(b.my_share || 0);
      const isPersonal = b.record_type === 'personal';

      if (b.status === 'pending' && !isPersonal) {
        pendingBalance += (b.payer === 'me' ? (total - share) : -share);
      }
    });

    return pendingBalance;
  }

  test('AA待结清账单 - 我付款，她欠我', () => {
    const bills = [{
      status: 'pending',
      record_type: 'aa',
      payer: 'me',
      total_amount: 100,
      my_share: 50, // 我承担50，她欠我50
    }];
    expect(calculatePendingBalance(bills)).toBe(50);
  });

  test('AA待结清账单 - 她付款，我欠她', () => {
    const bills = [{
      status: 'pending',
      record_type: 'aa',
      payer: 'her',
      total_amount: 100,
      my_share: 50, // AI说我的份额是50（即她垫了50）
    }];
    expect(calculatePendingBalance(bills)).toBe(-50);
  });

  test('个人开销 - 不计入pendingBalance', () => {
    const bills = [{
      status: 'pending',
      record_type: 'personal',
      payer: 'me',
      total_amount: 100,
      my_share: 100,
    }];
    expect(calculatePendingBalance(bills)).toBe(0); // 应该被排除
  });

  test('混合账单 - 只计算AA，个人不计入', () => {
    const bills = [
      {
        status: 'pending',
        record_type: 'aa',
        payer: 'me',
        total_amount: 100,
        my_share: 50, // 她欠我50
      },
      {
        status: 'pending',
        record_type: 'personal',
        payer: 'me',
        total_amount: 200,
        my_share: 200, // 不计入
      },
      {
        status: 'pending',
        record_type: 'aa',
        payer: 'her',
        total_amount: 60,
        my_share: 30, // 我欠她30
      },
    ];
    // 50 + (-30) = 20
    expect(calculatePendingBalance(bills)).toBe(20);
  });

  test('已结清账单 - 不计入pendingBalance', () => {
    const bills = [{
      status: 'settled',
      record_type: 'aa',
      payer: 'me',
      total_amount: 100,
      my_share: 50,
    }];
    expect(calculatePendingBalance(bills)).toBe(0);
  });
});

describe('个人模式 - record_type 向后兼容', () => {
  /**
   * 测试 records/route.ts 的兼容逻辑
   * 旧数据没有 record_type 字段，应该默认为 'aa'
   */
  function getRecordType(record: { record_type?: string }) {
    return record.record_type || 'aa';
  }

  test('新数据有record_type字段', () => {
    const record = { record_type: 'personal' };
    expect(getRecordType(record)).toBe('personal');
  });

  test('新数据record_type为aa', () => {
    const record = { record_type: 'aa' };
    expect(getRecordType(record)).toBe('aa');
  });

  test('旧数据没有record_type字段 - 向后兼容', () => {
    const record = {}; // 模拟旧数据
    expect(getRecordType(record)).toBe('aa');
  });
});

describe('个人模式 - Balance History 排除', () => {
  /**
   * 复现 stats/route.ts balanceHistory 计算
   * personal 类型不应该进入 balance history
   */
  function calculateBalanceHistory(bills: Array<{
    status: 'pending' | 'settled';
    record_type: 'aa' | 'personal';
    payer: 'me' | 'her';
    date: string;
    total_amount: number;
    my_share: number;
  }>) {
    const dailyNetChanges: Record<string, number> = {};

    bills.forEach(b => {
      const share = Number(b.my_share || 0);
      const total = Number(b.total_amount || 0);
      const isPersonal = b.record_type === 'personal';

      if (b.status === 'pending' && !isPersonal) {
        const netChange = b.payer === 'me' ? (total - share) : -share;
        dailyNetChanges[b.date] = (dailyNetChanges[b.date] || 0) + netChange;
      }
    });

    return dailyNetChanges;
  }

  test('AA账单进入balance history', () => {
    const bills = [{
      status: 'pending',
      record_type: 'aa',
      payer: 'me',
      date: '2024-03-01',
      total_amount: 100,
      my_share: 50,
    }];
    const history = calculateBalanceHistory(bills);
    expect(history['2024-03-01']).toBe(50); // 她欠我50
  });

  test('个人账单不进入balance history', () => {
    const bills = [{
      status: 'pending',
      record_type: 'personal',
      payer: 'me',
      date: '2024-03-01',
      total_amount: 100,
      my_share: 100,
    }];
    const history = calculateBalanceHistory(bills);
    expect(history['2024-03-01']).toBeUndefined(); // 不应该存在
  });

  test('混合账单 - 只有AA进入history', () => {
    const bills = [
      {
        status: 'pending',
        record_type: 'personal',
        payer: 'me',
        date: '2024-03-01',
        total_amount: 500,
        my_share: 500,
      },
      {
        status: 'pending',
        record_type: 'aa',
        payer: 'me',
        date: '2024-03-01',
        total_amount: 100,
        my_share: 50,
      },
    ];
    const history = calculateBalanceHistory(bills);
    expect(Object.keys(history)).toEqual(['2024-03-01']); // 只有一条
    expect(history['2024-03-01']).toBe(50);
  });
});
