"use client";
/**
 * Markdown の描画。
 *
 * 【なぜ HTML を作らないか】
 * `dangerouslySetInnerHTML` で流し込む作りが一般的だが、
 * **投稿は利用者が書いたもの**なので、変換のどこかに漏れがあれば
 * そのまま script が動く。ここでは**React 要素に組み立てる**ので、
 * 文字列が HTML として解釈される経路がそもそも無い。
 *
 * 【対応する記法を絞る】
 * 社内の掲示板・チャットで使う範囲に限る。
 * 全部入りにすると変換が複雑になり、**穴が生まれやすくなる**。
 *
 * | 記法 | 例 |
 * |---|---|
 * | 見出し | `# 見出し` 〜 `### 見出し` |
 * | 太字 | `**太字**` |
 * | 斜体 | `*斜体*` |
 * | 打ち消し | `~~打ち消し~~` |
 * | コード | `` `コード` `` |
 * | リンク | `[表示](https://…)` |
 * | 箇条書き | `- 項目` |
 * | 番号付き | `1. 項目` |
 * | 引用 | `> 引用` |
 * | コードブロック | ``` で囲む |
 * @packageDocumentation
 */
import * as React from "react";
import { cn } from "../lib/cn";

/** {@link Markdown} の props。 */
export interface MarkdownProps {
  /** 元の文字。 */
  children: string;
  className?: string;
}

/** 行内の記法 1 つ分。 */
type Inline = { kind: "text" | "bold" | "italic" | "strike" | "code"; text: string }
  | { kind: "link"; text: string; href: string };

/**
 * リンク先として許すか。
 *
 * **`javascript:` を弾く。** これを通すと、リンクを押しただけで
 * 任意のコードが動く(記法としては普通のリンクに見える)。
 */
function safeHref(href: string): string | null {
  const t = href.trim();
  if (/^https?:\/\//i.test(t)) return t;
  // 同じサイトの中への相対リンクは許す
  if (t.startsWith("/") && !t.startsWith("//")) return t;
  return null;
}

/** 行内の記法を解く。 */
function parseInline(src: string): Inline[] {
  const out: Inline[] = [];
  // **コードを先に取る。** `` `**a**` `` は太字にせず、そのまま出す
  const re = /(`[^`]+`)|(\*\*[^*]+\*\*)|(~~[^~]+~~)|(\*[^*]+\*)|(\[[^\]]+\]\([^)]+\))/;
  let rest = src;
  while (rest !== "") {
    const m = re.exec(rest);
    if (m === null || m.index === undefined) { out.push({ kind: "text", text: rest }); break; }
    if (m.index > 0) out.push({ kind: "text", text: rest.slice(0, m.index) });
    const tok = m[0];
    if (tok.startsWith("`")) out.push({ kind: "code", text: tok.slice(1, -1) });
    else if (tok.startsWith("**")) out.push({ kind: "bold", text: tok.slice(2, -2) });
    else if (tok.startsWith("~~")) out.push({ kind: "strike", text: tok.slice(2, -2) });
    else if (tok.startsWith("*")) out.push({ kind: "italic", text: tok.slice(1, -1) });
    else {
      const lm = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(tok);
      const href = lm === null ? null : safeHref(lm[2] ?? "");
      // **許せないリンクは文字として出す。** 消すと文意が変わる
      if (lm === null || href === null) out.push({ kind: "text", text: tok });
      else out.push({ kind: "link", text: lm[1] ?? "", href });
    }
    // **必ず進める。** `tok` が空だと同じ位置を延々と読み、
    // 画面が固まる。今の正規表現では起きないが、
    // 記法を足したときに `(...)?` のような書き方が混ざると起こりうる
    rest = rest.slice(m.index + Math.max(1, tok.length));
  }
  return out;
}

/** 行内の記法を React 要素にする。 */
function renderInline(parts: Inline[]): React.ReactNode[] {
  return parts.map((p, i) => {
    if (p.kind === "bold") return <strong key={i}>{p.text}</strong>;
    if (p.kind === "italic") return <em key={i}>{p.text}</em>;
    if (p.kind === "strike") return <s key={i}>{p.text}</s>;
    if (p.kind === "code") {
      return (
        <code key={i} className="rounded bg-[var(--color-subtle-strong)] px-1 py-0.5 text-[0.9em]">
          {p.text}
        </code>
      );
    }
    if (p.kind === "link") {
      return (
        // **外部リンクは別タブ。** 書きかけの投稿を失わせない。
        // `rel` を付けないと、開いた先から元のタブを操作できてしまう
        <a
          key={i}
          href={p.href}
          {...(p.href.startsWith("http") ? { target: "_blank", rel: "noopener noreferrer" } : {})}
          className="text-[var(--color-primary)] underline"
        >
          {p.text}
        </a>
      );
    }
    return <React.Fragment key={i}>{p.text}</React.Fragment>;
  });
}

/**
 * Markdown を描く。
 *
 * @param children 元の文字
 * @returns 見出し・箇条書き・強調などを反映した要素
 */
export function Markdown({ children, className }: MarkdownProps) {
  const blocks: React.ReactNode[] = [];
  const lines = children.replace(/\r\n/g, "\n").split("\n");
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    // **境界(`i < lines.length`)が非 undefined を保証する。** `!` は
    // ここでは安全(`packages/ui/src/lib/schedule.ts` と同じ慣習)。
    const line = lines[i]!;

    // コードブロック(``` で囲む)
    if (line.trimStart().startsWith("```")) {
      const body: string[] = [];
      i += 1;
      while (i < lines.length && !lines[i]!.trimStart().startsWith("```")) {
        body.push(lines[i]!);
        i += 1;
      }
      i += 1; // 閉じの ```
      blocks.push(
        <pre key={key++} className="overflow-x-auto rounded-[var(--radius)] bg-[var(--color-subtle-strong)] p-3 text-sm">
          <code>{body.join("\n")}</code>
        </pre>,
      );
      continue;
    }

    // 見出し
    const h = /^(#{1,3})\s+(.*)$/.exec(line);
    if (h !== null) {
      const level = (h[1] ?? "#").length;
      const size = level === 1 ? "text-lg" : level === 2 ? "text-base" : "text-sm";
      const Tag = (level === 1 ? "h2" : level === 2 ? "h3" : "h4") as "h2" | "h3" | "h4";
      // **見出しは h2 から始める。** 画面の見出し(h1)より下に置く
      blocks.push(<Tag key={key++} className={cn("mt-3 mb-1 font-semibold", size)}>{renderInline(parseInline(h[2] ?? ""))}</Tag>);
      i += 1;
      continue;
    }

    // 引用
    if (line.startsWith("> ")) {
      const body: string[] = [];
      while (i < lines.length && lines[i]!.startsWith("> ")) { body.push(lines[i]!.slice(2)); i += 1; }
      blocks.push(
        <blockquote key={key++} className="my-2 border-l-2 border-[var(--color-border)] pl-3 text-[var(--color-muted)]">
          {renderInline(parseInline(body.join(" ")))}
        </blockquote>,
      );
      continue;
    }

    // 箇条書き / 番号付き
    const bullet = /^\s*[-*]\s+(.*)$/.exec(line);
    const numbered = /^\s*\d+\.\s+(.*)$/.exec(line);
    if (bullet !== null || numbered !== null) {
      const ordered = numbered !== null;
      const items: string[] = [];
      while (i < lines.length) {
        const m = ordered ? /^\s*\d+\.\s+(.*)$/.exec(lines[i]!) : /^\s*[-*]\s+(.*)$/.exec(lines[i]!);
        if (m === null) break;
        items.push(m[1] ?? "");
        i += 1;
      }
      const Tag = ordered ? "ol" : "ul";
      blocks.push(
        <Tag key={key++} className={cn("my-2 ml-5 space-y-0.5", ordered ? "list-decimal" : "list-disc")}>
          {items.map((t, n) => <li key={n}>{renderInline(parseInline(t))}</li>)}
        </Tag>,
      );
      continue;
    }

    // 空行は段落の区切り
    if (line.trim() === "") { i += 1; continue; }

    // 段落(続く行はつなげる)
    const para: string[] = [];
    while (i < lines.length && lines[i]!.trim() !== ""
      && !/^(#{1,3}\s|>\s|\s*[-*]\s|\s*\d+\.\s)/.test(lines[i]!)
      && !lines[i]!.trimStart().startsWith("```")) {
      para.push(lines[i]!);
      i += 1;
    }
    blocks.push(<p key={key++} className="my-2 whitespace-pre-wrap">{renderInline(parseInline(para.join("\n")))}</p>);
  }

  return <div className={cn("text-sm leading-relaxed", className)}>{blocks}</div>;
}
