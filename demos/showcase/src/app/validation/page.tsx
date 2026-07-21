"use client";
/**
 * 入力バリデーションのデモ。
 *
 * **① `inputMode`(スマホのキーボード) と ② 正規化 の両方**を見せる。
 * 片方だけでは足りない —— キーボードを出しても全角で打たれるし、
 * 正規化だけではスマホで打ちにくい。
 *
 * UI は **@platform/ui の部品だけ**で組む(CLAUDE.md「UI 部品は @platform/ui を使う」)。
 */
import * as React from "react";
import { Button, Input, Select, Badge, Alert, Separator, inputAttrs, useComposition, INPUT_KIND_LABELS, type InputKind } from "@platform/ui";
import {
  zipCodeJp,
  phoneJp,
  mobileJp,
  email,
  katakana,
  myNumber,
  corporateNumber,
  alphanumeric,
  toHalfWidth,
  digitsToHalfWidth,
  normalizeSpace,
} from "@platform/validation";

const box: React.CSSProperties = {
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius)",
  background: "var(--color-surface)",
  padding: 16,
  marginBottom: 16,
};

const mono: React.CSSProperties = { fontFamily: "monospace", fontSize: 12 };

/** 検証する項目。**「全角で打たれる」前提**の例を入れてある。 */
const FIELDS = [
  { key: "zip", label: "郵便番号", kind: "digits" as InputKind, schema: zipCodeJp, sample: "１２３-４５６７", hint: "全角で打っても通ります" },
  { key: "tel", label: "電話番号", kind: "tel" as InputKind, schema: phoneJp, sample: "０３－１２３４－５６７８", hint: "全角・全角ハイフンも受理" },
  { key: "mobile", label: "携帯番号", kind: "tel" as InputKind, schema: mobileJp, sample: "090-1234-5678", hint: "070/080/090 のみ" },
  { key: "email", label: "メール", kind: "email" as InputKind, schema: email, sample: "taro@example.co.jp", hint: "スマホで @ が出ます" },
  { key: "kana", label: "フリガナ", kind: "kana" as InputKind, schema: katakana, sample: "ヤマダタロウ", hint: "全角カタカナ" },
  { key: "myno", label: "マイナンバー", kind: "digits" as InputKind, schema: myNumber, sample: "123456789012", hint: "チェックディジットまで検証" },
  { key: "corp", label: "法人番号", kind: "digits" as InputKind, schema: corporateNumber, sample: "1180301018771", hint: "トヨタの実番号" },
  { key: "alnum", label: "社員コード", kind: "text" as InputKind, schema: alphanumeric, sample: "ABC123", hint: "半角英数のみ" },
];

export default function Page() {
  const [values, setValues] = React.useState<Record<string, string>>(() =>
    Object.fromEntries(FIELDS.map((f) => [f.key, f.sample])),
  );
  const [kind, setKind] = React.useState<InputKind>("digits");
  const [raw, setRaw] = React.useState("ＡＢＣ－１２３４　（全角）");
  const [imeValue, setImeValue] = React.useState("");
  const [validateWhileComposing, setValidateWhileComposing] = React.useState(false);

  const { isComposing, handlers } = useComposition();

  // ★変換中は検証しない。しないと「やまだ」の時点で弾く。
  const imeError =
    imeValue === "" ? "" : validateWhileComposing || !isComposing ? (katakana.safeParse(imeValue).success ? "" : "全角カタカナで入力してください") : "";

  return (
    <main style={{ maxWidth: 900, margin: "2.5rem auto", padding: "0 1rem" }}>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: 4 }}>入力バリデーション</h1>
      <p style={{ fontSize: 13, color: "var(--color-muted)", lineHeight: 1.8, marginBottom: 20 }}>
        <strong>利用者は全角で打ってきます。</strong>「なぜか登録できない」問い合わせの多くがこれです。
        <code>@platform/validation</code> は<strong>弾かずに受け止めて正規化</strong>します。
      </p>

      <div style={box}>
        <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 10 }}>① 検証（全角のまま打ってみてください）</h2>
        <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ textAlign: "left", color: "var(--color-muted)" }}>
              <th style={{ padding: 5, width: 110 }}>項目</th>
              <th style={{ padding: 5 }}>入力</th>
              <th style={{ padding: 5, width: 80 }}>結果</th>
              <th style={{ padding: 5 }}>正規化後 / エラー</th>
            </tr>
          </thead>
          <tbody>
            {FIELDS.map((f) => {
              const r = f.schema.safeParse(values[f.key] ?? "");
              return (
                <tr key={f.key} style={{ borderTop: "1px solid var(--color-border)" }}>
                  <td style={{ padding: 5 }}>
                    {f.label}
                    <div style={{ fontSize: 10, color: "var(--color-muted)" }}>{f.hint}</div>
                  </td>
                  <td style={{ padding: 5 }}>
                    {/* ★inputMode を基盤から渡す。スマホでキーボードが変わる */}
                    <Input
                      {...inputAttrs(f.kind)}
                      value={values[f.key] ?? ""}
                      onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                    />
                  </td>
                  <td style={{ padding: 5 }}>
                    <Badge variant={r.success ? "success" : "danger"}>{r.success ? "OK" : "NG"}</Badge>
                  </td>
                  <td style={{ padding: 5, ...mono, color: r.success ? "var(--color-success)" : "var(--color-danger)" }}>
                    {r.success ? String(r.data) : (r.error.issues[0]?.message ?? "")}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <Alert variant="info" title="全角で打っても通るのが要点です" style={{ marginTop: 12 }}>
          <span style={{ fontSize: 12, lineHeight: 1.8 }}>
            郵便番号の <code>１２３-４５６７</code>、電話の <code>０３－１２３４－５６７８</code> ——
            <strong>どちらも通り、半角に正規化された値が返ります</strong>。
            <code>z.preprocess(digitsToHalfWidth, ...)</code> が受け取ってから正規化しているためです。
            <br />
            <strong>弾いてしまうと「なぜか登録できない」問い合わせになります。</strong>
            マイナンバーと法人番号は<strong>チェックディジットまで検証</strong>するので、
            桁数が合っているだけの出鱈目は通りません（末尾 1 桁を変えて試してください）。
          </span>
        </Alert>
      </div>

      <div style={box}>
        <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 10 }}>② 入力制限（スマホのキーボード）</h2>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end", marginBottom: 10 }}>
          <label style={{ fontSize: 12 }}>
            <div style={{ marginBottom: 4, color: "var(--color-muted)" }}>入力の種類</div>
            <Select
              value={kind}
              onChange={(e) => setKind(e.target.value as InputKind)}
              options={(Object.keys(INPUT_KIND_LABELS) as InputKind[]).map((k) => ({ label: `${k} — ${INPUT_KIND_LABELS[k]}`, value: k }))}
              style={{ width: 320 }}
            />
          </label>
          <div style={{ flex: 1, minWidth: 180 }}>
            <div style={{ marginBottom: 4, fontSize: 12, color: "var(--color-muted)" }}>試す</div>
            <Input {...inputAttrs(kind)} placeholder="スマホで開くとキーボードが変わります" />
          </div>
        </div>

        <div style={{ fontSize: 12, color: "var(--color-muted)", marginBottom: 6 }}>
          <code>inputAttrs(&quot;{kind}&quot;)</code> が返す属性
        </div>
        <pre style={{ ...mono, background: "var(--color-bg)", border: "1px solid var(--color-border)", borderRadius: 4, padding: "8px 10px", margin: 0 }}>
          {JSON.stringify(inputAttrs(kind), null, 2)}
        </pre>

        <Alert variant="warning" title="「日本語固定」「英数固定」はできません" style={{ marginTop: 12 }}>
          <span style={{ fontSize: 12, lineHeight: 1.8 }}>
            <strong>IME をブラウザから制御する方法はありません。</strong>
            かつて CSS に <code>ime-mode</code> がありましたが、<strong>標準から削除済み</strong>で、
            Edge の通常モードでは動きません。「いつ動かなくなってもおかしくない」状態です。
            <br />
            <br />
            できるのは 2 つだけで、<strong>両方やる必要があります</strong>：
            <br />
            <strong>① <code>inputMode</code> でキーボードの種類をヒントとして渡す</strong>（スマホで効く。PC では変わらない）
            <br />
            <strong>② 入力された全角をコード側で正規化する</strong>（上の ① の表がそれ）
            <br />
            <br />
            ①だけでは<strong>全角で打たれたら通りません</strong>。②だけでは<strong>スマホで打ちにくい</strong>。
            <code>@platform/validation</code> が②を、<code>inputAttrs()</code> が①を持ちます。
          </span>
        </Alert>

        <Separator style={{ margin: "14px 0" }} />

        <div style={{ fontSize: 12, color: "var(--color-muted)", lineHeight: 1.9 }}>
          <strong>
            <code>digits</code> で <code>type=&quot;number&quot;</code> を使わないのは意図的です。
          </strong>
          <br />
          スピナーが出る / <strong>先頭の 0 が消える</strong>（郵便番号 <code>0123456</code> が壊れる）/
          全角数字を弾いて「なぜか入力できない」になる —— 実害があります。
          <code>text</code> + <code>inputMode=&quot;numeric&quot;</code> が定石です。
        </div>
      </div>

      <div style={box}>
        <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 10 }}>③ 正規化（受け止めてから直す）</h2>
        <Input value={raw} onChange={(e) => setRaw(e.target.value)} style={{ marginBottom: 10 }} />
        <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
          <tbody>
            {[
              { fn: "toHalfWidth()", v: toHalfWidth(raw), note: "英数記号を半角に。**カナは変換しない**" },
              { fn: "digitsToHalfWidth()", v: digitsToHalfWidth(raw), note: "数字だけ。住所の「１丁目」を壊さない" },
              { fn: "normalizeSpace()", v: normalizeSpace(raw), note: "全角スペースと連続空白を整理" },
            ].map((r) => (
              <tr key={r.fn} style={{ borderTop: "1px solid var(--color-border)" }}>
                <td style={{ padding: 5, ...mono, width: 160 }}>{r.fn}</td>
                <td style={{ padding: 5, ...mono, fontWeight: 700 }}>{r.v}</td>
                <td style={{ padding: 5, fontSize: 11, color: "var(--color-muted)" }}>{r.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p style={{ fontSize: 12, color: "var(--color-muted)", marginTop: 10, lineHeight: 1.8 }}>
          <strong><code>toHalfWidth()</code> がカナを変換しないのは正しい設計です。</strong>
          「ヤマダ」を「ﾔﾏﾀﾞ」にしてしまうと、氏名が半角カナで保存されます。
          <br />
          <strong><code>digitsToHalfWidth()</code> を分けているのも同じ理由</strong>で、
          住所の <code>１丁目</code> は数字だけ半角にしたい（<code>丁目</code> は残す）場面があります。
        </p>
      </div>

      <div style={box}>
        <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 10 }}>④ IME の変換中に検証しない</h2>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 10 }}>
          <Input
            {...handlers}
            {...inputAttrs("kana")}
            value={imeValue}
            onChange={(e) => setImeValue(e.target.value)}
            placeholder="「やまだ」と打って変換してみてください"
            style={{ flex: 1, minWidth: 240 }}
          />
          <Badge variant={isComposing ? "warning" : "secondary"}>{isComposing ? "変換中" : "確定"}</Badge>
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
          <Button size="sm" variant={validateWhileComposing ? "danger" : "secondary"} onClick={() => setValidateWhileComposing((v) => !v)}>
            {validateWhileComposing ? "変換中も検証する（バグの再現）" : "確定後だけ検証する（正しい）"}
          </Button>
        </div>

        {imeError !== "" && (
          <Alert variant="danger" title="エラー">
            <span style={{ fontSize: 12 }}>{imeError}</span>
          </Alert>
        )}

        <Alert variant="info" title="日本語入力で最も多いバグです" style={{ marginTop: 10 }}>
          <span style={{ fontSize: 12, lineHeight: 1.8 }}>
            日本語は <strong>ひらがな → 変換 → 確定</strong> と打ちます。
            キー入力ごとに検証すると、<strong>「やまだ」の時点で「カタカナで入力してください」と出ます</strong>。
            <br />
            上のボタンを「<strong>変換中も検証する</strong>」にして、「やまだ」と打ってみてください。
            確定前に赤くなります。<strong>これが利用者の見ている景色です。</strong>
            <br />
            <br />
            <code>useComposition()</code> は <code>compositionstart</code> / <code>compositionend</code> を追い、
            <strong>確定後にだけ検証</strong>できるようにします。
            <br />
            <strong>Enter キーにも効きます。</strong>変換確定の Enter と送信の Enter は同じイベントなので、
            <code>isComposing</code> を見ないと<strong>変換を確定した瞬間にフォームが送信されます</strong>。
          </span>
        </Alert>
      </div>

      <div style={box}>
        <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>まとめ</h2>
        <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ textAlign: "left", color: "var(--color-muted)" }}>
              <th style={{ padding: 5 }}>やりたいこと</th>
              <th style={{ padding: 5 }}>できるか</th>
              <th style={{ padding: 5 }}>方法</th>
            </tr>
          </thead>
          <tbody>
            {[
              { want: "スマホでテンキーを出す", ok: true, how: "inputAttrs(\"digits\")" },
              { want: "スマホで @ を出す", ok: true, how: "inputAttrs(\"email\")" },
              { want: "全角で打たれても通す", ok: true, how: "zipCodeJp 等（preprocess で正規化）" },
              { want: "変換中に弾かない", ok: true, how: "useComposition()" },
              { want: "IME を日本語に固定", ok: false, how: "★不可能（ime-mode は廃止済み）" },
              { want: "IME を英数に固定", ok: false, how: "★不可能。正規化で受け止める" },
            ].map((r) => (
              <tr key={r.want} style={{ borderTop: "1px solid var(--color-border)" }}>
                <td style={{ padding: 5 }}>{r.want}</td>
                <td style={{ padding: 5 }}>
                  <Badge variant={r.ok ? "success" : "danger"}>{r.ok ? "できる" : "できない"}</Badge>
                </td>
                <td style={{ padding: 5, ...mono, color: "var(--color-muted)" }}>{r.how}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p style={{ fontSize: 12, color: "var(--color-muted)", marginTop: 10, lineHeight: 1.8 }}>
          <strong>「固定したい」という要望の本当の目的は、たいてい「変な値が入らないようにしたい」です。</strong>
          それは<strong>入り口を塞ぐのではなく、受け取ってから正規化・検証する</strong>ことで達成できます。
          <code>/converters</code> の電話番号、<code>/safe-html</code> の全角処理も同じ考え方です。
        </p>
      </div>
    </main>
  );
}
