/**
 * 統合デモサイトのナビゲーション定義。
 *
 * **1 サイトに集約しつつ、メニューで区分を分ける**:
 * - 基盤デモ … `@platform/*` の使い方(この基盤で何ができるか)
 * - アプリデモ … 業務アプリの画面(実物ではなくモックデータでの再現)
 *
 * 実物のアプリは `apps/` に残っている。ここはあくまで「こういう画面が作れます」を
 * 見せるためのもので、**DB を持たない**(Amplify に単体でデプロイできる)。
 *
 * @packageDocumentation
 */
// NavItem(lib/nav)は href 必須。区分は href を持たず children だけなので、
// children を持てる NavDropdownItem を使う。
import type { NavDropdownItem } from "@platform/ui";

/** ナビの 1 区分。 */
export interface NavSection {
  /** 区分名(メニューの見出し)。 */
  title: string;
  /** 区分の説明(トップページに出す)。 */
  description: string;
  /** 区分内の項目。 */
  items: DemoEntry[];
}

/** デモ 1 件。 */
export interface DemoEntry {
  href: string;
  title: string;
  desc: string;
  /** 使っている基盤パッケージ(`@platform/` は省略)。 */
  packages: string[];
}

/** 基盤デモ: この基盤で何ができるかを見せる。 */
export const PLATFORM_DEMOS: DemoEntry[] = [
  { href: "/inquiries", title: "問い合わせフォーム", desc: "入力検証→受付→確認メール→一覧→Excel出力の縦一本",
    packages: ["validation", "ui", "http", "datetime", "mail", "xlsx"] },
  { href: "/register", title: "会員登録フォーム", desc: "zodスキーマ→型安全フォーム。郵便番号から住所を自動入力",
    packages: ["form", "validation", "ui", "address"] },
  { href: "/security", title: "暗号化と権限(RBAC)", desc: "機密データの暗号化/復号と、ロールごとの権限判定",
    packages: ["crypto", "auth"] },
  { href: "/session", title: "セッション / クッキー", desc: "封緘クッキーセッションでログイン→読み取り→ログアウト",
    packages: ["session", "ui"] },
  { href: "/ui", title: "UI コンポーネント", desc: "ボタン・入力・スライダー・コンボボックス・カルーセルなど共通部品",
    packages: ["ui"] },
  { href: "/components", title: "追加コンポーネント", desc: "DataTable・Steps・Toast・各種ダイアログ・テンキー・リッチテキストエディタ",
    packages: ["ui"] },
  { href: "/views", title: "表示切替 / ページネーション", desc: "カード/リスト/ブロック表示・ページネーション・トップに戻る",
    packages: ["ui"] },
  { href: "/theme", title: "テーマ機構(スキン)", desc: "11スキンの切り替え・全トークン表示・WCAGコントラスト検査",
    packages: ["theme", "ui", "color"] },
  { href: "/charts", title: "グラフ(チャート)", desc: "棒/積み上げ/折れ線/円/レーダー/散布/複合/ガント/ヒートマップ/ツリーマップ/ファネル",
    packages: ["ui"] },
  { href: "/board", title: "ダッシュボード", desc: "グリッドレイアウト・KPIカード・CSV/PNGエクスポート付きチャート",
    packages: ["ui", "csv"] },
  { href: "/live-dashboard", title: "ライブダッシュボード", desc: "DnD配置・レイアウト保存・ポーリング自動更新",
    packages: ["ui", "realtime"] },
  { href: "/ws", title: "WebSocketリアルタイム", desc: "実サーバ連携(pnpm ws:demo)・差分更新",
    packages: ["ui", "realtime"] },
  { href: "/dashboard", title: "集計ダッシュボード", desc: "KPI・ファネル・構成比・目標達成率",
    packages: ["ui", "analytics"] },
  { href: "/sheet", title: "表計算グリッド", desc: "セル編集・範囲選択・Excel貼り付け・仮想スクロール",
    packages: ["ui"] },
  { href: "/data-console", title: "データ管理画面", desc: "検索+外部フィルタ+ソート+ページャの完成形。一覧画面のコピー元",
    packages: ["ui"] },
  { href: "/calendar", title: "カレンダー / 予約", desc: "月表示・日表示・空き枠検索・リソース別表示",
    packages: ["ui", "booking", "datetime"] },
  { href: "/approval", title: "承認ワークフロー", desc: "申請→承認→差戻し。並列承認・代理承認・エスカレーション",
    packages: ["workflow", "ui"] },
  { href: "/expenses", title: "経費精算", desc: "領収書OCR→科目推定→申請→承認→仕訳",
    packages: ["accounting", "ocr", "ai", "ui"] },
  { href: "/invoice", title: "帳票(請求書)", desc: "消費税計算(税率別・内税/外税・インボイス)→ 印刷用HTML",
    packages: ["report", "invoice", "tax", "pdf"] },
  { href: "/receipt", title: "領収書スキャン", desc: "OCR→フィールド抽出→確信度表示→人の確認",
    packages: ["ocr", "ui", "confidence"] },
  { href: "/files", title: "アップロード / ダウンロード", desc: "進捗付きアップロード→検証→保存→ダウンロード",
    packages: ["upload", "storage", "ui"] },
  { href: "/image", title: "画像処理", desc: "リサイズ・切り抜き・モザイク・透かし(ブラウザ内で完結)",
    packages: ["image", "ui"] },
  { href: "/import-history", title: "取り込み履歴", desc: "CSV取り込み→検証→部分保存→ロールバック",
    packages: ["importer", "csv", "ui"] },
  { href: "/board", title: "掲示板", desc: "スレッド・返信・リアクション・添付",
    packages: ["board", "ui"] },
  { href: "/numbers", title: "数値ユーティリティ", desc: "丸め・統計・外れ値・回帰・時系列分解",
    packages: ["utils"] },
  { href: "/strings", title: "文字列ユーティリティ", desc: "全角半角・表示幅・マスク・類似度・和暦",
    packages: ["utils"] },
  { href: "/i18n", title: "多言語(i18n)", desc: "辞書の結合・名前空間・ロケール推定",
    packages: ["i18n", "ui"] },
  { href: "/recipients", title: "宛先管理", desc: "メール検証・CSV入出力・重複排除",
    packages: ["mail", "csv", "ui"] },
  { href: "/device", title: "端末・ブラウザ情報", desc: "OS・ブラウザ・画面・ネットワーク・ロケール・位置情報",
    packages: ["device", "mobile", "ui"] },
  { href: "/bluetooth", title: "Bluetooth(BLE)", desc: "レシートプリンタ印刷・イヤホン電池/機器情報",
    packages: ["bluetooth", "print", "ui"] },
  { href: "/hid", title: "PC周辺機器(WebHID)", desc: "HID機器に接続して入力レポート受信",
    packages: ["hid", "ui"] },
];

/** アプリデモ: 業務アプリの画面を再現(モックデータ・DB なし)。 */
export const APP_DEMOS: DemoEntry[] = [
  { href: "/apps/internal", title: "社内アプリ", desc: "経費・勤怠・タスク・FAQ・契約を1つに束ねた社内ポータル",
    packages: ["auth", "accounting", "task", "faq", "contract"] },
  { href: "/apps/equipment", title: "備品管理", desc: "備品の貸出・返却・棚卸し。QRコードで現物と紐づけ",
    packages: ["inventory", "ui"] },
  { href: "/apps/site", title: "公開サイト", desc: "ブログ・お知らせ・問い合わせ。CMSで運用",
    packages: ["cms", "blog", "seo", "site"] },
  { href: "/apps/crud", title: "CRUDテンプレート", desc: "新しいアプリを作るときのコピー元。一覧・詳細・作成・編集・削除",
    packages: ["db", "ui", "form"] },
  { href: "/apps/portal", title: "基盤ポータル", desc: "107パッケージを検索・依存関係・API リファレンス",
    packages: ["search", "ui"] },
];

/** 使用例: 画面を持たない、コードで見せるデモ。 */
export const CODE_EXAMPLES: DemoEntry[] = [
  { href: "/examples/workplace-ops", title: "情シスの朝の30秒", desc: "タスク・契約・FAQ を横断して「今やるべきこと」を出す",
    packages: ["task", "contract", "faq"] },
  { href: "/examples/accounting-sync", title: "会計連携", desc: "仕訳を freee へ同期。冪等キーで二重登録を防ぐ",
    packages: ["accounting", "freee"] },
  { href: "/examples/notify-channels", title: "通知の使い分け", desc: "メール・Slack・LINE・SMS を1つのAPIで",
    packages: ["notify"] },
  { href: "/examples/loadtest-scenarios", title: "負荷試験", desc: "シナリオを組んで p95 を測る",
    packages: ["loadtest"] },
  { href: "/examples/board-threads", title: "掲示板ロジック", desc: "スレッドの並べ替え・未読・メンション",
    packages: ["board"] },
  { href: "/examples/chat-room", title: "チャットロジック", desc: "未読数・メンション・ピン留め",
    packages: ["chat"] },
  { href: "/examples/blueprint-workflow", title: "ブループリント", desc: "業務プロセスを状態と遷移で宣言的に定義",
    packages: ["blueprint", "fsm"] },
  { href: "/examples/payslip-pdf", title: "給与明細PDF", desc: "割増計算→明細→印刷用HTML",
    packages: ["payroll", "report", "pdf"] },
  { href: "/examples/cast-site", title: "キャスト紹介", desc: "評価の重み付け・タグ検索・プロフィール",
    packages: ["cast"] },
];

/** サイト全体の区分。 */
export const SECTIONS: NavSection[] = [
  {
    title: "基盤デモ",
    description: "この基盤(@platform/*)で何ができるかを、動く画面で見せます。",
    items: PLATFORM_DEMOS,
  },
  {
    title: "アプリデモ",
    description: "業務アプリの画面です。実物は apps/ にあり、ここではモックデータで再現しています。",
    items: APP_DEMOS,
  },
  {
    title: "使用例",
    description: "画面を持たない、コードで見せるデモです。",
    items: CODE_EXAMPLES,
  },
];

/**
 * サイドバー用のナビ項目を作る。
 *
 * **区分ごとに入れ子にする**ので、メニュー上は分かれて見える(1 サイトだが、
 * 利用者には「基盤デモ」「アプリデモ」が別物として映る)。
 *
 * @returns ナビ項目(入れ子)
 */
export function buildNavItems(): NavDropdownItem[] {
  return SECTIONS.map((section) => ({
    label: section.title,
    children: section.items.map((item) => ({ label: item.title, href: item.href })),
  }));
}

/**
 * ヘッダ用のナビ項目を作る(区分だけ)。
 *
 * @returns 区分へのリンク
 */
export function buildHeaderItems(): NavDropdownItem[] {
  return [
    { label: "ホーム", href: "/" },
    ...SECTIONS.map((section) => ({
      label: section.title,
      href: `/#${encodeURIComponent(section.title)}`,
    })),
  ];
}

/**
 * 全デモを平坦に返す(検索・件数表示用)。
 *
 * @returns すべてのデモ
 */
export function allDemos(): DemoEntry[] {
  return SECTIONS.flatMap((s) => s.items);
}
