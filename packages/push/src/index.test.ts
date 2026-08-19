import { createECDH, randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  generateVapidKeys, buildVapidHeader, encryptPayload, sendPush, broadcastPush,
  isExpired, isValidSubscription, createPushChannel, type PushSubscription,
} from "./index";

const b64 = (b: Buffer) => b.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

function makeSub(n: number): PushSubscription {
  const e = createECDH("prime256v1");
  e.generateKeys();
  return { endpoint: `https://example.com/p/${n}`, keys: { p256dh: b64(e.getPublicKey()), auth: b64(randomBytes(16)) } };
}

describe("VAPID", () => {
  it("P-256 の鍵ができる", () => {
    const k = generateVapidKeys("mailto:x@example.jp");
    // 65 バイト(非圧縮の P-256 公開鍵)を Base64URL にすると 87 文字
    expect(k.publicKey).toHaveLength(87);
  });
  it("JWT が 3 部構成になる", () => {
    const k = generateVapidKeys("mailto:x@example.jp");
    const h = buildVapidHeader("https://fcm.googleapis.com/fcm/send/a", k);
    expect(h.split("t=")[1]?.split(",")[0]?.split(".")).toHaveLength(3);
  });
  // **送信先のドメインごとに作る**(`aud` が違うため使い回せない)
  it("送信先が違えば別の JWT になる", () => {
    const k = generateVapidKeys("mailto:x@example.jp");
    const a = buildVapidHeader("https://fcm.googleapis.com/x", k);
    const b = buildVapidHeader("https://updates.push.services.mozilla.com/x", k);
    expect(a).not.toBe(b);
  });
});

describe("暗号化", () => {
  it("ヘッダ + 鍵 + 本文の形になる", () => {
    const enc = encryptPayload("{}", makeSub(1));
    // salt(16) + レコード長(4) + 鍵長(1) + 公開鍵(65) + 本文
    expect(enc.length).toBeGreaterThan(86);
    expect(enc[20]).toBe(65);
  });
  // **送るたびに新しい鍵**(使い回すと過去の通知も復号されうる)
  it("同じ内容でも毎回違う暗号文になる", () => {
    const sub = makeSub(1);
    expect(encryptPayload("{}", sub).equals(encryptPayload("{}", sub))).toBe(false);
  });
});

describe("送信", () => {
  const vapid = generateVapidKeys("mailto:x@example.jp");

  it("成功を返す", async () => {
    const r = await sendPush(makeSub(1), { title: "t" }, {
      vapid, fetchImpl: async () => ({ ok: true, status: 201 }) as Response,
    });
    expect(r.ok).toBe(true);
  });
  // **404 / 410 は「もう届かない」**(異常ではない。日常的に起きる)
  it("410 は gone になる", async () => {
    const r = await sendPush(makeSub(1), { title: "t" }, {
      vapid, fetchImpl: async () => ({ ok: false, status: 410 }) as Response,
    });
    expect(r.gone).toBe(true);
  });
  // **ネットワークの失敗は再試行の対象**(`gone` にしない)
  it("通信できなくても例外を投げない", async () => {
    const r = await sendPush(makeSub(1), { title: "t" }, {
      vapid, fetchImpl: async () => { throw new Error("切断"); },
    });
    expect(r.ok).toBe(false);
    expect(r.gone).toBe(false);
  });
  it("TTL と緊急度を送る", async () => {
    let headers: Record<string, string> = {};
    await sendPush(makeSub(1), { title: "t" }, {
      vapid, ttlSeconds: 60, urgency: "high",
      fetchImpl: async (_u, init) => { headers = (init as RequestInit).headers as Record<string, string>; return { ok: true, status: 201 } as Response; },
    });
    expect(headers.TTL).toBe("60");
    expect(headers.Urgency).toBe("high");
  });
});

describe("一斉送信", () => {
  const vapid = generateVapidKeys("mailto:x@example.jp");
  // **1 人の購読が切れていても、他の人には届く**
  it("失敗しても止まらず、消すべき購読を返す", async () => {
    const r = await broadcastPush([makeSub(1), makeSub(2), makeSub(3)], { title: "t" }, {
      vapid,
      fetchImpl: async (u) => (String(u).endsWith("2")
        ? { ok: false, status: 410 } as Response
        : { ok: true, status: 201 } as Response),
    });
    expect(r.sent).toBe(2);
    expect(r.failed).toBe(1);
    expect(r.gone).toEqual(["https://example.com/p/2"]);
  });
});

describe("購読の検証", () => {
  it("妥当な購読を通す", () => {
    expect(isValidSubscription(makeSub(1))).toBe(true);
  });
  // **`https:` だけを受ける**(混ざるなら細工を疑う)
  it("http は弾く", () => {
    expect(isValidSubscription({ ...makeSub(1), endpoint: "http://x/p" })).toBe(false);
  });
  // **鍵が欠けた購読**を保存すると、送信時に毎回落ちる
  it("鍵が欠けていれば弾く", () => {
    expect(isValidSubscription({ endpoint: "https://x/p", keys: {} })).toBe(false);
  });
  it("null や文字列は弾く", () => {
    expect(isValidSubscription(null)).toBe(false);
    expect(isValidSubscription("sub")).toBe(false);
  });
});

describe("期限", () => {
  it("過ぎていれば true", () => {
    const s = { ...makeSub(1), expirationTime: 1000 };
    expect(isExpired(s, new Date(2000))).toBe(true);
  });
  // **`expirationTime` を返さないブラウザもある**(その場合は期限なし)
  it("期限が無ければ false", () => {
    expect(isExpired(makeSub(1), new Date())).toBe(false);
  });
});

describe("通知チャネル", () => {
  it("無効な購読をその場で消す", async () => {
    const removed: string[] = [];
    const ch = createPushChannel(
      async () => [makeSub(1), makeSub(2)],
      async (e) => { removed.push(e); },
      { vapid: generateVapidKeys("mailto:x@example.jp"),
        fetchImpl: async (u) => (String(u).endsWith("2")
          ? { ok: false, status: 404 } as Response
          : { ok: true, status: 201 } as Response) },
    );
    await ch.send({ text: "テスト" });
    expect(removed).toEqual(["https://example.com/p/2"]);
  });
});
