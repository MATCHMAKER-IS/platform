/**
 * URL リダイレクト(純ロジック)。
 * 旧 URL から新 URL への 301/302 リダイレクトルールを解決する。
 * 完全一致と、末尾ワイルドカード(/old/* → /new/:splat)に対応。サイトリニューアルで使う。
 * @packageDocumentation
 */

/** リダイレクトルール。 */
export interface RedirectRule {
  /** 対象パス。末尾 "*" でワイルドカード(以下すべて)。 */
  from: string;
  /** 転送先。":splat" にワイルドカード部分が入る。 */
  to: string;
  /** ステータス(既定 301=恒久)。 */
  status?: 301 | 302 | 307 | 308;
}

/** リダイレクト解決の結果。 */
export interface RedirectResult {
  to: string;
  status: 301 | 302 | 307 | 308;
}

/** パスの末尾スラッシュを除く(ルートは "/")。 */
function normalize(path: string): string {
  const p = path.split("?")[0]!.replace(/\/+$/, "");
  return p === "" ? "/" : p;
}

/**
 * パスに一致するリダイレクトを返す(先に定義したルールが優先)。無ければ null。
 * ワイルドカード: from "/blog/*" は "/blog/..." に一致し、末尾を to の :splat に差し込む。
 */
export function resolveRedirect(rules: RedirectRule[], path: string): RedirectResult | null {
  const target = normalize(path);
  for (const rule of rules) {
    const status = rule.status ?? 301;
    if (rule.from.endsWith("/*")) {
      const prefix = normalize(rule.from.slice(0, -2));
      if (target === prefix || target.startsWith(prefix + "/")) {
        const splat = target === prefix ? "" : target.slice(prefix.length + 1);
        return { to: rule.to.replace(":splat", splat).replace(/\/$/, "") || "/", status };
      }
    } else if (normalize(rule.from) === target) {
      return { to: rule.to, status };
    }
  }
  return null;
}

/** リダイレクトの連鎖を解決する(A→B→C を A→C に)。循環は maxHops で打ち切り。 */
export function resolveRedirectChain(rules: RedirectRule[], path: string, maxHops = 10): RedirectResult | null {
  let current = path;
  let last: RedirectResult | null = null;
  const seen = new Set<string>();
  for (let i = 0; i < maxHops; i++) {
    if (seen.has(current)) break; // 循環
    seen.add(current);
    const result = resolveRedirect(rules, current);
    if (!result) break;
    last = result;
    current = result.to;
  }
  return last;
}
