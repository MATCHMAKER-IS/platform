/**
 * 暗号化・パスワード・権限(RBAC)・セキュリティヘッダーのデモ。
 *
 * Server Component なので、基盤の関数を**その場で実行**して結果を表示している
 * （画面に出ている値は、すべてこのページを開いた瞬間に計算されたもの）。
 */
import { deriveKey, encrypt, decrypt, hashPassword, verifyPassword, passwordStrength, randomToken } from "@platform/crypto";
import { can } from "@platform/auth";
import { securityHeaders } from "@platform/security";
import { policy } from "../../server/store";

const box: React.CSSProperties = { border: "1px solid var(--color-border)", borderRadius: "var(--radius)", padding: 16, marginTop: 12, background: "var(--color-surface)" };
const h2: React.CSSProperties = { fontSize: "1.05rem", fontWeight: 700, marginTop: "1.75rem" };
const note: React.CSSProperties = { fontSize: 12, color: "var(--color-muted)", lineHeight: 1.8, marginTop: 8 };
const th: React.CSSProperties = { textAlign: "left", padding: "6px 8px", color: "var(--color-muted)", fontWeight: 600, fontSize: 12 };
const td: React.CSSProperties = { padding: "6px 8px", fontSize: 12.5 };

export default function Page() {
  // --- 暗号化(AES-256-GCM) ---
  const key = deriveKey("demo-secret-please-change-in-real-apps", "demo-salt-please-change");
  const otherKey = deriveKey("another-secret-value-for-demo", "demo-salt-please-change");
  const plaintext = "1234-5678-9012-3456";
  const encrypted = encrypt(plaintext, key);
  const encryptedAgain = encrypt(plaintext, key); // 同じ平文・同じ鍵でも結果は変わる
  const decrypted = decrypt(encrypted, key);

  // 鍵が違えば復号できない（バックアップから戻しても鍵が無ければ読めない、の実演）
  let wrongKeyResult = "";
  try { wrongKeyResult = decrypt(encrypted, otherKey); } catch { wrongKeyResult = "復号に失敗（鍵が違う）"; }

  // --- パスワード(scrypt) ---
  const password = "Tr0ub4dor&3";
  const hashed = hashPassword(password);
  const hashedAgain = hashPassword(password); // ソルトが毎回違うので別の値になる
  const okVerify = verifyPassword(password, hashed);
  const ngVerify = verifyPassword("wrong-password", hashed);
  const strengths = ["password", "P@ssw0rd", "Tr0ub4dor&3", "correct-horse-battery-staple-2026"].map((p) => ({ p, s: passwordStrength(p) }));

  // --- 権限(RBAC): 許可だけでなく「拒否されるべきもの」も並べる ---
  const cases: { role: string; perm: string; want: "許可" | "拒否" }[] = [
    { role: "admin", perm: "inquiry:export", want: "許可" },
    { role: "staff", perm: "inquiry:read", want: "許可" },
    { role: "staff", perm: "inquiry:export", want: "拒否" },
    { role: "unknown-role", perm: "inquiry:read", want: "拒否" },
    { role: "STAFF", perm: "inquiry:read", want: "拒否" },
  ];

  const headers = securityHeaders();

  return (
    <main style={{ maxWidth: 780, margin: "2.5rem auto", padding: "0 1rem" }}>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: 6 }}>暗号化・パスワード・権限・ヘッダー</h1>
      <p style={{ fontSize: 13, color: "var(--color-muted)" }}>
        表示されている値は、このページを開いた瞬間にサーバ側で計算された実際の結果です。再読み込みすると変わります。
      </p>

      <h2 style={h2}>暗号化（AES-256-GCM）</h2>
      <div style={box}>
        <div style={{ fontSize: 13 }}>平文: <code>{plaintext}</code></div>
        <div style={{ marginTop: 6, fontSize: 12.5, wordBreak: "break-all" }}>暗号文: <code>{encrypted}</code></div>
        <div style={{ marginTop: 6, fontSize: 12.5, wordBreak: "break-all" }}>同じ平文をもう一度: <code>{encryptedAgain}</code></div>
        <div style={{ marginTop: 6, fontSize: 13 }}>
          復号: <code>{decrypted}</code>
          {decrypted === plaintext && <span style={{ color: "var(--color-primary)" }}> ✓ 一致</span>}
        </div>
        <div style={{ marginTop: 6, fontSize: 13 }}>別の鍵で復号: <code>{wrongKeyResult}</code></div>
        <p style={note}>
          同じ平文・同じ鍵でも毎回異なる暗号文になります（初期化ベクトルが毎回変わるため）。
          同じ値かどうかを暗号文の一致で判定してはいけない、ということでもあります。
          <strong>鍵が無ければ復号できません</strong>。DB のバックアップだけ戻しても、鍵を失っていれば読めません。
        </p>
      </div>

      <h2 style={h2}>パスワード（scrypt）</h2>
      <div style={box}>
        <div style={{ fontSize: 12.5, wordBreak: "break-all" }}>ハッシュ: <code>{hashed}</code></div>
        <div style={{ marginTop: 6, fontSize: 12.5, wordBreak: "break-all" }}>同じパスワードを再ハッシュ: <code>{hashedAgain}</code></div>
        <div style={{ marginTop: 8, fontSize: 13 }}>
          正しいパスワードで照合: <span style={{ color: okVerify ? "var(--color-primary)" : "var(--color-danger)" }}>{okVerify ? "一致" : "不一致"}</span>
          {" / "}誤ったパスワード: <span style={{ color: ngVerify ? "var(--color-danger)" : "var(--color-primary)" }}>{ngVerify ? "一致（異常）" : "不一致"}</span>
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 12 }}>
          <thead><tr><th style={th}>パスワード</th><th style={th}>強度</th><th style={th}>助言</th></tr></thead>
          <tbody>
            {strengths.map(({ p, s }) => (
              <tr key={p} style={{ borderTop: "1px solid var(--color-border)" }}>
                <td style={td}><code>{p}</code></td>
                <td style={td}>{"★".repeat(s.score + 1)}{"☆".repeat(4 - s.score)} {s.label}</td>
                <td style={{ ...td, color: "var(--color-muted)" }}>{s.suggestions.length > 0 ? s.suggestions.join(" / ") : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p style={note}>
          ハッシュは毎回違う値になります（ソルトが毎回変わるため）。それでも照合できるのは、
          ソルトがハッシュ自体に含まれているからです。平文のパスワードは保存しません。
        </p>
      </div>

      <h2 style={h2}>権限（RBAC）</h2>
      <div style={box}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr><th style={th}>ロール</th><th style={th}>権限</th><th style={th}>結果</th><th style={th}>期待</th></tr></thead>
          <tbody>
            {cases.map((c) => {
              const allowed = can(policy, [c.role], c.perm);
              const actual = allowed ? "許可" : "拒否";
              return (
                <tr key={`${c.role}-${c.perm}`} style={{ borderTop: "1px solid var(--color-border)" }}>
                  <td style={td}><code>{c.role}</code></td>
                  <td style={td}><code>{c.perm}</code></td>
                  <td style={{ ...td, color: allowed ? "var(--color-primary)" : "var(--color-danger)" }}>{actual}</td>
                  <td style={td}>{actual === c.want ? "✓" : "✗ 想定外"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p style={note}>
          大事なのは下の3行です。<strong>存在しないロール</strong>や<strong>大文字違い</strong>で権限が通らないこと（＝権限昇格が起きないこと）を、
          スモークテストでも「通ってはいけない」側から固定しています。
        </p>
      </div>

      <h2 style={h2}>セキュリティヘッダー</h2>
      <div style={box}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <tbody>
            {Object.entries(headers).map(([k, v]) => (
              <tr key={k} style={{ borderTop: "1px solid var(--color-border)" }}>
                <td style={{ ...td, whiteSpace: "nowrap", color: "var(--color-muted)" }}>{k}</td>
                <td style={{ ...td, wordBreak: "break-all", fontFamily: "monospace", fontSize: 11.5 }}>{v}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p style={note}>
          <code>securityHeaders()</code> の戻り値をそのまま表示しています。応答ヘッダーに乗せることで、
          XSS・クリックジャッキング・MIME 推測などの既定の防御が有効になります。
        </p>
      </div>

      <h2 style={h2}>使い捨てトークン</h2>
      <div style={box}>
        <div style={{ fontSize: 12.5, wordBreak: "break-all" }}><code>{randomToken()}</code></div>
        <p style={note}>暗号論的に安全な乱数から生成します。パスワード再設定リンクや API キーの発行に使います。</p>
      </div>
    </main>
  );
}
