"use client";
/**
 * ソースコードをシンタックスハイライト付きで表示する部品。
 * 行番号・言語ラベル・コピーボタン付き。ハイライトは軽量な自前トークナイザ（JS/TS 系）。
 */
import * as React from "react";
import { Button } from "@platform/ui";

const KW = new Set(["const", "let", "var", "function", "return", "if", "else", "for", "while", "do", "switch", "case", "break", "continue", "import", "export", "from", "default", "async", "await", "new", "class", "extends", "implements", "type", "interface", "enum", "of", "in", "typeof", "instanceof", "true", "false", "null", "undefined", "this", "super", "try", "catch", "finally", "throw", "yield", "void", "as", "readonly", "static", "public", "private"]);
type Tok = { t: "comment" | "string" | "keyword" | "number" | "plain"; v: string };

function tokenizeLine(code: string): Tok[] {
  const re = /(\/\/[^\n]*)|(`(?:\\.|[^`\\])*`|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')|(\b\d[\d_.eE]*\b)|([A-Za-z_$][A-Za-z0-9_$]*)/g;
  const out: Tok[] = [];
  let last = 0; let m: RegExpExecArray | null;
  while ((m = re.exec(code))) {
    if (m.index > last) out.push({ t: "plain", v: code.slice(last, m.index) });
    if (m[1]) out.push({ t: "comment", v: m[1] });
    else if (m[2]) out.push({ t: "string", v: m[2] });
    else if (m[3]) out.push({ t: "number", v: m[3] });
    else if (m[4]) out.push({ t: KW.has(m[4]) ? "keyword" : "plain", v: m[4] });
    last = re.lastIndex;
  }
  if (last < code.length) out.push({ t: "plain", v: code.slice(last) });
  return out;
}
const COLOR: Record<Tok["t"], string> = { comment: "#6b7280", string: "#c2410c", keyword: "#7c3aed", number: "#0891b2", plain: "inherit" };

export function CodeBlock({ code, lang = "ts" }: { code: string; lang?: string }) {
  const [copied, setCopied] = React.useState(false);
  const copy = async () => { try { await navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 1200); } catch { /* noop */ } };
  const lines = code.replace(/\n$/, "").split("\n");
  return (
    <div style={{ border: "1px solid var(--color-border)", borderRadius: "var(--radius)", overflow: "hidden", background: "var(--color-bg)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 12px", borderBottom: "1px solid var(--color-border)", background: "var(--color-surface)" }}>
        <span style={{ fontSize: 11, color: "var(--color-muted)", fontFamily: "monospace", textTransform: "uppercase" }}>{lang}</span>
        <Button type="button" onClick={copy} style={{ fontSize: 12, padding: "3px 10px", borderRadius: 6, cursor: "pointer", border: "1px solid var(--color-border)", background: "var(--color-bg)", color: copied ? "var(--color-success, #16a34a)" : "var(--color-fg)" }}>
          {copied ? "✓ コピー済" : "コピー"}
        </Button>
      </div>
      <pre style={{ margin: 0, overflowX: "auto", fontSize: 12.5, lineHeight: 1.7, fontFamily: "ui-monospace, monospace", padding: "10px 0" }}>
        <code>
          {lines.map((line, i) => (
            <div key={i} style={{ display: "flex", paddingRight: 12 }}>
              <span style={{ width: 40, flexShrink: 0, textAlign: "right", paddingRight: 12, color: "var(--color-muted)", userSelect: "none", opacity: 0.6 }}>{i + 1}</span>
              <span style={{ whiteSpace: "pre" }}>{tokenizeLine(line).map((tok, j) => (<span key={j} style={{ color: COLOR[tok.t] }}>{tok.v}</span>))}</span>
            </div>
          ))}
        </code>
      </pre>
    </div>
  );
}
