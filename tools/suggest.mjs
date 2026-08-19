/**
 * **やりたいことから、基盤にある機能を探す。**
 *
 * ```bash
 * pnpm suggest 経費の申請
 * pnpm suggest 電話番号 検証
 * pnpm suggest "Excel で出したい"
 * ```
 *
 * 【なぜ要るか】
 * **100 個を超えると、あることを知らずに作り直します。**
 * (**正確な数はここに書かない**——増えるたびに直す必要が出て、
 *  結局は古い数値が残る。実数は `pnpm suggest` の出力にある)
 *
 * 「郵便番号の検証を書こう」——**`@platform/validation` にあります**。
 * 「CSV の取り込みを書こう」——**`@platform/csv` と `@platform/importer` があります**。
 *
 * **探せないものは、無いのと同じ**です。
 *
 * 【どう探すか】
 * **README と公開関数の名前**を見ます。
 * README は 4 節構成（何のため / 落とし穴 / よく使うもの）なので、
 * **業務の言葉で書かれています**——「経費」「請求書」で当たります。
 *
 * 【限界】
 * **完全ではありません。** 見つからなくても「無い」とは限りません——
 * `docs/ai/module-list.md` を目で見るか、`pnpm dev:portal` で探してください。
 *
 * @packageDocumentation
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

/**
 * **業務の言葉と、パッケージの対応表。**
 *
 * 【なぜ手で書くか】
 * **README の本文を探しても当たりません。**
 * 「経費」は**ほぼ全ての README に例として出る**ので、
 * 本文を見ると**関係ないものが上位に来ます**
 * （実際、`faq` が「経費の申請」で 1 位になりました）。
 *
 * **業務の言葉は、機械には結び付けられません**——
 * 「精算」と `accounting` を繋ぐのは**人の知識**です。
 *
 * 【足してください】
 * **探して見つからなかったら、ここに足して**ください。
 * **次の人が同じことで迷いません**——それがこの表の価値です。
 */
const KEYWORD_MAP = {
  accounting: ["経費", "精算", "仕訳", "会計", "帳簿", "試算表", "勘定"],
  invoice: ["請求", "インボイス", "適格請求書", "登録番号"],
  quote: ["見積", "値引"],
  purchase: ["発注", "入荷", "仕入"],
  payroll: ["給与", "賞与", "社会保険", "源泉"],
  attendance: ["勤怠", "打刻", "残業", "有給", "休暇"],
  workflow: ["承認", "申請", "差し戻し", "決裁", "稟議"],
  inventory: ["在庫", "棚卸", "入出庫"],
  contract: ["契約", "更新", "解約"],
  depreciation: ["減価償却", "固定資産", "耐用年数"],
  tax: ["消費税", "税率", "軽減税率"],
  zengin: ["振込", "全銀", "銀行"],
  validation: ["法人番号", "マイナンバー", "検証", "チェックディジット"],
  address: ["住所", "郵便番号"],
  phone: ["電話", "携帯"],
  csv: ["CSV", "取り込み", "書き出し"],
  xlsx: ["Excel", "エクセル", "スプレッドシート"],
  pdf: ["PDF", "帳票", "印刷"],
  print: ["印刷", "ラベル"],
  mail: ["メール", "送信"],
  notify: ["通知", "知らせ"],
  line: ["LINE", "ライン"],
  slack: ["Slack", "スラック"],
  chat: ["チャット", "メッセージ"],
  board: ["掲示板", "スレッド"],
  search: ["検索", "全文検索"],
  ai: ["AI", "生成", "要約", "文章"],
  rag: ["社内文書", "規程", "ナレッジ"],
  ocr: ["読み取り", "領収書"],
  upload: ["アップロード", "添付", "ファイル"],
  storage: ["保管", "ストレージ"],
  auth: ["権限", "ロール"],
  session: ["ログイン", "認証", "SSO"],
  audit: ["監査", "履歴", "誰がやった"],
  booking: ["予約", "会議室", "設備"],
  task: ["タスク", "todo", "期限"],
  cms: ["お知らせ", "記事", "公開"],
  faq: ["FAQ", "よくある質問"],
  elearning: ["研修", "テスト", "受講"],
  sequence: ["採番", "連番", "伝票番号"],
  "access-review": ["棚卸", "権限の見直し", "退職者"],
  i18n: ["多言語", "翻訳", "外国"],
  loadtest: ["負荷", "遅い", "性能"],

  // ── ここから 2 回目に足した分（2026-08） ──
  analytics: ["利用状況", "アクセス", "画面速度", "統計"],
  apikey: ["APIキー", "外部システム", "トークン"],
  barcode: ["バーコード", "JAN", "ラベル印刷"],
  blog: ["ブログ", "記事", "コメント"],
  blueprint: ["業務フロー", "設計図", "状態遷移"],
  bluetooth: ["Bluetooth", "測定器", "無線"],
  bytes: ["base64", "バイト", "16進"],
  cache: ["キャッシュ", "速く", "再利用"],
  cast: ["出演者", "スタッフ", "プロフィール"],
  color: ["色", "コントラスト", "読みやすさ"],
  commerce: ["カート", "割引", "送料", "EC"],
  config: ["設定", "既定値"],
  context: ["追跡", "リクエストID", "文脈"],
  core: ["Result", "エラー", "共通"],
  cron: ["定期実行", "バッチ", "夜間"],
  crypto: ["パスワード", "ハッシュ", "暗号"],
  currency: ["通貨", "外貨", "丸め"],
  datetime: ["日付", "時刻", "JST", "営業日"],
  db: ["データベース", "クエリ", "索引", "トランザクション"],
  debug: ["調査", "デバッグ"],
  dencho: ["電子帳簿", "改ざん", "タイムスタンプ"],
  device: ["端末", "スマホ判定", "位置情報"],
  ekyc: ["本人確認", "免許証"],
  elearning: ["研修", "受講", "小テスト"],
  env: ["環境変数", "設定値"],
  faker: ["ダミー", "試験データ"],
  feed: ["RSS", "購読", "フィード"],
  flags: ["段階公開", "フラグ", "一部の人"],
  form: ["フォーム", "入力", "画面の検証"],
  freee: ["freee", "会計連携"],
  fs: ["ファイル種別", "拡張子"],
  fsm: ["状態", "遷移"],
  google: ["Google", "Drive", "Gmail", "スプレッドシート", "地図"],
  guard: ["認証の入口", "ログイン確認"],
  hid: ["バーコードリーダー", "カードリーダー"],
  html: ["HTML", "無害化", "エスケープ"],
  http: ["HTTP", "API呼び出し", "外部通信"],
  image: ["画像", "縮小", "回転", "EXIF"],
  importer: ["取り込み", "インポート"],
  integrations: ["外部連携", "APIクライアント"],
  jobs: ["非同期", "キュー", "重い処理"],
  json: ["JSON", "解析"],
  logger: ["ログ", "記録"],
  media: ["音声変換", "動画", "ffmpeg"],
  mcp: ["MCP", "AIに道具"],
  microsoft: ["Microsoft", "Teams", "Outlook", "Entra"],
  mobile: ["カメラ", "録音", "スマホ"],
  net: ["再試行", "待ち時間", "タイムアウト"],
  notion: ["Notion"],
  observability: ["監視", "計測", "追跡"],
  openapi: ["API 仕様", "OpenAPI", "別アプリから叩く", "外部連携の入口"],
  "os-notify": ["デスクトップ通知"],
  paypal: ["PayPal"],
  pii: ["個人情報", "伏せ字", "マスク"],
  push: ["プッシュ通知", "Web Push"],
  ratelimit: ["回数制限", "総当たり", "連打"],
  realtime: ["リアルタイム", "SSE", "即時"],
  report: ["帳票", "請求書の見た目", "金額表示"],
  rpa: ["自動化", "定型作業"],
  saga: ["打ち消し", "巻き戻し", "補償"],
  secrets: ["秘密", "鍵の管理"],
  security: ["CSP", "セキュリティ", "再送防止"],
  seo: ["検索エンジン", "robots", "サイトマップ"],
  site: ["ナビ", "パンくず"],
  sms: ["SMS", "ショートメール"],
  social: ["SNS", "ハンドル"],
  "status-page": ["障害告知", "稼働状況"],
  stripe: ["Stripe", "カード決済"],
  testing: ["テスト", "固定時刻"],
  theme: ["配色", "テーマ", "見た目"],
  ui: ["部品", "ボタン", "画面部品"],
  units: ["坪", "畳", "単位"],
  url: ["URL", "正規化"],
  utils: ["小さな道具", "整形", "配列"],
  "web-storage": ["ブラウザ保存", "localStorage"],
  webhook: ["Webhook", "署名検証"],
  xml: ["XML"],
  zoho: ["Zoho", "CRM", "顧客管理", "問い合わせ管理"],
};

/** 探す言葉。 */
const query = process.argv.slice(2).join(" ").trim();

if (query === "") {
  console.log("使い方: pnpm suggest <やりたいこと>");
  console.log("");
  console.log("例:");
  console.log("  pnpm suggest 経費の申請");
  console.log("  pnpm suggest 電話番号 検証");
  console.log("  pnpm suggest Excel で出したい");
  process.exit(0);
}

/**
 * 探すための語に分ける。
 *
 * **助詞を落とします**——「経費の申請」の「の」で当たっても意味がありません。
 * **2 文字未満も落とします**（「で」「を」が全部に当たります）。
 */
function terms(text) {
  return text
    .split(/[\s、。「」（）()]+/)
    // **分割した語と、元の語の両方を残します。**
    // 「遅い」を「遅」「い」に分けると、**どちらも短すぎて落ちます**
    // ——**元の語のままで当たることの方が多い**ためです（2026-08）。
    .flatMap((w) => [
      w,
      ...w.split(/(?<=[ぁ-んァ-ヴー])(?=[一-龠])|(?<=[一-龠])(?=[ぁ-ん])/),
    ])
    .map((w) => w.replace(/^(の|を|に|が|は|で|と|も|へ|から|まで)+/, ""))
    .map((w) => w.replace(/(の|を|に|が|は|で|と|も|へ|する|したい|ため)+$/, ""))
    .filter((w) => w.length >= 2);
}

const words = terms(query);
if (words.length === 0) {
  console.log(`「${query}」からは探す言葉が取り出せませんでした。`);
  console.log("**もう少し具体的に**書いてください（「経費」「郵便番号」など）。");
  process.exit(0);
}

/**
 * **showcase のどの画面が、そのパッケージを使っているか。**
 *
 * **見本があるなら、読むより見た方が早い**です——
 * **動くものを触れば、使い方がすぐ分かります**。
 *
 * @returns パッケージ名 → 画面のパス
 */
function collectDemos() {
  const map = new Map();
  const base = path.join(ROOT, "apps/showcase/src/app");
  if (!existsSync(base)) return map;

  const walk = (dir, top) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) {
        walk(p, top ?? e.name);
        continue;
      }
      if (!/\.tsx?$/.test(e.name) || top === undefined) continue;
      const src = readFileSync(p, "utf8");
      for (const m of src.matchAll(/@platform\/([a-z0-9-]+)/g)) {
        const set = map.get(m[1]) ?? new Set();
        set.add(top);
        map.set(m[1], set);
      }
    }
  };
  walk(base, undefined);
  return map;
}

const demos = collectDemos();

/** 1 パッケージ分の情報。 */
const packages = [];
for (const name of readdirSync(path.join(ROOT, "packages"))) {
  const readmePath = path.join(ROOT, "packages", name, "README.md");
  if (!existsSync(readmePath)) continue;
  const readme = readFileSync(readmePath, "utf8");

  // **公開関数の名前も見ます。** 「formatYen」で探す人もいるためです。
  let exports = "";
  const srcDir = path.join(ROOT, "packages", name, "src");
  if (existsSync(srcDir)) {
    for (const f of readdirSync(srcDir)) {
      if (!f.endsWith(".ts") || f.includes(".test.")) continue;
      const src = readFileSync(path.join(srcDir, f), "utf8");
      for (const m of src.matchAll(/export (?:async )?function (\w+)/g)) {
        exports += `${m[1]} `;
      }
    }
  }

  // **1 行目の説明**を取り出す（見出しの次の空行でない行）
  const lines = readme.split("\n");
  const summary = lines.find((l, i) => i > 0 && l.trim() !== "" && !l.startsWith("#")) ?? "";

  // **「これは何のためか」の節だけを見ます。**
  // 「使う前に知っておくこと」には**例文**が入っており
  // （「経費が承認されました」など）、**関係ないパッケージが当たります**
  // ——実際、`faq` が「経費の申請」で 1 位になりました（2026-08）。
  const purposeStart = readme.indexOf("## これは何のためか");
  const purposeEnd = readme.indexOf("## 使う前に知っておくこと");
  const purpose = purposeStart >= 0 && purposeEnd > purposeStart
    ? readme.slice(purposeStart, purposeEnd)
    : "";

  // **「よく使うもの」の import 例**を取り出します。
  // **見つけただけでは使えません**——**書き出しの 1 行**があると、
  // そのまま貼って始められます。
  const usageStart = readme.indexOf("## よく使うもの");
  let usage = "";
  if (usageStart >= 0) {
    const block = readme.slice(usageStart);
    const m = /import \{[^}]*\} from "@platform\/[^"]+";/.exec(block);
    usage = m === null ? "" : m[0];
  }

  packages.push({ name, readme, exports, purpose, usage, summary: summary.trim() });
}

/**
 * 点数を付ける。
 *
 * **どこに当たったかで重みを変えます**:
 * - **パッケージ名**（3 点）——`pnpm suggest csv` で `@platform/csv` が最上位に
 * - **1 行の説明**（2 点）——「これは何か」に当たったなら確かです
 * - 本文・関数名（1 点）
 */
const scored = packages
  .map((p) => {
    let score = 0;
    const hits = [];
    for (const w of words) {
      if (p.name.includes(w)) { score += 3; hits.push(w); continue; }
      // **業務の言葉の対応表。** README の本文より確かです
      if ((KEYWORD_MAP[p.name] ?? []).some((k) => k.includes(w) || w.includes(k))) {
        score += 3; hits.push(w); continue;
      }
      if (p.summary.includes(w)) { score += 2; hits.push(w); continue; }
      // **「これは何のためか」と関数名だけ**を見ます。
      // 本文全体を見ると、**落とし穴の例文で当たって**しまいます。
      if (p.purpose.includes(w) || p.exports.includes(w)) { score += 1; hits.push(w); }
    }
    return { ...p, score, hits: [...new Set(hits)] };
  })
  .filter((p) => p.score > 0)
  .sort((a, b) => b.score - a.score);

if (scored.length === 0) {
  console.log(`「${query}」に当たる基盤機能は見つかりませんでした。`);
  console.log("");
  console.log("**見つからなくても「無い」とは限りません**——");
  console.log("  docs/ai/module-list.md を目で見る");
  console.log("  pnpm dev:showcaseで探す");
  console.log("  別の言葉で探す（「経費」→「精算」「申請」）");
  process.exit(0);
}

console.log(`「${query}」に当たりそうな基盤機能:`);
console.log("");

// **上位 5 件まで。** 全部出すと**選べません**
for (const p of scored.slice(0, 5)) {
  console.log(`  @platform/${p.name}`);
  console.log(`    ${p.summary.replace(/\*\*/g, "").slice(0, 76)}`);
  console.log(`    当たった語: ${p.hits.join(" ")}`);
  if (p.usage !== "") console.log(`    ${p.usage}`);
  // **見本があるなら教える。** **読むより見た方が早い**ためです
  const shown = demos.get(p.name);
  if (shown !== undefined) {
    console.log(`    見本: pnpm dev:showcase → /${[...shown].slice(0, 2).join(" /")}`);
  }
  console.log(`    詳しく: packages/${p.name}/README.md`);
  console.log("");
}

if (scored.length > 5) {
  console.log(`  （他に ${scored.length - 5} 件あります。もう少し絞ってください）`);
  console.log("");
}

console.log("**使う前に README を読んでください**——");
console.log("「使う前に知っておくこと」に、**知らないと必ず踏む落とし穴**が書いてあります。");
