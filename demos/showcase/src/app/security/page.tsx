/**
 * 暗号化(crypto)と権限判定(auth RBAC)のデモ。
 * サーバコンポーネントで基盤を直接呼び、結果を表示する。
 */
import { deriveKey, encrypt, decrypt } from "@platform/crypto";
import { can } from "@platform/auth";
import { policy } from "../../server/store.js";

export default function Page() {
  // --- 暗号化デモ ---
  const key = deriveKey("demo-secret-please-change-in-real-apps");
  const plaintext = "1234-5678-9012-3456";
  const encrypted = encrypt(plaintext, key);
  const decrypted = decrypt(encrypted, key);

  // --- RBAC デモ ---
  const cases: { role: string; perm: string }[] = [
    { role: "admin", perm: "inquiry:export" },
    { role: "staff", perm: "inquiry:export" },
    { role: "staff", perm: "inquiry:read" },
  ];

  const box = { border: "1px solid var(--color-border)", borderRadius: "var(--radius)",
    padding: "1rem", marginTop: "1rem", background: "#f8fafc" } as const;

  return (
    <main style={{ maxWidth: 680, margin: "3rem auto", padding: "0 1rem" }}>
      <h1 style={{ fontSize: "1.4rem", fontWeight: 700 }}>暗号化と権限(RBAC)</h1>

      <h2 style={{ fontSize: "1.1rem", fontWeight: 600, marginTop: "1.5rem" }}>暗号化(AES-256-GCM)</h2>
      <div style={box}>
        <div>平文: <code>{plaintext}</code></div>
        <div style={{ marginTop: ".5rem", wordBreak: "break-all" }}>暗号文: <code>{encrypted}</code></div>
        <div style={{ marginTop: ".5rem" }}>復号: <code>{decrypted}</code>
          {decrypted === plaintext && <span style={{ color: "var(--color-primary)" }}> ✓ 一致</span>}
        </div>
      </div>

      <h2 style={{ fontSize: "1.1rem", fontWeight: 600, marginTop: "1.5rem" }}>権限判定(RBAC)</h2>
      <div style={box}>
        {cases.map((c, i) => {
          const allowed = can(policy, [c.role], c.perm);
          return (
            <div key={i} style={{ padding: ".25rem 0" }}>
              <code>{c.role}</code> が <code>{c.perm}</code> を実行 →{" "}
              <span style={{ color: allowed ? "var(--color-primary)" : "var(--color-danger)" }}>
                {allowed ? "許可" : "拒否"}
              </span>
            </div>
          );
        })}
      </div>

      <p style={{ marginTop: "1.5rem" }}><a href="/">← 戻る</a></p>
    </main>
  );
}
