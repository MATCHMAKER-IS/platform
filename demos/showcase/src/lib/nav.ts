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
import type { NavItem } from "@platform/ui";

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
  /** 用途グループ(基盤デモの並べ替え・区切りに使う)。 */
  group?: string;
}

/** 基盤デモ: この基盤で何ができるかを見せる。 */
export const PLATFORM_DEMOS: DemoEntry[] = [
  // ── 見せる・可視化 ──
  { href: "/dashboard-grid", title: "ダッシュボード", desc: "グリッドレイアウト・KPIカード・CSV/PNGエクスポート付きチャート",
    packages: ["ui", "csv"] , group: "見せる・可視化" },
  { href: "/live-dashboard", title: "ライブダッシュボード", desc: "DnD配置・レイアウト保存・ポーリング自動更新",
    packages: ["ui", "realtime"] , group: "見せる・可視化" },
  { href: "/charts", title: "グラフ(チャート)", desc: "棒/積み上げ/折れ線/円/レーダー/散布/複合/ガント/ヒートマップ/ツリーマップ/ファネル",
    packages: ["ui"] , group: "見せる・可視化" },
  { href: "/sheet", title: "表計算グリッド", desc: "セル編集・範囲選択・Excel貼り付け・仮想スクロール",
    packages: ["ui"] , group: "見せる・可視化" },
  { href: "/data-console", title: "データ管理画面", desc: "検索+外部フィルタ+ソート+ページャの完成形。一覧画面のコピー元",
    packages: ["ui"] , group: "見せる・可視化" },
  { href: "/views", title: "表示切替 / ページネーション", desc: "カード/リスト/ブロック表示・ページネーション・トップに戻る",
    packages: ["ui"] , group: "見せる・可視化" },
  { href: "/ws", title: "WebSocketリアルタイム", desc: "実サーバ連携(pnpm ws:demo)・差分更新",
    packages: ["ui", "realtime"] , group: "見せる・可視化" },

  // ── 画面の部品 ──
  { href: "/ui", title: "UI コンポーネント", desc: "ボタン・入力・スライダー・コンボボックス・カルーセルなど共通部品",
    packages: ["ui"] , group: "画面の部品" },
  { href: "/components", title: "追加コンポーネント", desc: "DataTable・Steps・Toast・各種ダイアログ・テンキー・リッチテキストエディタ",
    packages: ["ui"] , group: "画面の部品" },
  { href: "/icons", title: "アイコン一覧", desc: "業務でよく使う100種類をカテゴリ別に。検索・サイズ変更・クリックでコピー",
    packages: ["ui"] , group: "画面の部品" },
  { href: "/theme", title: "テーマ機構(スキン)", desc: "ブランド色1色からスキン生成・11スキンの一括コントラスト検査・CSS/JSON入出力",
    packages: ["theme", "ui", "color"] , group: "画面の部品" },
  { href: "/widgets", title: "時計・タイマー・プロパティ", desc: "リアルタイム時計・カウントダウン・選択項目のプロパティ表示（インスペクタ）",
    packages: ["ui"], group: "画面の部品" },

  // ── 入力・フォーム ──
  { href: "/inquiries", title: "問い合わせフォーム", desc: "入力検証→受付→確認メール→一覧→Excel出力の縦一本",
    packages: ["validation", "ui", "http", "datetime", "mail", "xlsx"] , group: "入力・フォーム" },
  { href: "/validation", title: "入力バリデーション", desc: "全角で打っても通る・スマホのキーボード指定・IME変換中に弾かない",
    packages: ["validation", "ui"] , group: "入力・フォーム" },
  { href: "/register", title: "会員登録フォーム", desc: "zodスキーマ→型安全フォーム。郵便番号から住所を自動入力",
    packages: ["form", "validation", "ui", "address"] , group: "入力・フォーム" },
  { href: "/calendar", title: "カレンダー / 予約", desc: "月表示・日表示・空き枠検索・リソース別表示",
    packages: ["ui", "datetime"] , group: "入力・フォーム" },
  { href: "/files", title: "アップロード / ダウンロード", desc: "進捗付きアップロード→検証→保存→ダウンロード",
    packages: ["upload", "storage", "ui"] , group: "入力・フォーム" },
  { href: "/image", title: "画像処理", desc: "リサイズ・切り抜き・モザイク・透かし(ブラウザ内で完結)",
    packages: ["image", "ui"] , group: "入力・フォーム" },
  { href: "/receipt", title: "領収書スキャン", desc: "OCR→フィールド抽出→確信度表示→人の確認",
    packages: ["ocr", "ui"] , group: "入力・フォーム" },

  // ── 認証・セキュリティ ──
  { href: "/login", title: "ログイン画面", desc: "メール+パスワード(決め打ち)・ソーシャル(Google/Zoho)の認可URL組み立て",
    packages: ["ui", "google", "zoho"] , group: "認証・セキュリティ" },
  { href: "/session", title: "セッション / クッキー", desc: "総当たり対策(ロックが延びる)・放置ログアウト・重要操作の再認証・監査ログ",
    packages: ["session", "ui"] , group: "認証・セキュリティ" },
  { href: "/security", title: "暗号化と権限(RBAC)", desc: "機密データの暗号化/復号と、ロールごとの権限判定",
    packages: ["crypto", "auth"] , group: "認証・セキュリティ" },
  { href: "/ekyc", title: "eKYC(本人確認)", desc: "ベンダーごとに違う状態名を揃える・unknownは却下しない・webhookは500を返さない",
    packages: ["ekyc"] , group: "認証・セキュリティ" },
  { href: "/pii", title: "個人情報(PII)", desc: "マスキング・検索可能暗号(blind index)・匿名化(削除せず墓標を立てる)",
    packages: ["pii"] , group: "認証・セキュリティ" },
  { href: "/secrets", title: "シークレット管理", desc: "環境変数の直読みを避ける・TTLでローテーション追随・取得元の差し替え",
    packages: ["secrets", "pii"] , group: "認証・セキュリティ" },
  { href: "/apikey", title: "APIキー", desc: "平文は発行時のみ・DBはハッシュだけ・失効/期限切れ/未登録を区別しない認証",
    packages: ["apikey"] , group: "認証・セキュリティ" },
  { href: "/audit", title: "監査ログ", desc: "変更前後の差分抽出・redact/ignore・ハッシュチェーンで改ざん検知",
    packages: ["audit"] , group: "認証・セキュリティ" },

  // ── 業務ドメイン ──
  { href: "/quote", title: "見積 → 請求", desc: "有効期限・受注/失注・請求書への変換(金額が必ず一致する)",
    packages: ["quote", "invoice", "tax"] , group: "業務ドメイン" },
  { href: "/purchase", title: "発注・入荷", desc: "発注書の金額・分納・発注残・過剰入荷の検知",
    packages: ["purchase", "invoice"] , group: "業務ドメイン" },
  { href: "/invoice-builder", title: "請求書(適格請求書)", desc: "明細→税率別集計→インボイス。翌月末払い・入金ステータス・残額",
    packages: ["invoice", "tax"] , group: "業務ドメイン" },
  { href: "/invoice", title: "帳票(請求書)", desc: "消費税計算(税率別・内税/外税・インボイス)→ 印刷用HTML",
    packages: ["report", "tax", "print", "ui"] , group: "業務ドメイン" },
  { href: "/tax", title: "消費税・インボイス", desc: "税率ごとに区分した消費税額(適格請求書の必須要件)・端数処理・登録番号の検証",
    packages: ["tax"] , group: "業務ドメイン" },
  { href: "/dencho", title: "電子帳簿保存法", desc: "ハッシュチェーンで改ざん検知・検索要件・保存期間・タイムスタンプ",
    packages: ["dencho"] , group: "業務ドメイン" },
  { href: "/zengin", title: "全銀フォーマット(総合振込)", desc: "銀行へ渡す振込データ生成。半角カナ変換・件数/合計の自動集計・CRLF",
    packages: ["zengin"] , group: "業務ドメイン" },
  { href: "/depreciation", title: "減価償却", desc: "定額法/定率法のスケジュール・償却率・備忘価額",
    packages: ["depreciation"] , group: "業務ドメイン" },
  { href: "/sequence", title: "採番(伝票番号)", desc: "接頭辞・ゼロ埋め・年度/年/月でのリセット",
    packages: ["sequence"] , group: "業務ドメイン" },
  { href: "/inventory", title: "在庫", desc: "履歴から現在庫を導出・発注点・在庫を超える出庫は拒否",
    packages: ["inventory"] , group: "業務ドメイン" },
  { href: "/elearning", title: "社内研修(e-learning)", desc: "進捗は時間で重み付け・クイズ採点(部分点なし)・未修了なら修了証を出さない",
    packages: ["elearning"] , group: "業務ドメイン" },
  { href: "/expenses", title: "経費精算", desc: "領収書OCR(和暦・全角)→科目推定→仕訳(決済方法で貸方が変わる)→月次損益",
    packages: ["accounting", "ocr", "report", "xlsx", "ui"] , group: "業務ドメイン" },
  { href: "/fsm", title: "ステートマシン", desc: "遷移表が仕様。承認前の支払いなど「あり得ない操作」をロジックが拒否",
    packages: ["fsm"] , group: "業務ドメイン" },
  { href: "/approval", title: "承認ワークフロー", desc: "申請→承認→差戻し。並列承認・代理承認・エスカレーション",
    packages: ["workflow", "ui"] , group: "業務ドメイン" },

  // ── AI 基盤 ──
  { href: "/ai", title: "AI Gateway", desc: "モデル差し替え・コスト集計・トークン上限・PIIマスク・フォールバック",
    packages: ["ai"] , group: "AI 基盤" },
  { href: "/rag", title: "RAG(社内文書検索)", desc: "チャンク分割→索引→権限つき検索→AIに渡す文脈の組み立て",
    packages: ["rag", "search", "ai"] , group: "AI 基盤" },
  { href: "/mcp", title: "MCPサーバ", desc: "社内システムをAIから呼べる道具として公開。JSON-RPCを実際に投げられる",
    packages: ["mcp"] , group: "AI 基盤" },

  // ── 運用 ──
  { href: "/status-page", title: "ステータスページ", desc: "メンテナンス判定(監視は通し管理者は操作可)・エラー画面の実物",
    packages: ["status-page"] , group: "運用" },
  { href: "/analytics", title: "利用分析", desc: "PV/訪問者/直帰率・人気ページ・参照元・時系列。個人情報を送らない設計",
    packages: ["analytics"] , group: "運用" },
  { href: "/cron", title: "定期実行(cron)", desc: "多重実行防止・分散ロック(2台でも1回)・統計。実際に押して試せる",
    packages: ["cron"] , group: "運用" },
  { href: "/flags", title: "フィーチャーフラグ", desc: "段階リリース・kill switch・allow/deny・A/B。同じ人は常に同じ結果",
    packages: ["flags"] , group: "運用" },
  { href: "/saga", title: "補償トランザクション(saga)", desc: "外部API混じりの処理で失敗したら逆順で打ち消す。打ち消しの失敗も追える",
    packages: ["saga"] , group: "運用" },
  { href: "/observability", title: "可観測性", desc: "サーキットブレーカー・メトリクス/アラート・冪等性(二重課金防止)・分散トレース",
    packages: ["observability"] , group: "運用" },
  { href: "/import-history", title: "CSV取り込み", desc: "行ごと検証→エラー行に理由→ドライラン→全件中止か部分適用→履歴→権限つき取消",
    packages: ["importer", "csv", "ui"] , group: "運用" },
  { href: "/recipients", title: "宛先管理", desc: "メール検証・CSV入出力・重複排除",
    packages: ["mail", "csv", "ui"] , group: "運用" },

  // ── コミュニケーション ──
  { href: "/chat", title: "チャット", desc: "ルーム・未読数・「ここから未読」・メンション・リアクション・ピン留め・返信",
    packages: ["chat"] , group: "コミュニケーション" },
  { href: "/cms", title: "CMS(記事管理)", desc: "版の差分(LCS)・版戻し・公開申請の承認・予約公開・タグ一括操作",
    packages: ["cms"] , group: "コミュニケーション" },
  { href: "/board-threads", title: "掲示板", desc: "スレッド・入れ子の返信・タグ・本文も含む検索・固定/施錠",
    packages: ["board"] , group: "コミュニケーション" },
  { href: "/i18n", title: "多言語(i18n)", desc: "辞書の結合・名前空間・ロケール推定",
    packages: ["i18n", "ui"] , group: "コミュニケーション" },

  // ── 外部サービス連携 ──
  { href: "/integrations", title: "外部サービス連携（ハブ）", desc: "freee/Google/Zohoの入口。共通の型付きHTTPクライアントとOAuthの流れ",
    packages: ["integrations"] , group: "外部サービス連携" },
  { href: "/freee", title: "freee会計", desc: "取引・証憑・振替伝票・人事労務。経費の仕訳をそのまま送る",
    packages: ["freee", "integrations"] , group: "外部サービス連携" },
  { href: "/google", title: "Google Workspace", desc: "Sheets/Calendar/Maps・OAuth認可URLのライブ生成",
    packages: ["google", "integrations"] , group: "外部サービス連携" },
  { href: "/zoho", title: "Zoho（14サービス）", desc: "CRM/Books/Deskほか・データセンター別ドメイン・認可URL生成",
    packages: ["zoho", "integrations"] , group: "外部サービス連携" },

  // ── ユーティリティ ──
  { href: "/line", title: "LINE連携", desc: "署名検証(必須)・webhookは壊れても500を返さない・ボタン付きメッセージ",
    packages: ["line"] , group: "ユーティリティ" },
  { href: "/social", title: "ソーシャル連携", desc: "URLの表記ゆれを吸収・ハンドル検証・シェアURL生成・投稿の重複除去",
    packages: ["social"] , group: "ユーティリティ" },
  { href: "/safe-html", title: "HTML/URLの安全な扱い", desc: "エスケープ・javascript:を弾く・偽装ドメインの見分け・全角の受け止め",
    packages: ["html", "url"] , group: "ユーティリティ" },
  { href: "/converters", title: "変換(電話/通貨/単位)", desc: "E.164・通貨ごとの小数桁と混在合算・坪/畳/ガロンの換算",
    packages: ["phone", "currency", "units"] , group: "ユーティリティ" },
  { href: "/numbers", title: "数値ユーティリティ", desc: "丸め・統計・外れ値・回帰・時系列分解",
    packages: ["utils"] , group: "ユーティリティ" },
  { href: "/strings", title: "文字列ユーティリティ", desc: "全角半角・表示幅・マスク・類似度・和暦",
    packages: ["utils"] , group: "ユーティリティ" },

  // ── デバイス ──
  { href: "/barcode", title: "QR・バーコード発行", desc: "備品ラベル・社員証・帳票埋め込み・TOTP。サーバでもブラウザでもSVG",
    packages: ["barcode", "mobile"] , group: "デバイス" },
  { href: "/device", title: "端末・ブラウザ情報", desc: "OS・ブラウザ・画面・ネットワーク・ロケール・位置情報",
    packages: ["device", "ui"] , group: "デバイス" },
  { href: "/bluetooth", title: "Bluetooth(BLE)", desc: "レシートプリンタ印刷・イヤホン電池/機器情報",
    packages: ["bluetooth", "print", "ui"] , group: "デバイス" },
  { href: "/hid", title: "PC周辺機器(WebHID)", desc: "バーコードリーダー・テンキー・カードリーダーの読み取り",
    packages: ["hid", "ui"] , group: "デバイス" },
];

/** アプリデモ: 業務アプリの画面を再現(モックデータ・DB なし)。 */
export const APP_DEMOS: DemoEntry[] = [
  { href: "/apps/internal", title: "社内アプリ", desc: "経費・勤怠・タスク・FAQ・契約を1つに束ねた社内ポータル",
    packages: ["auth", "accounting", "task", "faq", "contract"] },
  { href: "/apps/equipment", title: "備品管理", desc: "備品の貸出・返却・棚卸し。QRコードで現物と紐づけ",
    packages: ["inventory", "ui"] },
  { href: "/apps/cart", title: "ECカート", desc: "小計→割引→送料→税の順を守る計算。エリア別送料・クーポン上限・ポイント",
    packages: ["commerce", "tax"] },
  { href: "/apps/landing", title: "ランディングページ", desc: "ブロックの並び替えで作るLP。公開予約・期間つきお知らせ・重み付きバナー・SEO",
    packages: ["site", "seo"] },
  { href: "/apps/site", title: "公開サイト", desc: "ブログ+公式。予約公開・目次・関連記事・コメント・RSS/サイトマップ・slug",
    packages: ["blog", "seo"] },
  { href: "/apps/crud", title: "CRUDテンプレート", desc: "新しいアプリを作るときのコピー元。一覧・詳細・作成・編集・削除",
    packages: ["db", "ui", "form"] },
  { href: "/apps/portal", title: "基盤ポータル", desc: "全106パッケージを検索。開くと関数の説明・引数・戻り値が一覧で見える",
    packages: ["ui"] },
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
export function buildNavItems(): NavItem[] {
  return SECTIONS.map((section) => ({
    label: section.title,
    // 区分自体もリンクにする(トップの該当セクションへ)。buildHeaderItems と同じ形。
    // NavItem.href は必須。省略すると tsc が落ちる(Amplify で実際に落ちた)。
    href: `/#${encodeURIComponent(section.title)}`,
    children: section.items.map((item) => ({ label: item.title, href: item.href })),
  }));
}

/**
 * ヘッダ用のナビ項目を作る(区分だけ)。
 *
 * @returns 区分へのリンク
 */
export function buildHeaderItems(): NavItem[] {
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
