/**
 * ステータスページのテンプレート(依存ゼロ・自己完結 HTML)。
 * メンテナンス・システムエラー・サービス停止・404 の各画面を、外部 CSS/JS なしの
 * 単一 HTML 文字列として生成する。middleware・global-error・静的配信のいずれからも使える。
 * @packageDocumentation
 */

/** ページの見た目・文言の共通オプション。 */
export interface StatusPageOptions {
  /** ページ言語(既定 "ja")。html lang とテキスト方向に使う。 */
  lang?: string;
  /** 見出し。 */
  title: string;
  /** 本文(複数段落は配列で)。 */
  message: string | string[];
  /** ブランド名(ヘッダに小さく表示)。 */
  brand?: string;
  /** アクセントカラー(既定 #2563eb)。 */
  accent?: string;
  /** 参照 ID(エラー時の traceId 等。サポート問い合わせ用に表示)。 */
  referenceId?: string;
  /** 「トップへ戻る」等のリンク(ラベルと URL)。 */
  action?: { label: string; href: string };
  /** 再読み込みボタンを表示するか。 */
  showReload?: boolean;
  /** 追加の HTML(<head> 末尾。メタタグや noindex 等)。 */
  headExtra?: string;
  /** ページ下部の補足(お知らせの連絡先など)。 */
  footer?: string;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function paragraphs(message: string | string[]): string {
  const list = Array.isArray(message) ? message : [message];
  return list.map((p) => `<p>${escapeHtml(p)}</p>`).join("\n      ");
}

/**
 * 汎用ステータスページを HTML 文字列で生成する。
 * インライン CSS・レスポンシブ・ダークモード対応。外部リソースを一切読み込まない。
 *
 * @param content 画面の内容(タイトル・メッセージなど)
 * @returns HTML。**外部依存なし**(CSS もインライン。障害時に CDN が死んでいても表示できる)
 */
export function renderStatusPage(options: StatusPageOptions): string {
  const {
    lang = "ja", title, message, brand, accent = "#2563eb",
    referenceId, action, showReload = false, headExtra = "", footer,
  } = options;
  return `<!doctype html>
<html lang="${escapeHtml(lang)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${escapeHtml(title)}</title>
${headExtra}
<style>
  :root { --accent: ${escapeHtml(accent)}; --fg: #1f2937; --muted: #6b7280; --bg: #f9fafb; --card: #ffffff; --border: #e5e7eb; }
  @media (prefers-color-scheme: dark) { :root { --fg: #f3f4f6; --muted: #9ca3af; --bg: #0b0f19; --card: #111827; --border: #1f2937; } }
  * { box-sizing: border-box; }
  body { margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 1.5rem;
    font-family: system-ui, -apple-system, "Segoe UI", "Hiragino Kaku Gothic ProN", "Noto Sans JP", sans-serif;
    background: var(--bg); color: var(--fg); line-height: 1.7; }
  .card { background: var(--card); border: 1px solid var(--border); border-radius: 16px;
    max-width: 30rem; width: 100%; padding: 2.5rem 2rem; text-align: center;
    box-shadow: 0 1px 3px rgba(0,0,0,.06); }
  .brand { color: var(--muted); font-size: .8rem; letter-spacing: .04em; margin-bottom: 1.25rem; }
  .bar { width: 3rem; height: 4px; border-radius: 4px; background: var(--accent); margin: 0 auto 1.5rem; }
  h1 { font-size: 1.375rem; margin: 0 0 .75rem; }
  p { color: var(--muted); margin: .5rem 0; font-size: .95rem; }
  .ref { margin-top: 1.5rem; font-size: .8rem; color: var(--muted); }
  .ref code { background: var(--bg); border: 1px solid var(--border); border-radius: 6px; padding: .15rem .4rem; }
  .actions { margin-top: 1.75rem; display: flex; gap: .75rem; justify-content: center; flex-wrap: wrap; }
  a.btn, button.btn { display: inline-block; padding: .6rem 1.4rem; border-radius: 8px; font-size: .9rem;
    text-decoration: none; cursor: pointer; border: 1px solid var(--border); background: transparent; color: var(--fg); }
  a.primary, button.primary { background: var(--accent); border-color: var(--accent); color: #fff; }
  .footer { margin-top: 1.5rem; font-size: .8rem; color: var(--muted); }
</style>
</head>
<body>
  <main class="card" role="main">
    ${brand ? `<div class="brand">${escapeHtml(brand)}</div>` : ""}
    <div class="bar"></div>
    <h1>${escapeHtml(title)}</h1>
    <div>
      ${paragraphs(message)}
    </div>
    ${referenceId ? `<div class="ref">お問い合わせの際はこの ID をお伝えください: <code>${escapeHtml(referenceId)}</code></div>` : ""}
    ${(action || showReload) ? `<div class="actions">
      ${action ? `<a class="btn primary" href="${escapeHtml(action.href)}">${escapeHtml(action.label)}</a>` : ""}
      ${showReload ? `<button class="btn" onclick="location.reload()">再読み込み</button>` : ""}
    </div>` : ""}
    ${footer ? `<div class="footer">${escapeHtml(footer)}</div>` : ""}
  </main>
</body>
</html>`;
}

/**
 * メンテナンス画面のプリセット(503 相当)。
 *
 * **復旧予定を書く**(「しばらくお待ちください」だけでは、利用者は何度もリロードする)。
 *
 * @param options.until 復旧予定(任意)
 * @param options.message 追加のメッセージ
 * @returns 画面の内容
 */
export function renderMaintenancePage(options?: Partial<StatusPageOptions> & { estimatedRecovery?: string }): string {
  const msg: string[] = [
    "ただいまシステムメンテナンスを実施しています。",
    "ご不便をおかけしますが、しばらくたってから再度アクセスしてください。",
  ];
  if (options?.estimatedRecovery) msg.push(`復旧予定: ${options.estimatedRecovery}`);
  return renderStatusPage({
    title: "メンテナンス中", message: options?.message ?? msg,
    showReload: true, ...options,
  });
}

/**
 * システムエラー画面のプリセット(500 相当)。
 *
 * **参照 ID を出す**と、問い合わせを受けたときにログと突合できる
 * (「エラーが出ました」だけでは調べようがない)。
 *
 * @param options.referenceId 参照 ID(trace ID など)
 * @returns 画面の内容
 */
export function renderErrorPage(options?: Partial<StatusPageOptions>): string {
  return renderStatusPage({
    title: "システムエラー",
    message: options?.message ?? [
      "予期しないエラーが発生しました。",
      "時間をおいて再度お試しいただくか、管理者にお問い合わせください。",
    ],
    showReload: true, ...options,
  });
}

/**
 * サービス停止のプリセット(503・一時的な高負荷や障害)。
 *
 * **メンテナンスとは区別する**(こちらは意図しない停止)。
 *
 * @param options.message 追加のメッセージ
 * @returns 画面の内容
 */
export function renderServiceUnavailablePage(options?: Partial<StatusPageOptions>): string {
  return renderStatusPage({
    title: "ただいま混み合っています",
    message: options?.message ?? [
      "アクセスが集中しているか、一時的な障害が発生しています。",
      "少し時間をおいてから再度お試しください。",
    ],
    showReload: true, ...options,
  });
}

/**
 * 404 画面のプリセット。
 *
 * @param options.message 追加のメッセージ
 * @returns 画面の内容
 */
export function renderNotFoundPage(options?: Partial<StatusPageOptions>): string {
  return renderStatusPage({
    title: "ページが見つかりません",
    message: options?.message ?? ["お探しのページは移動または削除された可能性があります。"],
    action: options?.action ?? { label: "トップへ戻る", href: "/" },
    ...options,
  });
}
