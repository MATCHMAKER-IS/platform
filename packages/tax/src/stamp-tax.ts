/**
 * 印紙税（収入印紙）の判定。
 *
 * **契約書や領収書を紙で作ると課税される**。貼り忘れると **過怠税**として
 * 本来の印紙税額の **3 倍**（自主的に申し出れば 1.1 倍）を取られる。
 *
 * 【最も重要な点：電子契約は課税されない】
 * 印紙税は「**文書の作成**」に対する税なので、PDF をメールで送るだけなら
 * 課税文書を作成したことにならない（国税庁の見解）。
 * **契約書 1 通あたり数万円が浮く**ため、電子契約に切り替える経済的な理由になる。
 *
 * ただし「電子で締結したものを印刷して押印」すると課税される。
 *
 * 【間違えやすい点】
 *   - **第 2 号（請負）と第 7 号（継続的取引）で税額が違う**。
 *     基本契約書は 4,000 円だが、個別の請負契約は金額に応じて上がる
 *   - **消費税額を区分記載していれば、税抜金額で判定できる**。
 *     「110 万円」と書くと 1,000 円だが、「本体 100 万円・消費税 10 万円」と
 *     書けば 200 円になる（**書き方だけで税額が変わる**）
 *   - 領収書は **5 万円未満なら非課税**
 *
 * 【import の仕方】
 * **`@platform/tax/stamp` から取る**（バレルには入れていない）。
 * 消費税の計算とは使う場面が違い、まとめると使わない側まで読み込むことになる。
 *
 * ```ts
 * import { stampTax } from "@platform/tax/stamp";
 * ```
 *
 * @packageDocumentation
 */

/** 課税文書の種類（主要なもの）。 */
export type DocumentType =
  /** 第 1 号: 不動産の譲渡・地上権の設定・消費貸借（金銭の貸借）など。 */
  | "transfer"
  /** 第 2 号: **請負に関する契約書**（工事・システム開発・保守など）。 */
  | "contract"
  /** 第 7 号: **継続的取引の基本となる契約書**（取引基本契約・業務委託基本契約）。 */
  | "basic-agreement"
  /** 第 17 号: **売上代金に係る金銭の受取書**（領収書）。 */
  | "receipt";

/** 判定の入力。 */
export interface StampTaxInput {
  /** 文書の種類。 */
  type: DocumentType;
  /**
   * 契約金額・受取金額（円）。
   *
   * **消費税を区分記載しているなら税抜金額**を渡す。
   * 「110 万円」とだけ書いた文書は税込で判定するため、税額が上がることがある。
   */
  amount: number;
  /**
   * 電子的に作成・交付したか。
   *
   * **true なら課税されない**（文書を作成していないため）。
   * ただし印刷して押印すると課税されるので、その場合は false。
   */
  electronic?: boolean;
}

/** 判定の結果。 */
export interface StampTaxResult {
  /** 印紙税額（円）。**電子なら 0**。 */
  tax: number;
  /** 課税文書か。 */
  taxable: boolean;
  /** なぜその額になったか。 */
  reason: string;
  /** 貼り忘れたときの過怠税（本来の 3 倍）。 */
  penaltyIfMissing: number;
}

/** 金額の段と税額。 */
interface Bracket {
  /** この金額まで（円。未満）。 */
  upTo: number;
  /** 税額（円）。 */
  tax: number;
}

/**
 * 第 2 号（請負に関する契約書）の税額表。
 *
 * **工事・システム開発・保守などの請負契約**。金額が上がるほど税額も上がる。
 */
const CONTRACT_BRACKETS: readonly Bracket[] = [
  { upTo: 10_000, tax: 0 },
  { upTo: 1_000_000, tax: 200 },
  { upTo: 2_000_000, tax: 400 },
  { upTo: 3_000_000, tax: 1_000 },
  { upTo: 5_000_000, tax: 2_000 },
  { upTo: 10_000_000, tax: 10_000 },
  { upTo: 50_000_000, tax: 20_000 },
  { upTo: 100_000_000, tax: 60_000 },
  { upTo: 500_000_000, tax: 100_000 },
  { upTo: 1_000_000_000, tax: 200_000 },
  { upTo: 5_000_000_000, tax: 400_000 },
  { upTo: Number.POSITIVE_INFINITY, tax: 600_000 },
];

/**
 * 第 1 号（不動産の譲渡・消費貸借など）の税額表。
 *
 * 第 2 号と似ているが**低額帯の刻みが違う**。
 */
const TRANSFER_BRACKETS: readonly Bracket[] = [
  { upTo: 10_000, tax: 0 },
  { upTo: 1_000_000, tax: 200 },
  { upTo: 5_000_000, tax: 400 },
  { upTo: 10_000_000, tax: 1_000 },
  { upTo: 50_000_000, tax: 2_000 },
  { upTo: 100_000_000, tax: 10_000 },
  { upTo: 500_000_000, tax: 20_000 },
  { upTo: 1_000_000_000, tax: 60_000 },
  { upTo: 5_000_000_000, tax: 100_000 },
  { upTo: 10_000_000_000, tax: 200_000 },
  { upTo: 50_000_000_000, tax: 400_000 },
  { upTo: Number.POSITIVE_INFINITY, tax: 600_000 },
];

/**
 * 第 17 号（領収書）の税額表。
 *
 * **5 万円未満は非課税**。ここを知らずに全部に貼ると無駄になる。
 */
const RECEIPT_BRACKETS: readonly Bracket[] = [
  { upTo: 50_000, tax: 0 },
  { upTo: 1_000_000, tax: 200 },
  { upTo: 2_000_000, tax: 400 },
  { upTo: 3_000_000, tax: 600 },
  { upTo: 5_000_000, tax: 1_000 },
  { upTo: 10_000_000, tax: 2_000 },
  { upTo: 20_000_000, tax: 4_000 },
  { upTo: 30_000_000, tax: 6_000 },
  { upTo: 50_000_000, tax: 10_000 },
  { upTo: 100_000_000, tax: 15_000 },
  { upTo: 200_000_000, tax: 20_000 },
  { upTo: 300_000_000, tax: 40_000 },
  { upTo: 500_000_000, tax: 60_000 },
  { upTo: 1_000_000_000, tax: 100_000 },
  { upTo: Number.POSITIVE_INFINITY, tax: 200_000 },
];

/** 第 7 号（継続的取引の基本となる契約書）は**金額によらず一律**。 */
const BASIC_AGREEMENT_TAX = 4_000;

/** 過怠税の倍率（貼り忘れが指摘された場合）。 */
export const PENALTY_MULTIPLIER = 3;

/** 表を引く。 */
function lookup(brackets: readonly Bracket[], amount: number): number {
  const a = Math.max(0, amount);
  return (brackets.find((b) => a < b.upTo) ?? brackets[brackets.length - 1]!).tax;
}

/**
 * 印紙税額を判定する。
 *
 * **電子的に作成・交付したものは課税されない**（文書を作成していないため）。
 * 契約書 1 通あたり数万円が浮くので、電子契約に切り替える経済的な理由になる。
 *
 * @param input 文書の種類・金額・電子かどうか
 * @returns 税額と、貼り忘れたときの過怠税
 *
 * @example
 * ```ts
 * // 1,000 万円のシステム開発契約（紙）
 * stampTax({ type: "contract", amount: 10_000_000 });
 * // → { tax: 20_000, penaltyIfMissing: 60_000 }
 *
 * // 同じ契約を電子で
 * stampTax({ type: "contract", amount: 10_000_000, electronic: true });
 * // → { tax: 0 }
 * ```
 */
export function stampTax(input: StampTaxInput): StampTaxResult {
  // **電子契約は課税されない。** ここが最も効く
  if (input.electronic === true) {
    return {
      tax: 0,
      taxable: false,
      reason: "電子的に作成・交付しているため課税文書に当たりません（印刷して押印すると課税されます）",
      penaltyIfMissing: 0,
    };
  }

  let tax: number;
  let reason: string;

  switch (input.type) {
    case "basic-agreement":
      // **金額によらず一律 4,000 円**。個別契約とは扱いが違う
      tax = BASIC_AGREEMENT_TAX;
      reason = "第 7 号（継続的取引の基本となる契約書）は金額によらず一律 4,000 円です";
      break;
    case "contract":
      tax = lookup(CONTRACT_BRACKETS, input.amount);
      reason = tax === 0
        ? "第 2 号（請負）で 1 万円未満のため非課税です"
        : `第 2 号（請負）で契約金額 ${input.amount.toLocaleString()} 円の段です`;
      break;
    case "transfer":
      tax = lookup(TRANSFER_BRACKETS, input.amount);
      reason = tax === 0
        ? "第 1 号で 1 万円未満のため非課税です"
        : `第 1 号で契約金額 ${input.amount.toLocaleString()} 円の段です`;
      break;
    case "receipt":
      tax = lookup(RECEIPT_BRACKETS, input.amount);
      // **5 万円未満は非課税**。知らずに貼ると無駄になる
      reason = tax === 0
        ? "領収書は 5 万円未満のため非課税です"
        : `第 17 号（領収書）で受取金額 ${input.amount.toLocaleString()} 円の段です`;
      break;
  }

  return { tax, taxable: tax > 0, reason, penaltyIfMissing: tax * PENALTY_MULTIPLIER };
}

/**
 * 電子化したときの節税額を求める。
 *
 * **紙で作るといくらかかり、電子ならいくら浮くか**を示す。
 * 電子契約の導入を検討するときの根拠になる。
 *
 * @param documents 年間に作成する文書（種類と金額と件数）
 * @returns 紙の場合の合計と、電子化で浮く額
 *
 * @example
 * ```ts
 * // 1,000 万円の契約を年 12 件
 * savingsByGoingElectronic([{ type: "contract", amount: 10_000_000, count: 12 }]);
 * // → { paperTotal: 240_000, savings: 240_000 }
 * ```
 */
export function savingsByGoingElectronic(
  documents: readonly { type: DocumentType; amount: number; count: number }[],
): { paperTotal: number; savings: number } {
  const paperTotal = documents.reduce(
    (sum, d) => sum + stampTax({ type: d.type, amount: d.amount }).tax * Math.max(0, d.count),
    0,
  );
  // 電子なら全額が浮く
  return { paperTotal, savings: paperTotal };
}

/**
 * 消費税の記載方法による税額の差を示す。
 *
 * **同じ取引でも、書き方だけで印紙税が変わる**。
 * 「110 万円」とだけ書くと税込で判定されるが、
 * 「本体 100 万円・消費税 10 万円」と区分記載すれば税抜で判定できる。
 *
 * @param netAmount 税抜金額（円）
 * @param taxAmount 消費税額（円）
 * @param type 文書の種類
 * @returns 区分記載した場合と、しなかった場合の税額
 *
 * @example
 * ```ts
 * // 税抜 999,999 円・消費税 99,999 円の請負契約
 * // 税抜なら 100 万円未満で 200 円、税込だと 100 万円を超えて 400 円
 * compareByTaxNotation(999_999, 99_999, "contract");
 * // → { withSeparateTax: 200, withoutSeparateTax: 400, difference: 200 }
 * // **金額の段をまたぐときだけ差が出る**（またがなければ 0）
 * ```
 */
export function compareByTaxNotation(
  netAmount: number,
  taxAmount: number,
  type: DocumentType,
): { withSeparateTax: number; withoutSeparateTax: number; difference: number } {
  const separate = stampTax({ type, amount: netAmount }).tax;
  const combined = stampTax({ type, amount: netAmount + taxAmount }).tax;
  return {
    withSeparateTax: separate,
    withoutSeparateTax: combined,
    difference: combined - separate,
  };
}
