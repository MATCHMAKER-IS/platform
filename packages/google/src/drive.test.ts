import { describe, it, expect, vi } from "vitest";
import { createGoogleDriveClient } from "./drive";
function fake() {
  const calls: { url: string; method: string }[] = [];
  const fetchImpl = vi.fn(async (url: string, init?: RequestInit) => { calls.push({ url: String(url), method: init?.method ?? "GET" }); return new Response(JSON.stringify({ id: "f1", name: "x" }), { status: 200, headers: { "content-type": "application/json" } }); });
  return { fetchImpl: fetchImpl as unknown as typeof fetch, calls };
}
describe("google drive", () => {
  it("uploads via upload host and shares", async () => {
    const { fetchImpl, calls } = fake();
    const d = createGoogleDriveClient({ accessToken: "t", fetchImpl });
    await d.uploadFile({ name: "r.pdf", data: new Uint8Array([1]), mimeType: "application/pdf" });
    expect(calls[0]!.url).toContain("/upload/drive/v3/files");
    await d.shareFile("f1", { role: "reader", type: "user", emailAddress: "a@x.com" });
    expect(calls[1]!.url).toContain("/files/f1/permissions");
  });
});
