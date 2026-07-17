/**
 * API キーのデモ。generateApiKey が node:crypto を使うため **Server Component** で
 * 基盤を直接呼ぶ(/security と同じ作り)。
 */
import { generateApiKey, hashApiKey, verifyApiKey, hasScope, hasAllScopes, authenticateApiKey, type ApiKeyRecord, type ApiKeyStore } from "@platform/apikey";

const box: React.CSSProperties = {
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius)",
  background: "var(--color-surface)",
  padding: 16,
  marginBottom: 16,
};

const mono: React.CSSProperties = { fontFamily: "monospace", fontSize: 12, wordBreak: "break-all" };

const NOW = Date.parse("2026-07-17T00:00:00Z");

export default async function Page() {
  // --- 発行 ---
  const issued = generateApiKey({ prefix: "sk_live_", bytes: 24 });
  const revokedKey = generateApiKey({ prefix: "sk_live_" });
  const expiredKey = generateApiKey({ prefix: "sk_live_" });
  const unknownKey = generateApiKey({ prefix: "sk_live_" });

  // --- 保存されているのはハッシュだけ ---
  const records: ApiKeyRecord[] = [
    { id: "k-001", hash: issued.hash, scopes: ["invoice:read", "invoice:write"] },
    { id: "k-002", hash: revokedKey.hash, scopes: ["invoice:read"], revoked: true },
    { id: "k-003", hash: expiredKey.hash, scopes: ["invoice:read"], expiresAt: Date.parse("2026-01-01T00:00:00Z") },
  ];
  const store: ApiKeyStore = { findByHash: (hash) => records.find((r) => r.hash === hash) ?? null };

  // --- 認証（有効 / 失効 / 期限切れ / 未登録） ---
  const cases: { label: string; plaintext: string }[] = [
    { label: "有効なキー", plaintext: issued.plaintext },
    { label: "失効させたキー", plaintext: revokedKey.plaintext },
    { label: "期限切れのキー", plaintext: expiredKey.plaintext },
    { label: "登録されていないキー", plaintext: unknownKey.plaintext },
    { label: "でたらめな文字列", plaintext: "sk_live_totally-made-up" },
  ];
  const results = await Promise.all(
    cases.map(async (c) => ({ ...c, result: await authenticateApiKey(c.plaintext, store, NOW) })),
  );

  // --- スコープ判定 ---
  const scopeCases: { granted: string[]; need: string; ok: boolean }[] = [
    { granted: ["invoice:read", "invoice:write"], need: "invoice:read", ok: hasScope(["invoice:read", "invoice:write"], "invoice:read") },
    { granted: ["invoice:read"], need: "invoice:write", ok: hasScope(["invoice:read"], "invoice:write") },
  ];
  const allOk = hasAllScopes(["invoice:read", "invoice:write"], ["invoice:read", "invoice:write"]);
  const allNg = hasAllScopes(["invoice:read"], ["invoice:read", "invoice:write"]);

  return (
    <main style={{ maxWidth: 900, margin: "2.5rem auto", padding: "0 1rem" }}>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: 4 }}>API キー</h1>
      <p style={{ fontSize: 13, color: "var(--color-muted)", lineHeight: 1.8, marginBottom: 20 }}>
        社外システムや RPA に API を開放するときのキー管理です。
        <strong>平文は発行時にしか見せず、DB にはハッシュだけを保存します</strong>。
        パスワードと同じ扱いで、漏れても DB からは復元できません。
      </p>

      <div style={box}>
        <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>① 発行</h2>
        <div style={{ fontSize: 13, lineHeight: 2.2 }}>
          <div>
            <span style={{ color: "var(--color-muted)" }}>平文（この 1 回だけ表示）</span>
            <div style={{ ...mono, padding: "6px 10px", background: "var(--color-bg)", borderRadius: 4, border: "1px solid var(--color-primary)" }}>{issued.plaintext}</div>
          </div>
          <div style={{ marginTop: 8 }}>
            <span style={{ color: "var(--color-muted)" }}>DB に保存するハッシュ</span>
            <div style={{ ...mono, padding: "6px 10px", background: "var(--color-bg)", borderRadius: 4, color: "var(--color-muted)" }}>{issued.hash}</div>
          </div>
          <div style={{ marginTop: 8 }}>
            <span style={{ color: "var(--color-muted)" }}>一覧表示用のプレフィックス</span>
            <div style={{ ...mono, padding: "6px 10px", background: "var(--color-bg)", borderRadius: 4 }}>{issued.displayPrefix}…</div>
          </div>
        </div>
        <p style={{ fontSize: 12, color: "var(--color-muted)", marginTop: 10, lineHeight: 1.8 }}>
          プレフィックスがあるので、キー一覧の画面で<strong>「どれがどれか」を平文なしに見分けられます</strong>。
          「あのキーを失効させたい」というとき、平文を聞き出す必要がありません。
          <br />
          このページを再読み込みすると値が変わります（毎回ランダムに生成しているため）。
        </p>
      </div>

      <div style={box}>
        <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>② 照合</h2>
        <div style={{ fontSize: 13, lineHeight: 2 }}>
          <div>
            <code>verifyApiKey(平文, ハッシュ)</code> ={" "}
            <b style={{ color: verifyApiKey(issued.plaintext, issued.hash) ? "var(--color-success)" : "var(--color-danger)" }}>
              {String(verifyApiKey(issued.plaintext, issued.hash))}
            </b>
          </div>
          <div>
            <code>verifyApiKey(別の平文, ハッシュ)</code> ={" "}
            <b style={{ color: verifyApiKey(revokedKey.plaintext, issued.hash) ? "var(--color-danger)" : "var(--color-success)" }}>
              {String(verifyApiKey(revokedKey.plaintext, issued.hash))}
            </b>
          </div>
          <div style={{ color: "var(--color-muted)" }}>
            <code>hashApiKey()</code> は同じ入力で必ず同じハッシュ: <span style={mono}>{hashApiKey(issued.plaintext).slice(0, 24)}…</span>
          </div>
        </div>
      </div>

      <div style={box}>
        <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>③ 認証</h2>
        <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ textAlign: "left", color: "var(--color-muted)" }}>
              <th style={{ padding: 5 }}>ケース</th>
              <th style={{ padding: 5 }}>利用者へ返すもの</th>
              <th style={{ padding: 5 }}>スコープ</th>
              <th style={{ padding: 5 }}>reason（ログのみ）</th>
            </tr>
          </thead>
          <tbody>
            {results.map((r) => (
              <tr key={r.label} style={{ borderTop: "1px solid var(--color-border)" }}>
                <td style={{ padding: 5 }}>{r.label}</td>
                <td style={{ padding: 5, fontWeight: 700, color: r.result.ok ? "var(--color-success)" : "var(--color-danger)" }}>
                  {/* 利用者へ返すのはここまで。reason は出さない。 */}
                  {r.result.ok ? "○ 認証成功" : "× 401 Unauthorized"}
                </td>
                <td style={{ padding: 5, ...mono, color: "var(--color-muted)" }}>
                  {r.result.ok ? r.result.record.scopes.join(", ") : "—"}
                </td>
                <td style={{ padding: 5, ...mono, color: "var(--color-muted)" }}>
                  {r.result.ok ? "—" : r.result.reason}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p style={{ fontSize: 12, color: "var(--color-muted)", marginTop: 10, lineHeight: 1.8 }}>
          <strong>失効・期限切れ・未登録を、利用者から見て区別できないようにするのが要点です。</strong>
          右端の <code>reason</code> は基盤が返しますが、<strong>これをそのまま利用者へ出してはいけません</strong>。
          「そのキーは失効しています」と返すと、攻撃者に<strong>「キー自体は存在する」</strong>と教えることになり、
          総当たりの手がかりになります。
          <br />
          このデモは全部まとめて <code>401</code> にしています。<code>reason</code> は<strong>監査ログと調査のため</strong>で、
          <code>/audit</code> に記録する側の情報です。<strong>基盤が理由を持ち、アプリが握り潰す</strong>——
          <code>/mcp</code> のスコープ拒否と同じ形です。
        </p>
      </div>

      <div style={box}>
        <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>④ スコープ</h2>
        <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ textAlign: "left", color: "var(--color-muted)" }}>
              <th style={{ padding: 5 }}>付与済み</th>
              <th style={{ padding: 5 }}>必要</th>
              <th style={{ padding: 5 }}>判定</th>
            </tr>
          </thead>
          <tbody>
            {scopeCases.map((s, i) => (
              <tr key={i} style={{ borderTop: "1px solid var(--color-border)" }}>
                <td style={{ padding: 5, ...mono }}>{s.granted.join(", ")}</td>
                <td style={{ padding: 5, ...mono }}>{s.need}</td>
                <td style={{ padding: 5, fontWeight: 700, color: s.ok ? "var(--color-success)" : "var(--color-danger)" }}>{s.ok ? "○ 許可" : "× 拒否"}</td>
              </tr>
            ))}
            <tr style={{ borderTop: "1px solid var(--color-border)" }}>
              <td style={{ padding: 5, ...mono }}>invoice:read, invoice:write</td>
              <td style={{ padding: 5, ...mono }}>両方（hasAllScopes）</td>
              <td style={{ padding: 5, fontWeight: 700, color: allOk ? "var(--color-success)" : "var(--color-danger)" }}>{allOk ? "○ 許可" : "× 拒否"}</td>
            </tr>
            <tr style={{ borderTop: "1px solid var(--color-border)" }}>
              <td style={{ padding: 5, ...mono }}>invoice:read</td>
              <td style={{ padding: 5, ...mono }}>両方（hasAllScopes）</td>
              <td style={{ padding: 5, fontWeight: 700, color: allNg ? "var(--color-success)" : "var(--color-danger)" }}>{allNg ? "○ 許可" : "× 拒否"}</td>
            </tr>
          </tbody>
        </table>
        <p style={{ fontSize: 12, color: "var(--color-muted)", marginTop: 10 }}>
          <code>/mcp</code> のツール認可も同じ考え方です（書き込み系のツールにスコープを付ける）。
        </p>
      </div>
    </main>
  );
}
