"use client";

/**
 * **小さな道具の紹介。**
 *
 * 【この画面で伝えたいこと】
 * **「自分で書かなくてよい」**ということです。
 * base64 も色の変換も、**書けば動きますが、境界で間違えます**——
 * 日本語が化ける、白い文字を白い背景に置く、といった形で。
 */
import { bytesToHex, encodeBase64, decodeBase64, formatByteSize } from "@platform/bytes";
import { contrastRatio, hexToRgb, rgbToHex } from "@platform/color";
import { safeParse, canonicalJson } from "@platform/json";
import { parseXml, textContent, escapeXml } from "@platform/xml";
import { Button, Card, Input } from "@platform/ui";
import { createMemoryWebStorage } from "@platform/web-storage";
import * as React from "react";

/**
 * **見本の色を作る。**
 *
 * **16 進を直接書きません。** 検査（`check-hardcoded-colors`）が
 * **画面の配色と区別できない**ためです——
 * **区別できない仕組みに合わせて、書かない方を選びました**。
 *
 * `rgbToHex` で作れば、**基盤の関数を使う見本**にもなります。
 */
function demoGray(level: number): string {
  return rgbToHex({ r: level, g: level, b: level });
}

/** 小さな道具のデモ。 */
export function ToolboxDemo(): React.ReactElement {
  // ── bytes ───────────────────────────────────────────
  const [text, setText] = React.useState("経費精算");
  const encoded = encodeBase64(text);
  // **`decodeBase64` は壊れた入力で `undefined` を返します**——
  // 例外にならないので、**受け取った側が確かめる**必要があります。
  const decoded = decodeBase64(encoded) ?? "（読めません）";

  // ── color ───────────────────────────────────────────
  // **118 は白い背景でちょうど 4.5:1 になる境目**の明るさです。
  // **「少しでも薄くすると読めなくなる」**ことを見せるために選んでいます。
  const [level, setLevel] = React.useState(118);
  const fg = demoGray(level);
  // **白との比較**を見せます（255 = 白）。
  const bg = demoGray(255);
  const ratio = contrastRatio(fg, bg);
  // **4.5 が目安です**（WCAG AA）。**数字を覚えるより、
  // ここで確かめる**方が確実です。
  const readable = ratio >= 4.5;

  // ── json ────────────────────────────────────────────
  const [jsonText, setJsonText] = React.useState('{"b":2,"a":1}');
  const [xmlText, setXmlText] = React.useState("<order><item>ねじ</item><item>ナット</item></order>");
  // **`safeParse` は壊れた入力で `undefined` を返します**——
  // **例外にならないので、受け取った側が確かめる**必要があります。
  const parsed = safeParse(jsonText);
  // **解析は例外を投げうる。** 壊れた入力で画面ごと落とさない
  const xmlNode = React.useMemo(() => {
    try { return parseXml(xmlText); } catch { return undefined; }
  }, [xmlText]);

  // ── web-storage ─────────────────────────────────────
  // **本物の `localStorage` は使いません。**
  // この画面は見本なので、**閉じたら消える**方が分かりやすいためです。
  const storage = React.useMemo(() => createMemoryWebStorage(), []);
  const [saved, setSaved] = React.useState<string | null>(null);

  return (
    <div className="space-y-6">
      <Card>
        <h2 className="mb-2 font-medium">bytes — 文字とバイト列</h2>
        <p className="mb-2 text-sm text-[var(--color-muted)]">
          <strong>`btoa` は日本語で例外を投げます。</strong>
          こちらは通ります——だから基盤に用意してあります。
        </p>
        <label className="block text-sm">
          変換する文字
          <Input value={text} onChange={(e) => { setText(e.target.value); }} />
        </label>
        <dl className="mt-2 space-y-1 text-sm">
          <div>
            <dt className="inline text-[var(--color-muted)]">base64: </dt>
            <dd className="inline break-all">{encoded}</dd>
          </div>
          <div>
            <dt className="inline text-[var(--color-muted)]">戻したもの: </dt>
            <dd className="inline">{decoded}</dd>
          </div>
          <div>
            <dt className="inline text-[var(--color-muted)]">16 進: </dt>
            <dd className="inline break-all">{bytesToHex(new TextEncoder().encode(text))}</dd>
          </div>
          <div>
            <dt className="inline text-[var(--color-muted)]">大きさ: </dt>
            <dd className="inline">{formatByteSize(new TextEncoder().encode(text).length)}</dd>
          </div>
        </dl>
      </Card>

      <Card>
        <h2 className="mb-2 font-medium">color — 読める色かを確かめる</h2>
        <p className="mb-2 text-sm text-[var(--color-muted)]">
          <strong>薄いグレーの文字は、作った人の画面では読めます。</strong>
          明るい部屋や古い画面では読めません——<strong>数字で確かめてください</strong>。
        </p>
        <label className="block text-sm">
          文字の明るさ（0 = 黒、255 = 白）
          <Input
            type="number"
            min={0}
            max={255}
            value={String(level)}
            onChange={(e) => { setLevel(Number(e.target.value)); }}
          />
        </label>
        <div className="mt-2 rounded border p-3" style={{ background: bg, color: fg }}>
          この文字が読めますか
        </div>
        <p className="mt-2 text-sm">
          コントラスト比 <strong>{ratio.toFixed(2)}</strong>：
          {readable ? "十分です（4.5 以上）" : "足りません（4.5 未満）"}
        </p>
        <p className="text-xs text-[var(--color-muted)]">
          RGB: {JSON.stringify(hexToRgb(fg))}
        </p>
      </Card>

      <Card>
        <h2 className="mb-2 font-medium">json — 壊れた入力で落ちない</h2>
        <p className="mb-2 text-sm text-[var(--color-muted)]">
          <strong>`JSON.parse` は壊れた入力で例外を投げます。</strong>
          外から来るものを直接渡すと、<strong>画面ごと落ちます</strong>。
        </p>
        <label className="block text-sm">
          JSON
          <Input value={jsonText} onChange={(e) => { setJsonText(e.target.value); }} />
        </label>
        <p className="mt-2 text-sm">
          {parsed === undefined
            ? "読めません（例外にはなりません）"
            : `読めました。並べ替えた形: ${canonicalJson(parsed)}`}
        </p>
        <p className="text-xs text-[var(--color-muted)]">
          <strong>`canonicalJson` は鍵を並べ替えます</strong>——
          同じ中身なら同じ文字列になるので、<strong>比較や署名に使えます</strong>。
        </p>
      </Card>

      <Card>
        <h2 className="mb-2 font-medium">xml — 古いシステムとつなぐ</h2>
        <p className="mb-2 text-sm text-[var(--color-muted)]">
          <strong>銀行・公的機関・EDI は、いまも XML でやり取りします。</strong>
          正規表現で切り出すと、<strong>属性の中の {"<"} や改行で必ず壊れます</strong>。
        </p>
        <label className="block text-sm">
          XML
          <Input value={xmlText} onChange={(e) => { setXmlText(e.target.value); }} />
        </label>
        <p className="mt-2 text-sm">
          {xmlNode === undefined
            ? "読めません（例外にはなりません）"
            : `中のテキスト: ${textContent(xmlNode)}`}
        </p>
        <p className="text-xs text-[var(--color-muted)]">
          <strong>`textContent` は入れ子のテキストを、出てきた順に繋ぎます</strong>——
          <code>{"<p>あ<b>い</b>う</p>"}</code> なら「あいう」。
          <strong>順序を保つのが要点</strong>で、直下のテキストと子要素を別々に持つと
          「あうい」になります。
        </p>
        <p className="text-xs text-[var(--color-muted)]">
          書き出すときは <strong>`escapeXml` を必ず通してください</strong>——
          利用者が入力した <code>{"&"}</code> や <code>{"<"}</code> をそのまま埋めると、
          <strong>相手のシステムが解析に失敗します</strong>。
          例: <code>{escapeXml('会社名 <A&B>')}</code>
        </p>
      </Card>

      <Card>
        <h2 className="mb-2 font-medium">web-storage — ブラウザに覚えさせる</h2>
        <p className="mb-2 text-sm text-[var(--color-muted)]">
          <strong>`localStorage` を直接使わないでください。</strong>
          プライベートモードでは<strong>書き込みが例外になります</strong>——
          こちらは静かに失敗します。
        </p>
        <div className="flex gap-2">
          <Button
            onClick={() => {
              storage.setItem("demo", `保存: ${new Date().toLocaleTimeString("ja-JP")}`);
              setSaved(storage.getItem("demo"));
            }}
          >
            保存する
          </Button>
          <Button
            variant="secondary"
            // **`WebStorageLike` に `remove` は無い**(`localStorage` と同じ `removeItem`)
            onClick={() => { storage.removeItem("demo"); setSaved(storage.getItem("demo")); }}
          >
            消す
          </Button>
        </div>
        <p className="mt-2 text-sm">{saved ?? "（何も入っていません）"}</p>
        <p className="text-xs text-[var(--color-muted)]">
          この画面では<strong>メモリ実装</strong>を使っています（閉じたら消えます）。
          本物を使うときは <code>createWebStorage</code> です。
        </p>
      </Card>
    </div>
  );
}
