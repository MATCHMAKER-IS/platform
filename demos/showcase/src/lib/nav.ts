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
  { href: "/charts", title: "グラフ(チャート)", desc: "棒/積み上げ/折れ線/円/レーダー/散布/複合/ガント/ヒートマップ/ツリーマップ/ファネル",
    packages: ["ui"] , group: "見せる・可視化" },
  { href: "/sheet", title: "表計算グリッド", desc: "セル編集・範囲選択・Excel貼り付け・仮想スクロール",
    packages: ["ui"] , group: "見せる・可視化" },
  { href: "/data-console", title: "データ一覧・表示切替", desc: "検索+外部フィルタ+ソート+ページャの完成形。一覧画面のコピー元",
    packages: ["ui"] , group: "見せる・可視化" },
  { href: "/ws", title: "WebSocketリアルタイム", desc: "差分更新で直近N点を保持・統計表示・サーバ不要の模擬モード付き",
    packages: ["ui", "realtime"] , group: "見せる・可視化" },

  // ── 画面の部品 ──
  { href: "/ui", title: "UI・コンポーネント", desc: "ボタン・入力・スライダー・コンボボックス・カルーセルなど共通部品",
    packages: ["ui"] , group: "画面の部品" },
  { href: "/icons", title: "アイコン一覧", desc: "業務でよく使う100種類をカテゴリ別に。検索・サイズ変更・クリックでコピー",
    packages: ["ui"] , group: "画面の部品" },
  { href: "/theme", title: "テーマ機構(スキン)", desc: "ブランド色1色からスキン生成・11スキンの一括コントラスト検査・CSS/JSON入出力",
    packages: ["theme", "ui", "color"] , group: "画面の部品" },
  { href: "/widgets", title: "時計・タイマー・プロパティ", desc: "リアルタイム時計・カウントダウン・選択項目のプロパティ表示（インスペクタ）",
    packages: ["ui"], group: "画面の部品" },

  { href: "/canvas", title: "自由配置キャンバス", desc: "6種類の形と色・文字を変えられる図形をドラッグ配置・位置を保存",
    packages: ["ui"], group: "画面の部品" },
  { href: "/kanban", title: "タスクボード(Kanban)", desc: "列間ドラッグ・追加/編集・WIP制限・期限の色分け・担当/キーワード絞り込み",
    packages: ["ui"], group: "画面の部品" },
  { href: "/code", title: "ソース表示・差分", desc: "強調表示/行番号/コピー・変更の比較(+緑/-ピンク・1列/左右)",
    packages: ["ui", "cms"], group: "画面の部品" },
  // ── 入力・フォーム ──
  { href: "/inquiries", title: "フォーム(問い合わせ/登録/検証)", desc: "入力検証→受付→確認メール→一覧→Excel出力の縦一本",
    packages: ["validation", "ui", "http", "datetime", "mail", "xlsx"] , group: "入力・フォーム" },
  { href: "/calendar", title: "日付ユーティリティ", desc: "和暦・年齢・営業日計算・祝日一覧・締め日・期間の営業日数を対話的に確認",
    packages: ["ui", "datetime"] , group: "入力・フォーム" },
  { href: "/files", title: "アップロード / ダウンロード", desc: "進捗付きアップロード→検証→保存→ダウンロード",
    packages: ["upload", "storage", "ui"] , group: "入力・フォーム" },
  { href: "/receipt", title: "領収書スキャン", desc: "OCR→フィールド抽出→確信度表示→人の確認",
    packages: ["ocr", "ui"] , group: "入力・フォーム" },

  { href: "/schedule", title: "スケジュール(月/週/日)", desc: "月・週・日・一覧の切替カレンダー・タスク/会議イベント・祝日表示",
    packages: ["ui", "datetime"], group: "入力・フォーム" },
  // ── 認証・セキュリティ ──
  { href: "/login", title: "ログイン・2要素認証", desc: "セッション管理・TOTP/予備コード・パスワード再設定(使い捨てリンク)",
    packages: ["ui", "google", "zoho"] , group: "認証・セキュリティ" },
  { href: "/security", title: "暗号化・パスワード・権限", desc: "AES-256-GCM/scryptを実行・権限昇格しないことの確認・セキュリティヘッダー",
    packages: ["crypto", "auth"] , group: "認証・セキュリティ" },
  { href: "/pii", title: "個人情報・本人確認", desc: "マスキング・検索可能暗号(blind index)・匿名化(削除せず墓標を立てる)",
    packages: ["pii"] , group: "認証・セキュリティ" },
  { href: "/secrets", title: "シークレット管理", desc: "環境変数の直読みを避ける・TTLでローテーション追随・取得元の差し替え",
    packages: ["secrets", "pii"] , group: "認証・セキュリティ" },
  { href: "/apikey", title: "APIキー", desc: "平文は発行時のみ・DBはハッシュだけ・失効/期限切れ/未登録を区別しない認証",
    packages: ["apikey"] , group: "認証・セキュリティ" },
  { href: "/audit", title: "監査・ガード", desc: "変更前後の差分抽出・redact/ignore・ハッシュチェーンで改ざん検知",
    packages: ["audit"] , group: "認証・セキュリティ" },

  // ── 業務ドメイン ──
  { href: "/quote", title: "見積・発注", desc: "有効期限・受注/失注・請求書への変換(金額が必ず一致する)",
    packages: ["quote", "invoice", "tax"] , group: "業務ドメイン" },
  { href: "/invoice", title: "請求・インボイス・税", desc: "消費税計算(税率別・内税/外税・インボイス)→ 印刷用HTML",
    packages: ["report", "tax", "print", "ui"] , group: "業務ドメイン" },
  { href: "/dencho", title: "電帳法・全銀", desc: "ハッシュチェーンで改ざん検知・検索要件・保存期間・タイムスタンプ",
    packages: ["dencho"] , group: "業務ドメイン" },
  { href: "/depreciation", title: "経理ユーティリティ(償却/採番)", desc: "定額法/定率法のスケジュール・償却率・備忘価額",
    packages: ["depreciation"] , group: "業務ドメイン" },
  { href: "/inventory", title: "在庫", desc: "履歴から現在庫を導出・発注点・在庫を超える出庫は拒否",
    packages: ["inventory"] , group: "業務ドメイン" },
  { href: "/elearning", title: "社内研修(e-learning)", desc: "進捗は時間で重み付け・クイズ採点(部分点なし)・未修了なら修了証を出さない",
    packages: ["elearning"] , group: "業務ドメイン" },
  { href: "/expenses", title: "経費精算", desc: "領収書OCR(和暦・全角)→科目推定→仕訳(決済方法で貸方が変わる)→月次損益",
    packages: ["accounting", "ocr", "report", "xlsx", "ui"] , group: "業務ドメイン" },
  { href: "/approval", title: "承認フロー・状態遷移", desc: "多段承認/金額ルーティング・FSM・Slackで承認(押した人の権限を確認)",
    packages: ["workflow", "fsm", "slack", "auth"] , group: "業務ドメイン" },

  { href: "/booking", title: "予約システム(空き枠)", desc: "スロット生成・空き枠計算・二重予約判定・受付期間/キャンセル期限を基盤関数で判定",
    packages: ["booking", "datetime"], group: "業務ドメイン" },

  { href: "/master", title: "マスタ管理(参照連携)", desc: "取引先マスタの一覧・検索・登録・編集・削除・localStorage保存",
    packages: ["ui"], group: "業務ドメイン" },
  { href: "/attendance", title: "勤怠・有給", desc: "打刻から残業/深夜/遅刻を集計し給与へ・法定付与と時効2年・年5日の取得義務",
    packages: ["attendance", "payroll"], group: "業務ドメイン" },
  // ── AI 基盤 ──
  { href: "/ai", title: "AI基盤(Gateway/RAG/MCP)", desc: "モデル差し替え・コスト集計・トークン上限・PIIマスク・フォールバック",
    packages: ["ai"] , group: "AI 基盤" },
  { href: "/assistant", title: "社内資料アシスタント(RAG)", desc: "資料を探す→文脈を組み立てる→AIゲートウェイ経由で回答・費用も記録",
    packages: ["rag", "search", "ai"], group: "AI 基盤" },
  { href: "/chatbot", title: "社内チャットボット", desc: "会話しながら資料を根拠に回答・毎回引き直し・履歴は直近のみ・鍵なしでも動く",
    packages: ["ui", "rag", "search", "ai"], group: "AI 基盤" },

  // ── 運用 ──
  { href: "/status-page", title: "ステータスページ", desc: "メンテナンス判定(監視は通し管理者は操作可)・エラー画面の実物",
    packages: ["status-page"] , group: "運用" },
  { href: "/flags", title: "機能フラグ・saga", desc: "段階リリース・kill switch・allow/deny・A/B。同じ人は常に同じ結果",
    packages: ["flags"] , group: "運用" },
  { href: "/observability", title: "分析・可観測性", desc: "サーキットブレーカー・メトリクス/アラート・冪等性(二重課金防止)・分散トレース",
    packages: ["observability"] , group: "運用" },
  { href: "/import-history", title: "取り込み・宛先管理", desc: "行ごと検証→エラー行に理由→ドライラン→全件中止か部分適用→履歴→権限つき取消",
    packages: ["importer", "csv", "ui"] , group: "運用" },

  { href: "/jobs", title: "定期・非同期実行(cron/キュー)", desc: "投入→ワーカー処理→待機/実行中/完了/失敗・最大3回リトライ",
    packages: ["jobs"], group: "運用" },
  { href: "/cache", title: "キャッシュ・レート制限", desc: "初回ミス→ヒット（即時）・TTL失効・ヒット率の可視化",
    packages: ["cache"], group: "運用" },
  { href: "/webhook", title: "Webhook受信", desc: "署名をWeb Cryptoで実検証・改ざん/リプレイ/重複配信を弾く3つの関門",
    packages: ["webhook"], group: "運用" },

  { href: "/rpa", title: "RPAランナー(安全実行)", desc: "冪等キー・ロック・リトライ・タイムアウト・監査をcreateRpaRunnerで実行",
    packages: ["rpa", "core"], group: "運用" },
  { href: "/logger", title: "構造化ログ", desc: "レベル/requestIdで追跡・password/email/phoneを自動マスク・console.logとの違い",
    packages: ["logger"], group: "運用" },
  { href: "/env", title: "環境変数の検証", desc: "zodスキーマでその場検証・.env.example自動生成・秘密情報の強度検査",
    packages: ["env"], group: "運用" },
  { href: "/error-pages", title: "システムエラー画面", desc: "404/500/503/メンテナンスの実画面をプレビュー・ブランド名や参照IDを反映",
    packages: ["status-page", "http"], group: "運用" },
  { href: "/faq", title: "よくある質問(FAQ)", desc: "この基盤についてのQ&A・作法/開発の進め方/運用をカテゴリ別に検索",
    packages: ["ui"], group: "運用" },
  // ── コミュニケーション ──
  { href: "/chat", title: "チャット・掲示板・SMS", desc: "ルーム・未読数・「ここから未読」・メンション・リアクション・ピン留め・返信",
    packages: ["chat"] , group: "コミュニケーション" },
  { href: "/cms", title: "記事管理・多言語", desc: "版の差分(LCS)・版戻し・公開申請の承認・予約公開・タグ一括操作",
    packages: ["cms"] , group: "コミュニケーション" },

  // ── 外部サービス連携 ──
  { href: "/integrations", title: "外部サービス連携（ハブ）", desc: "freee/Google/Zohoの入口。共通の型付きHTTPクライアントとOAuthの流れ",
    packages: ["integrations"] , group: "外部サービス連携" },
  { href: "/freee", title: "SaaS連携(freee/Google/Zoho)", desc: "取引・証憑・振替伝票・人事労務。経費の仕訳をそのまま送る",
    packages: ["freee", "integrations"] , group: "外部サービス連携" },

  { href: "/payments", title: "決済(Stripe/PayPal)", desc: "注文→確定→部分返金・冪等キーで二重課金防止・失敗ケース・イベント履歴",
    packages: ["stripe", "paypal"], group: "外部サービス連携" },
  { href: "/connect", title: "接続チェック(資格情報)", desc: "17サービス(Microsoft/Slack/Notion含む)の鍵と入手先・形式確認・疎通テスト",
    packages: ["integrations", "env", "secrets"], group: "外部サービス連携" },
  // ── ユーティリティ ──
  { href: "/line", title: "LINE連携", desc: "署名検証(必須)・webhookは壊れても500を返さない・ボタン付きメッセージ",
    packages: ["line"] , group: "ユーティリティ" },
  { href: "/safe-html", title: "安全なHTML・SNS", desc: "エスケープ・javascript:を弾く・偽装ドメインの見分け・全角の受け止め",
    packages: ["html", "url"] , group: "ユーティリティ" },

  { href: "/faker", title: "ダミーデータ生成", desc: "シード固定で再現可能な日本語ダミーデータ・CSV保存",
    packages: ["faker"], group: "ユーティリティ" },

  { href: "/media", title: "メディア処理(動画・音声)", desc: "選んだ動画のメタ情報とサムネイルをブラウザ内で生成・ffmpegコマンド対応表",
    packages: ["media"], group: "ユーティリティ" },
  { href: "/net", title: "ネットワークユーティリティ", desc: "URL組み立て・指数バックオフ・IP/CIDR判定を基盤関数で実行",
    packages: ["net"], group: "ユーティリティ" },
  { href: "/core", title: "coreの作法(Result/AppError)", desc: "成功/失敗を返すResult・構造化エラーAppError・ErrorCode。全デモの土台を実際に動かす",
    packages: ["core"], group: "ユーティリティ" },
  { href: "/utils", title: "ユーティリティ関数", desc: "変換(電話/通貨/単位)・数値/統計・文字列を1ページに統合(タブ切替)",
    packages: ["phone", "currency", "utils"], group: "ユーティリティ" },
  // ── デバイス ──
  { href: "/device", title: "デバイス連携・PWA", desc: "カメラ/Bluetooth/HID/バーコード・ホーム画面追加とオフライン(iOSの制約も)",
    packages: ["device", "mobile", "bluetooth", "hid"] , group: "デバイス" },
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
    description:
      "業務アプリの画面です。**5 つは apps/ にある実物の再現**（internal-app / equipment-app / " +
      "public-site / crud-template / platform-portal）で、DB なしで動くようモックデータに置き換えてあります。" +
      "コードは実物とは別で、画面の見え方と作りを掴むためのものです。" +
      "残る 2 つ（EC カート・ランディングページ）は apps/ に実物が無く、" +
      "「こういう画面も作れる」を示す見本です。",
    items: APP_DEMOS,
  },
  {
    title: "使用例",
    description:
      "**画面では見せられないもの**を、コードで見せます。" +
      "外部サービスの鍵と実データが要るもの（会計連携）、実行に時間がかかるもの（負荷試験）、" +
      "画面は別にあって組み立て方だけを見せたいもの（チャット・掲示板のロジック）が対象です。" +
      "各例には**注意点**を添えてあり、そちらが本体です" +
      "（例:「冪等キーで送信済みを判定する。バッチが再実行されても重複しない」）。",
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
