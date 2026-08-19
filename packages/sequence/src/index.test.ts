import { describe, it, expect } from "vitest";
import { createSequencer, createMemorySequenceStore, periodToken } from "./index";
describe("sequence", () => {
  it("pads and prefixes", async () => {
    const s = createSequencer(createMemorySequenceStore(), "inv", { prefix: "INV-", padding: 6 });
    expect(await s.next()).toBe("INV-000001");
    expect(await s.next()).toBe("INV-000002");
  });
  it("resets yearly and fiscally", async () => {
    const y = createSequencer(createMemorySequenceStore(), "o", { padding: 4, resetPeriod: "yearly" });
    expect(await y.next(new Date("2024-06-01"))).toBe("2024-0001");
    expect(await y.next(new Date("2025-01-05"))).toBe("2025-0001");
    const f = createSequencer(createMemorySequenceStore(), "s", { resetPeriod: "fiscalYearly", padding: 3 });
    expect(await f.next(new Date("2025-03-31"))).toBe("FY2024-001");
    expect(await f.next(new Date("2025-04-01"))).toBe("FY2025-001");
  });
});

describe("periodToken: サーバのタイムゾーンに依存しない", () => {
  // **UTC で動くサーバ(クラウドの既定)で壊れる形。**
  // JST 8/1 00:30 は UTC ではまだ 7/31 なので、修正前は 7 月の連番が払い出されていた。
  // 昼間に試すと必ず通るため、深夜の申請でだけ起きて気づけない(2026-08 に修正)。
  it("JST の月初深夜でも当月になる", () => {
    expect(periodToken("monthly", new Date("2026-07-31T15:30:00Z"), 4)).toBe("202608");
  });
  // **年またぎは 1 年ずれる。** 影響が 12 か月続くので月次より重い
  it("JST の年始深夜でも当年になる", () => {
    expect(periodToken("yearly", new Date("2025-12-31T15:10:00Z"), 4)).toBe("2026");
  });
  // **年度も JST 基準。** 3/31 深夜の申請が前年度に落ちない
  it("年度の切り替わりも JST 基準", () => {
    expect(periodToken("fiscalYearly", new Date("2026-03-31T15:30:00Z"), 4)).toBe("FY2026");
  });
});

describe("桁あふれを黙って通さない", () => {
  const mk = (o: Record<string, unknown>) => createSequencer(createMemorySequenceStore(), "x", o);

  // **番号の長さが変わると固定長を前提にした処理が壊れる。**
  // 全銀ファイルや CSV の桁揃えが崩れ、DB の varchar で切れ、
  // 文字列ソートで順序が狂う(`"100" < "99"`)(2026-08 に対処)
  it("padding を超えたら例外", async () => {
    const s = mk({ padding: 2 });
    for (let i = 0; i < 99; i += 1) await s.next(new Date());
    await expect(s.next(new Date())).rejects.toThrow();
  });
  // **境界は通る**(2 桁ちょうど)
  it("桁ちょうどは通る", async () => {
    const s = mk({ padding: 2 });
    let last = "";
    for (let i = 0; i < 99; i += 1) last = await s.next(new Date());
    expect(last).toBe("99");
  });
  // **明示的に許可できる**(固定長を前提にしない用途)
  it("allowOverflow なら伸びる", async () => {
    const s = mk({ padding: 2, allowOverflow: true });
    let last = "";
    for (let i = 0; i < 100; i += 1) last = await s.next(new Date());
    expect(last).toBe("100");
  });
  // **padding 無しは従来どおり**
  it("padding を指定しなければ制限しない", async () => {
    const s = mk({});
    let last = "";
    for (let i = 0; i < 100; i += 1) last = await s.next(new Date());
    expect(last).toBe("100");
  });
});
