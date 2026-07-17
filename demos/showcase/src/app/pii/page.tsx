/**
 * 個人情報(PII)のデモ。blindIndex が node:crypto を使うため **Server Component** で
 * 基盤を直接呼ぶ(/security と同じ作り)。
 */
import { maskMyNumber, maskEmail, maskPhone, maskName, maskPartial, blindIndex, anonymizeRecord, PII_TOMBSTONE } from "@platform/pii";

const box: React.CSSProperties = {
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius)",
  background: "var(--color-surface)",
  padding: 16,
  marginBottom: 16,
};

const mono: React.CSSProperties = { fontFamily: "monospace", fontSize: 13 };

export default function Page() {
  // --- マスキング ---
  const masks: { label: string; raw: string; masked: string; note: string }[] = [
    { label: "マイナンバー", raw: "123456789012", masked: maskMyNumber("123456789012"), note: "既定は全桁伏せ" },
    { label: "マイナンバー（下4桁）", raw: "123456789012", masked: maskMyNumber("123456789012", 4), note: "表示は最大4桁まで（それ以上は指定しても効かない）" },
    { label: "マイナンバー（桁数が変）", raw: "12345", masked: maskMyNumber("12345"), note: "想定外の長さは安全側に倒して全桁伏せ" },
    { label: "メール", raw: "taro.yamada@example.co.jp", masked: maskEmail("taro.yamada@example.co.jp"), note: "ドメインは残す（問い合わせ元の判別用）" },
    { label: "電話番号", raw: "03-1234-5678", masked: maskPhone("03-1234-5678"), note: "" },
    { label: "氏名", raw: "山田太郎", masked: maskName("山田太郎"), note: "" },
    { label: "任意の文字列", raw: "SN-A1B2C3D4", masked: maskPartial("SN-A1B2C3D4", 3), note: "先頭3文字だけ残す" },
  ];

  // --- blind index（検索可能暗号） ---
  const key = "demo-hmac-key-please-change-in-real-apps";
  const variants = ["taro@example.co.jp", "Taro@Example.co.jp", "  taro@example.co.jp  ", "jiro@example.co.jp"];
  const indexed = variants.map((v) => ({ input: v, index: blindIndex(v, key) }));
  const first = indexed[0]?.index ?? "";

  // --- 匿名化（削除ではなく墓標を立てる） ---
  const before = { id: "u-001", name: "山田太郎", email: "taro@example.co.jp", department: "情報システム部", joinedAt: "2020-04-01" };
  const after = anonymizeRecord(before, ["name", "email"]);

  return (
    <main style={{ maxWidth: 900, margin: "2.5rem auto", padding: "0 1rem" }}>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: 4 }}>個人情報（PII）の取り扱い</h1>
      <p style={{ fontSize: 13, color: "var(--color-muted)", lineHeight: 1.8, marginBottom: 20 }}>
        マスキング・<strong>検索可能暗号（blind index）</strong>・匿名化。
        <code>node:crypto</code> を使うので <strong>Server Component で基盤を直接呼んでいます</strong>
        （<code>/security</code> と同じ作り）。ブラウザに鍵を置かないための構成です。
      </p>

      <div style={box}>
        <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>① マスキング</h2>
        <p style={{ fontSize: 12, color: "var(--color-muted)", marginBottom: 10, lineHeight: 1.8 }}>
          画面やログに出す前に伏せます。<strong>桁数が想定外なら安全側に倒す</strong>（全部伏せる）のが要点で、
          「12桁のはずだから下4桁だけ出す」と各アプリで書くと、変なデータが来たときに漏れます。
        </p>
        <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ textAlign: "left", color: "var(--color-muted)" }}>
              <th style={{ padding: 5 }}>項目</th>
              <th style={{ padding: 5 }}>元</th>
              <th style={{ padding: 5 }}>マスク後</th>
              <th style={{ padding: 5 }}>備考</th>
            </tr>
          </thead>
          <tbody>
            {masks.map((m) => (
              <tr key={m.label} style={{ borderTop: "1px solid var(--color-border)" }}>
                <td style={{ padding: 5 }}>{m.label}</td>
                <td style={{ padding: 5, ...mono, color: "var(--color-muted)" }}>{m.raw}</td>
                <td style={{ padding: 5, ...mono, fontWeight: 700 }}>{m.masked}</td>
                <td style={{ padding: 5, fontSize: 11, color: "var(--color-muted)" }}>{m.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={box}>
        <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>② blind index（暗号化したまま検索する）</h2>
        <p style={{ fontSize: 12, color: "var(--color-muted)", marginBottom: 10, lineHeight: 1.8 }}>
          個人情報を暗号化して保存すると、<strong>普通は検索できなくなります</strong>（暗号文は毎回変わるため）。
          blind index は値を正規化して HMAC-SHA256 で固定のハッシュにするので、
          <strong>「同じ値かどうか」だけを暗号文のまま判定できます</strong>。
          DB にはこれを別カラムで持ち、索引を張ります。
        </p>
        <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ textAlign: "left", color: "var(--color-muted)" }}>
              <th style={{ padding: 5 }}>入力</th>
              <th style={{ padding: 5 }}>blind index</th>
              <th style={{ padding: 5 }}>1件目と一致？</th>
            </tr>
          </thead>
          <tbody>
            {indexed.map((it, i) => (
              <tr key={i} style={{ borderTop: "1px solid var(--color-border)" }}>
                <td style={{ padding: 5, ...mono }}>「{it.input}」</td>
                <td style={{ padding: 5, ...mono, color: "var(--color-muted)" }}>{it.index.slice(0, 24)}…</td>
                <td style={{ padding: 5, fontWeight: 700, color: it.index === first ? "var(--color-success)" : "var(--color-muted)" }}>
                  {it.index === first ? "○ 一致" : "— 別の値"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p style={{ fontSize: 12, color: "var(--color-muted)", marginTop: 10, lineHeight: 1.8 }}>
          <strong>大文字小文字と前後の空白が違っても同じ index になります</strong>（正規化してからハッシュ化するため）。
          利用者が「Taro@Example.co.jp」で登録して「taro@example.co.jp」で検索しても引けます。
          ハッシュ化なので<strong>元の値は復元できません</strong>。
        </p>
      </div>

      <div style={box}>
        <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>③ 匿名化（削除ではなく墓標を立てる）</h2>
        <p style={{ fontSize: 12, color: "var(--color-muted)", marginBottom: 10, lineHeight: 1.8 }}>
          退職者や退会者の個人情報を消すとき、<strong>レコードごと削除すると集計が壊れます</strong>
          （在籍者数、過去の申請件数など）。個人が特定できる項目だけを
          <code>{PII_TOMBSTONE}</code> に置き換え、<strong>行は残します</strong>。
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12 }}>
          <div>
            <div style={{ fontSize: 11, color: "var(--color-muted)", marginBottom: 4 }}>before</div>
            <pre style={{ ...mono, fontSize: 12, background: "var(--color-bg)", padding: 12, borderRadius: "var(--radius)", margin: 0, overflowX: "auto" }}>
              {JSON.stringify(before, null, 2)}
            </pre>
          </div>
          <div>
            <div style={{ fontSize: 11, color: "var(--color-muted)", marginBottom: 4 }}>
              after — <code>anonymizeRecord(rec, [&quot;name&quot;, &quot;email&quot;])</code>
            </div>
            <pre style={{ ...mono, fontSize: 12, background: "var(--color-bg)", padding: 12, borderRadius: "var(--radius)", margin: 0, overflowX: "auto" }}>
              {JSON.stringify(after, null, 2)}
            </pre>
          </div>
        </div>
        <p style={{ fontSize: 12, color: "var(--color-muted)", marginTop: 10 }}>
          <code>id</code> と <code>department</code> と <code>joinedAt</code> は残るので、
          「2020年度入社の情シス配属者は何人だったか」は後から数えられます。個人は特定できません。
        </p>
      </div>
    </main>
  );
}
