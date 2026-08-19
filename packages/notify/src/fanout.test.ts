import { describe, it, expect } from "vitest";
import { createMailChannel } from "./channels/mail";
import { notifyAllSettled, summarizeResults } from "./fanout";

describe("notify fanout", () => {
  it("per-channel results + summary", async () => {
    const ch = createMailChannel({ sendMail: async () => ({ ok: true }) }, { to: "a@x.jp", subject: "s" });
    const fail = { send: async () => { throw new Error("NG"); } };
    const results = await notifyAllSettled([{ name: "mail", channel: ch }, { name: "broken", channel: fail }], { text: "x" });
    expect(results.find((r) => r.name === "broken")).toMatchObject({ ok: false, error: "NG" });
    const sum = summarizeResults(results);
    // **完全一致では固定しない。** 2026-08 に `partial` / `allFailed` /
    // `failedChannels` を足したところ、**中身は正しいのにここだけ落ちた**。
    // 3 つの状態の区別は下の「一斉通知の結果は 3 通り」で確かめている。
    expect(sum).toMatchObject({ total: 2, succeeded: 1, failed: 1, allOk: false });
    // **一部失敗**であることも見る(全部失敗と混ざらないように)
    expect(sum.partial).toBe(true);
    expect(sum.failedChannels).toEqual(["broken"]);
  });
});

describe("一斉通知の結果は 3 通り", () => {
  const mk = (oks: boolean[]) => oks.map((ok, i) => ({ name: `ch${i}`, ok }));

  // **`allOk: false` は「一部失敗」と「全部失敗」を区別しない。**
  // 障害通知を 100 人に送って 3 人だけ失敗すると、**その 3 人は障害を知らない**
  // ——「送信した」記録は残るので後から気づくのが難しい(2026-08 に分離)
  it("一部だけ失敗を見分ける", () => {
    const r = summarizeResults(mk([true, false]));
    expect(r.partial).toBe(true);
    expect(r.allFailed).toBe(false);
    expect(r.failedChannels).toEqual(["ch1"]);
  });
  // **全部失敗は仕組み自体が壊れている**(即対応)
  it("全部失敗を見分ける", () => {
    const r = summarizeResults(mk([false, false]));
    expect(r.allFailed).toBe(true);
    expect(r.partial).toBe(false);
  });
  it("全部成功ならどちらも false", () => {
    const r = summarizeResults(mk([true, true]));
    expect(r.allOk).toBe(true);
    expect(r.partial).toBe(false);
    expect(r.allFailed).toBe(false);
  });
  // **空はどれでもない**(送る相手が居なかっただけ)
  it("空はどの状態にもしない", () => {
    const r = summarizeResults([]);
    expect(r.allOk).toBe(false);
    expect(r.allFailed).toBe(false);
  });
});
