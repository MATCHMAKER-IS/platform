import { describe, it, expect } from "vitest";
import {
  withinPeriod, ofType,
  pageViews, uniqueVisitors, uniqueUsers, topPages, referrerBreakdown, timeSeries, bounceRate, summarize,
  ensureSessionId, createBeacon,
  type AnalyticsEvent, type BeaconPayload,
} from "./index";

/** ページビューを 1 件作る。 */
const pv = (over: Partial<AnalyticsEvent> = {}): AnalyticsEvent => ({
  type: "pageview", path: "/", sessionId: "s1", at: "2026-07-29T03:00:00Z", ...over,
});

describe("絞り込み", () => {
  const events = [
    pv({ at: "2026-07-01T00:00:00Z" }),
    pv({ at: "2026-07-15T00:00:00Z" }),
    pv({ at: "2026-07-31T00:00:00Z" }),
  ];

  it("withinPeriod は**両端を含む**", () => {
    expect(withinPeriod(events, "2026-07-01T00:00:00Z", "2026-07-31T00:00:00Z").length).toBe(3);
    expect(withinPeriod(events, "2026-07-02T00:00:00Z").length).toBe(2);
    expect(withinPeriod(events, undefined, "2026-07-15T00:00:00Z").length).toBe(2);
  });

  it("withinPeriod は指定しなければ絞らない", () => {
    expect(withinPeriod(events).length).toBe(3);
  });

  it("ofType は種別で絞る", () => {
    const mixed = [pv(), { ...pv(), type: "click" as const }, { ...pv(), type: "custom" as const }];
    expect(ofType(mixed, "pageview").length).toBe(1);
    expect(ofType(mixed, "click").length).toBe(1);
  });
});

describe("基本の集計", () => {
  const events = [
    pv({ sessionId: "a", userId: "u1", path: "/x" }),
    pv({ sessionId: "a", userId: "u1", path: "/y" }),
    pv({ sessionId: "b", userId: "u2", path: "/x" }),
    pv({ sessionId: "c", path: "/x" }), // 未ログイン
    { ...pv({ sessionId: "d" }), type: "click" as const },
  ];

  it("pageViews は pageview だけ数える(click は含まない)", () => {
    expect(pageViews(events)).toBe(4);
  });

  it("uniqueVisitors は**種別を問わずセッション数**を数える", () => {
    // pageView は pageview だけ、uniqueVisitors は全種別。分母が揃わないので
    // 「PV ÷ UU」は素直に読めない(TSDoc に明記してある)
    expect(uniqueVisitors(events)).toBe(4); // click しかない d も含む
    expect(pageViews(events)).toBe(4);
  });

  it("uniqueUsers は**ログインユーザー数**(未ログインは数えない)", () => {
    // セッションとは意味が違う。こちらが本当の「人数」
    expect(uniqueUsers(events)).toBe(2);
  });

  it("空配列でも壊れない", () => {
    expect(pageViews([])).toBe(0);
    expect(uniqueVisitors([])).toBe(0);
    expect(uniqueUsers([])).toBe(0);
  });
});

describe("topPages", () => {
  const events = [
    pv({ path: "/a", sessionId: "s1" }),
    pv({ path: "/a", sessionId: "s1" }), // 同じセッションの再訪
    pv({ path: "/a", sessionId: "s2" }),
    pv({ path: "/b", sessionId: "s3" }),
  ];

  it("ビュー数の多い順に返す", () => {
    expect(topPages(events).map((p) => p.path)).toEqual(["/a", "/b"]);
    expect(topPages(events)[0]?.views).toBe(3);
  });

  it("**訪問者数はセッションのユニーク数**(同じ人の連続閲覧を 1 と数える)", () => {
    expect(topPages(events)[0]?.visitors).toBe(2);
  });

  it("同数ならパス順で安定する(実行のたびに順序が変わらない)", () => {
    const tie = [pv({ path: "/z" }), pv({ path: "/a" })];
    expect(topPages(tie).map((p) => p.path)).toEqual(["/a", "/z"]);
  });

  it("limit で件数を絞る", () => {
    expect(topPages(events, 1).length).toBe(1);
  });
});

describe("referrerBreakdown", () => {
  it("**referrer が無いものは direct** にまとめる", () => {
    const events = [pv({ referrer: "google.com" }), pv(), pv({ referrer: "" })];
    const rows = referrerBreakdown(events);
    expect(rows.find((r) => r.referrer === "direct")?.count).toBe(2);
  });

  it("件数の多い順に返す", () => {
    const events = [pv({ referrer: "a" }), pv({ referrer: "b" }), pv({ referrer: "b" })];
    expect(referrerBreakdown(events)[0]?.referrer).toBe("b");
  });

  it("同数なら名前順で安定する", () => {
    const events = [pv({ referrer: "z" }), pv({ referrer: "a" })];
    expect(referrerBreakdown(events).map((r) => r.referrer)).toEqual(["a", "z"]);
  });
});

describe("timeSeries(JST 基準)", () => {
  it("**JST の暦日で区切る**(UTC で切ると深夜のアクセスが前日に入る)", () => {
    // JST 2026-07-29 02:00 = UTC 2026-07-28 17:00
    const rows = timeSeries([pv({ at: "2026-07-28T17:00:00Z" })], "day");
    expect(rows[0]?.bucket).toBe("2026-07-29");
  });

  it("同じ JST 日のアクセスは 1 つのバケットにまとまる", () => {
    const rows = timeSeries([
      pv({ at: "2026-07-28T17:00:00Z", sessionId: "s1" }), // JST 7/29 02:00
      pv({ at: "2026-07-29T05:00:00Z", sessionId: "s2" }), // JST 7/29 14:00
    ], "day");
    expect(rows.length).toBe(1);
    expect(rows[0]?.views).toBe(2);
    expect(rows[0]?.visitors).toBe(2);
  });

  it("hour 単位でも JST で区切る", () => {
    expect(timeSeries([pv({ at: "2026-07-28T17:30:00Z" })], "hour")[0]?.bucket).toBe("2026-07-29T02:00");
  });

  it("時刻の昇順で返す(グラフにそのまま渡せる)", () => {
    const rows = timeSeries([
      pv({ at: "2026-07-30T03:00:00Z" }),
      pv({ at: "2026-07-28T03:00:00Z" }),
      pv({ at: "2026-07-29T03:00:00Z" }),
    ], "day");
    expect(rows.map((r) => r.bucket)).toEqual(["2026-07-28", "2026-07-29", "2026-07-30"]);
  });

  it("pageview 以外は数えない", () => {
    expect(timeSeries([{ ...pv(), type: "click" }], "day")).toEqual([]);
  });
});

describe("bounceRate", () => {
  it("1 ページだけ見たセッションの割合を返す", () => {
    const events = [
      pv({ sessionId: "a", path: "/1" }),
      pv({ sessionId: "a", path: "/2" }), // 直帰していない
      pv({ sessionId: "b", path: "/1" }), // 直帰
    ];
    expect(bounceRate(events)).toBeCloseTo(0.5);
  });

  it("全員が直帰なら 1、全員が回遊なら 0", () => {
    expect(bounceRate([pv({ sessionId: "a" }), pv({ sessionId: "b" })])).toBe(1);
    expect(bounceRate([pv({ sessionId: "a" }), pv({ sessionId: "a" })])).toBe(0);
  });

  it("セッションが無ければ 0(0 除算にしない)", () => {
    expect(bounceRate([])).toBe(0);
    expect(bounceRate([{ ...pv(), type: "click" }])).toBe(0);
  });
});

describe("summarize", () => {
  const events = [
    pv({ sessionId: "a", userId: "u1", path: "/x", referrer: "google.com" }),
    pv({ sessionId: "a", userId: "u1", path: "/y" }),
    pv({ sessionId: "b", path: "/x" }),
  ];

  it("ダッシュボードに必要な数字を一度に返す", () => {
    const s = summarize(events);
    expect(s.pageViews).toBe(3);
    expect(s.uniqueVisitors).toBe(2);
    expect(s.uniqueUsers).toBe(1);
    expect(s.topPages[0]?.path).toBe("/x");
    expect(s.referrers.length).toBeGreaterThan(0);
  });

  it("topN で一覧の件数を絞れる", () => {
    expect(summarize(events, { topN: 1 }).topPages.length).toBe(1);
  });

  it("空でも壊れない", () => {
    const s = summarize([]);
    expect(s.pageViews).toBe(0);
    expect(s.topPages).toEqual([]);
  });
});

describe("ensureSessionId", () => {
  it("既存の ID があればそれを使う", () => {
    expect(ensureSessionId("abc", () => "new")).toBe("abc");
  });

  it("無い・空なら新しく作る", () => {
    expect(ensureSessionId(null, () => "new")).toBe("new");
    expect(ensureSessionId(undefined, () => "new")).toBe("new");
    expect(ensureSessionId("", () => "new")).toBe("new");
  });
});

describe("createBeacon", () => {
  it("sendBeacon が使えればそれで送る", () => {
    const sent: string[] = [];
    const b = createBeacon({ sessionId: "s1", sendBeacon: (_u, body) => { sent.push(body); return true; } });
    b.pageview("/x");
    expect(sent.length).toBe(1);
    expect(JSON.parse(sent[0]!)).toMatchObject({ type: "pageview", path: "/x", sessionId: "s1" });
  });

  it("**sendBeacon が失敗したら fetch にフォールバックする**", () => {
    // ページ離脱時は sendBeacon が使えないことがある。落として計測を失わない
    const calls: string[] = [];
    const b = createBeacon({
      sessionId: "s1",
      sendBeacon: () => false,
      fetch: async (url) => { calls.push(url); return undefined; },
    });
    b.pageview("/x");
    expect(calls).toEqual(["/api/analytics"]);
  });

  it("送信先を変えられる", () => {
    const calls: string[] = [];
    const b = createBeacon({ sessionId: "s1", endpoint: "/collect", fetch: async (url) => { calls.push(url); return undefined; } });
    b.pageview("/x");
    expect(calls).toEqual(["/collect"]);
  });

  it("任意の項目は指定したときだけ載せる(空の項目を送らない)", () => {
    const sent: BeaconPayload[] = [];
    const b = createBeacon({ sessionId: "s1", sendBeacon: (_u, body) => { sent.push(JSON.parse(body)); return true; } });
    b.pageview("/x");
    expect("userId" in sent[0]!).toBe(false);
    b.pageview("/y", { userId: "u1", referrer: "google.com" });
    expect(sent[1]).toMatchObject({ userId: "u1", referrer: "google.com" });
  });

  it("送信手段が無ければ黙って何もしない(SSR で落ちない)", () => {
    const b = createBeacon({ sessionId: "s1" });
    expect(() => b.pageview("/x")).not.toThrow();
  });
});
