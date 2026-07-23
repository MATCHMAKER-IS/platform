import { describe, it, expect } from "vitest";
import { buildMicrosoftAuthUrl, createMicrosoftTokenManager } from "./oauth";
import { createMicrosoftGraphClient } from "./graph";

describe("buildMicrosoftAuthUrl", () => {
  it("自社テナントの認可 URL を作り、offline_access を付ける", () => {
    const url = buildMicrosoftAuthUrl({
      clientId: "cid", redirectUri: "https://app/cb", tenantId: "t-123", scope: ["User.Read"], state: "s1",
    });
    expect(url).toContain("/t-123/oauth2/v2.0/authorize");
    expect(url).toContain("offline_access");
    expect(url).toContain("state=s1");
  });
});

describe("createMicrosoftTokenManager", () => {
  it("同時に呼んでも更新は 1 回だけで、回転したトークンを通知する", async () => {
    let refreshes = 0;
    let saved: string | undefined;
    const fetchImpl = (async () => {
      refreshes += 1;
      return new Response(JSON.stringify({ access_token: `at${refreshes}`, expires_in: 3600, refresh_token: `rt${refreshes}` }), { status: 200 });
    }) as unknown as typeof fetch;

    const m = createMicrosoftTokenManager({
      clientId: "c", clientSecret: "s", tenantId: "t", refreshToken: "rt0",
      fetchImpl, onRefresh: (r) => { saved = r.refreshToken; },
    });
    await Promise.all([m.getAccessToken(), m.getAccessToken(), m.getAccessToken()]);
    expect(refreshes).toBe(1);
    expect(saved).toBe("rt1");
  });
});

describe("createMicrosoftGraphClient", () => {
  it("Graph の応答を型付きで返す", async () => {
    const fetchImpl = (async () =>
      new Response(JSON.stringify({ id: "u1", displayName: "山田", userPrincipalName: "y@ex.jp" }), { status: 200 })) as unknown as typeof fetch;
    const graph = createMicrosoftGraphClient(fetchImpl);
    await expect(graph.me()).resolves.toMatchObject({ displayName: "山田" });
  });

  it("失敗時は状態コードと本文を含めて投げる(原因を追えるようにする)", async () => {
    const fetchImpl = (async () => new Response("Insufficient privileges", { status: 403 })) as unknown as typeof fetch;
    const graph = createMicrosoftGraphClient(fetchImpl);
    await expect(graph.me()).rejects.toThrow(/403/);
  });
});
