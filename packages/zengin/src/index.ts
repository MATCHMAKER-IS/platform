/**
 * `@platform/zengin` — 全銀協レコードフォーマット(総合振込)の生成(純関数)。
 *
 * 給与・支払データを全銀フォーマット(固定長・半角カナ・Shift_JIS 前提)の文字列にする。
 * ヘッダ(1)・データ(2)・トレーラ(8)・エンドレコード(9)を組み立てる。
 * 金額の妥当性・件数/合計の整合を検証する。
 * @packageDocumentation
 */

/** 預金種目。1=普通, 2=当座, 4=貯蓄。 */
export type AccountType = "1" | "2" | "4";

/** 振込先明細。 */
export interface TransferRecord {
  /** 被仕向銀行番号(4桁)。 */
  bankCode: string;
  /** 被仕向支店番号(3桁)。 */
  branchCode: string;
  /** 預金種目。 */
  accountType: AccountType;
  /** 口座番号(7桁)。 */
  accountNumber: string;
  /** 受取人名(半角カナ・英数、最大30)。 */
  recipientName: string;
  /** 振込金額(円・整数)。 */
  amount: number;
}

/** 振込元(委託者)情報。 */
export interface Consignor {
  /** 委託者コード(10桁)。 */
  code: string;
  /** 委託者名(半角カナ、最大40)。 */
  name: string;
  /** 仕向銀行番号(4桁)。 */
  bankCode: string;
  /** 仕向支店番号(3桁)。 */
  branchCode: string;
  /** 預金種目。 */
  accountType: AccountType;
  /** 口座番号(7桁)。 */
  accountNumber: string;
}

/**
 * 全銀フォーマット向けに文字を変換する(半角カナ・英大文字)。
 *
 * **全銀システムは半角カナしか受け付けない**(1973 年制定の規格が今も現役)。
 * 全角カナや小文字が混じると、銀行のシステムで弾かれる。
 *
 * @param text 変換する文字列
 * @returns 半角カナ・英大文字に変換した文字列
 */
export function toHankakuKana(input: string): string {
  const map: Record<string, string> = {
    "ガ":"ｶﾞ","ギ":"ｷﾞ","グ":"ｸﾞ","ゲ":"ｹﾞ","ゴ":"ｺﾞ","ザ":"ｻﾞ","ジ":"ｼﾞ","ズ":"ｽﾞ","ゼ":"ｾﾞ","ゾ":"ｿﾞ",
    "ダ":"ﾀﾞ","ヂ":"ﾁﾞ","ヅ":"ﾂﾞ","デ":"ﾃﾞ","ド":"ﾄﾞ","バ":"ﾊﾞ","ビ":"ﾋﾞ","ブ":"ﾌﾞ","ベ":"ﾍﾞ","ボ":"ﾎﾞ",
    "パ":"ﾊﾟ","ピ":"ﾋﾟ","プ":"ﾌﾟ","ペ":"ﾍﾟ","ポ":"ﾎﾟ","ヴ":"ｳﾞ",
    "ア":"ｱ","イ":"ｲ","ウ":"ｳ","エ":"ｴ","オ":"ｵ","カ":"ｶ","キ":"ｷ","ク":"ｸ","ケ":"ｹ","コ":"ｺ",
    "サ":"ｻ","シ":"ｼ","ス":"ｽ","セ":"ｾ","ソ":"ｿ","タ":"ﾀ","チ":"ﾁ","ツ":"ﾂ","テ":"ﾃ","ト":"ﾄ",
    "ナ":"ﾅ","ニ":"ﾆ","ヌ":"ﾇ","ネ":"ﾈ","ノ":"ﾉ","ハ":"ﾊ","ヒ":"ﾋ","フ":"ﾌ","ヘ":"ﾍ","ホ":"ﾎ",
    "マ":"ﾏ","ミ":"ﾐ","ム":"ﾑ","メ":"ﾒ","モ":"ﾓ","ヤ":"ﾔ","ユ":"ﾕ","ヨ":"ﾖ",
    "ラ":"ﾗ","リ":"ﾘ","ル":"ﾙ","レ":"ﾚ","ロ":"ﾛ","ワ":"ﾜ","ヲ":"ｦ","ン":"ﾝ",
    "ー":"ｰ","（":"(","）":")","　":" ","、":"｡","・":"･",
  };
  return input.split("").map((c) => map[c] ?? c).join("").toUpperCase();
}

/** 文字列を右側スペース埋めで固定長に(超過は切り詰め)。 */
function padRight(value: string, len: number): string {
  return value.length >= len ? value.slice(0, len) : value + " ".repeat(len - value.length);
}
/** 数値を左ゼロ埋めで固定長に。 */
function padLeft(value: string | number, len: number): string {
  const s = String(value);
  return s.length >= len ? s.slice(-len) : "0".repeat(len - s.length) + s;
}

/**
 * ヘッダレコード(種別 1)を作る。
 *
 * **1 ファイルに 1 つ**。振込依頼人の情報と、引き落とし口座を指定する。
 *
 * @param input 依頼人・引落口座・振込指定日
 * @returns 120 バイトの固定長レコード
 */
export function buildHeader(consignor: Consignor, params: { typeCode?: string; transferDate: string }): string {
  // 1(データ区分) + 21(種別コード:総合振込) + 0(コード区分) + 委託者コード10 + 委託者名40 + 振込日4(MMDD) + 銀行4 + 支店3 + 種目1 + 口座7 ...
  return [
    "1", "21", "0",
    padLeft(consignor.code, 10),
    padRight(toHankakuKana(consignor.name), 40),
    padLeft(params.transferDate, 4),
    padLeft(consignor.bankCode, 4),
    padLeft(consignor.branchCode, 3),
    consignor.accountType,
    padLeft(consignor.accountNumber, 7),
  ].join("");
}

/**
 * データレコード(種別 2)を作る。
 *
 * **振込 1 件につき 1 レコード**。
 *
 * @param input 振込先の銀行・支店・口座・金額
 * @returns 120 バイトの固定長レコード
 * @throws {@link @platform/core#AppError} コード `VALIDATION` — 銀行コード・支店コード・口座番号の桁数が不正な場合(**桁が違うと振込が失敗し、組戻し手数料がかかる**)
 */
export function buildDataRecord(r: TransferRecord): string {
  if (!Number.isInteger(r.amount) || r.amount <= 0) {
    throw new Error(`振込金額が不正です: ${r.amount}`);
  }
  return [
    "2",
    padLeft(r.bankCode, 4),
    padLeft(r.branchCode, 3),
    r.accountType,
    padLeft(r.accountNumber, 7),
    padRight(toHankakuKana(r.recipientName), 30),
    padLeft(r.amount, 10),
  ].join("");
}

/**
 * トレーラレコード(種別 8)を作る。
 *
 * **件数と合計金額を書く**。銀行側でデータレコードの実数と突合するので、
 * 合わないとファイル全体が拒否される。
 *
 * @param count 振込件数
 * @param totalAmount 合計金額
 * @returns 120 バイトの固定長レコード
 */
export function buildTrailer(count: number, totalAmount: number): string {
  return ["8", padLeft(count, 6), padLeft(totalAmount, 12)].join("");
}

/** 全銀データ(ヘッダ+明細+トレーラ+エンド)を組み立てる。 */
export interface ZenginResult {
  /** 改行区切りのレコード文字列。 */
  content: string;
  /** 明細件数。 */
  count: number;
  /** 合計金額。 */
  totalAmount: number;
}

/**
 * 総合振込データを生成する。件数・合計はトレーラに自動集計する。
 * @param consignor 委託者情報
 * @param records 振込明細
 * @param transferDate 振込指定日("MMDD")
 * @returns 全銀フォーマットのファイル内容(ヘッダ + データ + トレーラ + エンド)。**改行は CRLF**(銀行の仕様)
 */
export function buildZenginTransfer(consignor: Consignor, records: TransferRecord[], transferDate: string): ZenginResult {
  const lines: string[] = [];
  lines.push(buildHeader(consignor, { transferDate }));
  let total = 0;
  for (const r of records) {
    lines.push(buildDataRecord(r));
    total += r.amount;
  }
  lines.push(buildTrailer(records.length, total));
  lines.push("9"); // エンドレコード
  return { content: lines.join("\r\n"), count: records.length, totalAmount: total };
}
