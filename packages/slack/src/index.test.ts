import { describe, it, expect } from "vitest";
import { createHmac } from "node:crypto";
import { createSlackClient, verifySlackSignature, parseSlashCommand } from "./index";

const okFetch = (async () => new Response(JSON.stringify({ ok: true, channel: "C1", ts: "1.1" }), { status: 200 })) as unknown as typeof fetch;
const ngFetch = (async () => new Response(JSON.stringify({ ok: false, error: "channel_not_found" }), { status: 200 })) as unknown as typeof fetch;

describe("createSlackClient", () => {
  it("投稿すると channel と ts を返す(スレッド返信に使う)", async () => {
    const r = await createSlackClient("xoxb-x", okFetch).postMessage({ channel: "#a", text: "t" });
    expect(r).toEqual({ channel: "C1", ts: "1.1" });
  });

  it("HTTP 200 でも ok:false は失敗として扱う", async () => {
    await expect(createSlackClient("x", ngFetch).postMessage({ channel: "#a", text: "t" }))
      .rejects.toThrow(/channel_not_found/);
  });
});

describe("verifySlackSignature", () => {
  const secret = "sig-secret";
  const body = "token=x&command=/deploy";
  const timestamp = "1700000000";
  const signature = `v0=${createHmac("sha256", secret).update(`v0:${timestamp}:${body}`).digest("hex")}`;
  const now = () => 1_700_000_010;

  it("正しい署名は通る", () => {
    expect(verifySlackSignature({ body, signature, timestamp, signingSecret: secret, now })).toBe(true);
  });

  it("ボディが変わると通らない", () => {
    expect(verifySlackSignature({ body: `${body}x`, signature, timestamp, signingSecret: secret, now })).toBe(false);
  });

  it("古い要求は通らない(使い回しを防ぐ)", () => {
    expect(verifySlackSignature({ body, signature, timestamp, signingSecret: secret, now: () => 1_700_003_600 })).toBe(false);
  });
});

describe("parseSlashCommand", () => {
  it("生ボディからコマンドを取り出す", () => {
    expect(parseSlashCommand("command=%2Fdeploy&text=prod&user_id=U1").command).toBe("/deploy");
  });
});
