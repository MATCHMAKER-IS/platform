import { describe, it, expect } from "vitest";
import { handleUpload, serveDownload } from "./index.js";
import { createStorage, createLocalStorage } from "@platform/storage";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

function makeReq(files: { name: string; type: string; content: string }[], field = "file") {
  const form = new FormData();
  for (const f of files) form.append(field, new File([f.content], f.name, { type: f.type }));
  return new Request("http://x/upload", { method: "POST", body: form });
}

describe("upload", () => {
  const storage = createStorage(createLocalStorage(mkdtempSync(join(tmpdir(), "up-"))));

  it("ファイルを保存しメタ情報を返す", async () => {
    const res = await handleUpload(makeReq([{ name: "a.txt", type: "text/plain", content: "hello" }]), { storage });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.value[0]?.name).toBe("a.txt");
      expect(res.value[0]?.size).toBe(5);
      expect(res.value[0]?.key).toMatch(/^uploads\//);
    }
  });

  it("サイズ超過は VALIDATION エラー", async () => {
    const res = await handleUpload(makeReq([{ name: "big.txt", type: "text/plain", content: "0123456789" }]), { storage, maxSizeBytes: 5 });
    expect(res.ok).toBe(false);
  });

  it("MIME 不許可は VALIDATION エラー", async () => {
    const res = await handleUpload(makeReq([{ name: "a.txt", type: "text/plain", content: "x" }]), { storage, allowedMimeTypes: ["image/"] });
    expect(res.ok).toBe(false);
  });

  it("serveDownload は添付ヘッダを付ける", () => {
    const r = serveDownload(new TextEncoder().encode("x"), { filename: "テスト.txt", contentType: "text/plain" });
    expect(r.headers.get("content-disposition")).toContain("attachment");
    expect(r.headers.get("content-type")).toBe("text/plain");
  });
});
