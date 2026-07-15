/**
 * 社内アプリのヘルプ・チャットボット（ルールベース）。質問のキーワードに最も一致する回答を、
 * 関連画面へのリンクつきで返す。外部 AI は不要な決定的な応答。
 * @packageDocumentation
 */

/** 関連リンク。 */
export interface BotLink {
  label: string;
  href: string;
}

/** ボットの回答。 */
export interface BotReply {
  reply: string;
  links: BotLink[];
  /** 一致したトピックの id（一致しなければ "fallback"）。 */
  topic: string;
  /** 有人対応（問い合わせ）への誘導が必要か。未一致、または担当者を求める質問で true。 */
  escalate: boolean;
}

interface KnowledgeItem {
  topic: string;
  keywords: string[];
  reply: string;
  links: BotLink[];
}

/** ナレッジベース。 */
export const KNOWLEDGE: KnowledgeItem[] = [
  { topic: "invoice", keywords: ["請求", "請求書", "invoice", "入金", "売掛"], reply: "請求書は「請求」画面で作成し、発行・入金記録・督促ができます。売掛の一覧やエイジングもここで確認できます。", links: [{ label: "請求", href: "/invoices" }, { label: "売掛金", href: "/receivables" }] },
  { topic: "purchase", keywords: ["発注", "仕入", "purchase", "買掛", "支払"], reply: "発注は「発注」画面で作成できます。支払や買掛の管理は買掛画面で行います。", links: [{ label: "発注", href: "/purchase-orders" }, { label: "買掛", href: "/payables" }] },
  { topic: "expense", keywords: ["経費", "立替", "expense", "精算"], reply: "経費は「経費」画面から登録できます。CSV での一括取込にも対応しています。", links: [{ label: "経費", href: "/expenses" }, { label: "経費CSV取込", href: "/expenses/import" }] },
  { topic: "approval", keywords: ["承認", "決裁", "申請", "ワークフロー", "approval"], reply: "発注・請求は金額に応じた多段承認が必要です。承認待ちは「承認」画面で確認・決裁できます。", links: [{ label: "承認", href: "/approvals" }] },
  { topic: "accounting", keywords: ["会計", "仕訳", "試算表", "元帳", "決算", "締め", "accounting"], reply: "会計画面で仕訳・試算表・勘定元帳を確認できます。決算整理仕訳の CSV 取込や締めロックも可能です。", links: [{ label: "会計", href: "/accounting" }, { label: "決算", href: "/closing" }] },
  { topic: "attendance", keywords: ["勤怠", "出勤", "打刻", "給与", "attendance", "payroll"], reply: "勤怠は「勤怠」画面で申請し、承認後に給与計算へ反映されます。", links: [{ label: "勤怠", href: "/attendance" }, { label: "給与", href: "/payroll" }] },
  { topic: "inventory", keywords: ["在庫", "商品", "入出庫", "inventory"], reply: "在庫は「在庫」画面で商品と入出庫を管理できます。", links: [{ label: "在庫", href: "/inventory" }] },
  { topic: "asset", keywords: ["固定資産", "減価償却", "除却", "売却", "asset"], reply: "固定資産は「固定資産」画面で取得・償却・除却/売却まで管理できます。", links: [{ label: "固定資産", href: "/assets" }] },
  { topic: "mailbox", keywords: ["受信箱", "メール", "通知", "連絡", "mailbox"], reply: "運用アラートや内部連絡は「受信箱」に届きます。内部メッセージの送信もできます。", links: [{ label: "受信箱", href: "/mailbox" }] },
  { topic: "partner", keywords: ["取引先", "得意先", "仕入先", "マスタ", "partner"], reply: "取引先は「取引先マスタ」で一元管理できます。残高照会や CSV での取込・書出にも対応します。", links: [{ label: "取引先", href: "/partners" }] },
];

const FALLBACK: BotReply = {
  reply: "うまく理解できませんでした。請求・発注・経費・承認・会計・勤怠・在庫・固定資産・取引先・受信箱などについてお尋ねください。",
  links: [{ label: "ダッシュボード", href: "/overview" }],
  topic: "fallback",
  escalate: true,
};

/** 質問文に最も一致するトピックの回答を返す。 */
/** 有人対応を明示的に求めるキーワード。 */
const ESCALATION_KEYWORDS = ["担当者", "オペレーター", "人につな", "人に繋", "問い合わせ", "電話", "有人"];

export function answer(question: string): BotReply {
  const q = (question ?? "").toLowerCase();
  let best: { item: KnowledgeItem; score: number } | undefined;
  for (const item of KNOWLEDGE) {
    let score = 0;
    for (const kw of item.keywords) if (q.includes(kw.toLowerCase())) score += 1;
    if (score > 0 && (!best || score > best.score)) best = { item, score };
  }
  const wantsHuman = ESCALATION_KEYWORDS.some((kw) => q.includes(kw.toLowerCase()));
  if (!best) return { ...FALLBACK, escalate: true };
  return { reply: best.item.reply, links: best.item.links, topic: best.item.topic, escalate: wantsHuman };
}
