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
  /** 被仕向銀行名(カナ・任意)。多くの銀行は番号で名寄せするので省略できる。 */
  bankName?: string;
  /** 被仕向支店名(カナ・任意)。 */
  branchName?: string;
  /** 手形交換所番号(任意)。 */
  clearingHouseCode?: string;
  /** 新規コード(既定 `"0"`)。1=第 1 回、2=変更、0=その他。 */
  newCode?: string;
  /** 顧客コード 1(任意)。自社で振込を identifying するための番号。 */
  customerCode1?: string;
  /** 顧客コード 2(任意)。 */
  customerCode2?: string;
  /** 振込指定区分(既定 `"0"`)。7=テレ振込、8=文書振込。 */
  transferCategory?: string;
  /** 識別表示(既定 空白)。 */
  identification?: string;
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
  /** 仕向銀行名(カナ・任意)。多くの銀行は番号で名寄せするので省略できる。 */
  bankName?: string;
  /** 仕向支店名(カナ・任意)。 */
  branchName?: string;
}

/**
 * 全銀フォーマット向けに文字を変換する(半角カナ・英大文字)。
 *
 * **全銀システムは半角カナしか受け付けない**(1973 年制定の規格が今も現役)。
 * 全角カナや小文字が混じると、銀行のシステムで弾かれる。
 *
 * @param input 変換する文字列
 * @returns 半角カナ・英大文字に変換した文字列
 *
 * **変換できない文字はそのまま残ります**（例外は投げません）。
 * 全銀ファイルに入れる前に {@link toShiftJisBytes} を通すと、
 * **そこで初めて弾かれます**——**振込先名は半角カナのみ**です。
 */
export function toHankakuKana(input: string): string {
  const map: Record<string, string> = {
    "ガ":"ｶﾞ","ギ":"ｷﾞ","グ":"ｸﾞ","ゲ":"ｹﾞ","ゴ":"ｺﾞ","ザ":"ｻﾞ","ジ":"ｼﾞ","ズ":"ｽﾞ","ゼ":"ｾﾞ","ゾ":"ｿﾞ",
    "ダ":"ﾀﾞ","ヂ":"ﾁﾞ","ヅ":"ﾂﾞ","デ":"ﾃﾞ","ド":"ﾄﾞ","バ":"ﾊﾞ","ビ":"ﾋﾞ","ブ":"ﾌﾞ","ベ":"ﾍﾞ","ボ":"ﾎﾞ",
    "パ":"ﾊﾟ","ピ":"ﾋﾟ","プ":"ﾌﾟ","ペ":"ﾍﾟ","ポ":"ﾎﾟ","ヴ":"ｳﾞ",
    // **小書きカナ。** 2026-08 まで漏れており、「ｷｬﾉﾝ」「ｼｮｳｼﾞ」のような
    // 社名で**変換されずに残っていた**——全銀では使えない文字なので、
    // ファイル生成の直前まで気づけなかった
    "ァ":"ｧ","ィ":"ｨ","ゥ":"ｩ","ェ":"ｪ","ォ":"ｫ","ャ":"ｬ","ュ":"ｭ","ョ":"ｮ","ッ":"ｯ",
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
/**
 * 数値を左ゼロ埋めで固定長に。
 *
 * **桁があふれたら例外を投げる。黙って切り詰めない。**
 * 2026-08 まで `s.slice(-len)` で下位桁だけを残しており、
 * 合計金額 `1,234,567,890,123` が **`234,567,890,123` として銀行に届いていた**。
 * 銀行はトレーラの件数・金額を明細と突合するので通常は拒否されるが、
 * **桁あふれした値同士が偶然一致すれば誤った金額で処理される**。
 *
 * 右側(`padRight`)の切り詰めは名称欄などの表示上の都合なので従来どおり。
 * **数値は切り詰めた時点で別の数になる**ため扱いを分ける。
 */
function padLeft(value: string | number, len: number): string {
  const s = String(value);
  if (s.length > len) {
    // **`Error` を使う。** このパッケージは純ロジックで基盤に依存しない
    // (金額の検証も同じ方針)。呼び出し側が AppError へ包む
    throw new Error(`全銀ファイルの項目が ${len} 桁に収まりません(${s})`);
  }
  return s.length === len ? s : "0".repeat(len - s.length) + s;
}

/**
 * ヘッダレコード(種別 1)を作る。
 *
 * **1 ファイルに 1 つ**。振込依頼人の情報と、引き落とし口座を指定する。
 *
 * **種別コード(`typeCode`)は用途で変わる。** 既定は `"21"`(総合振込)。
 * **給与振込は `"11"`、賞与振込は `"12"`** で、**同じファイルに混ぜられない**
 * ——給与を総合振込で送ると、銀行によっては手数料区分が変わったり、
 * 受取人の通帳の摘要が「振込」ではなく「給与」にならない。
 *
 * `transferDate` は **MMDD**(取組日)。年は入らないので、
 * **年末年始をまたぐ処理では取り違えに注意**すること。
 *
 * @param consignor 依頼人（コード・名称・引落口座）
 * @param params.typeCode 種別コード（**省略時は総合振込**）
 * @param params.transferDate 振込指定日（MMDD）
 * @returns 120 バイトの固定長レコード
 * @throws 桁数に収まらない項目がある場合（**銀行に弾かれる前に気づけます**）
 */
export function buildHeader(consignor: Consignor, params: { typeCode?: string; transferDate: string }): string {
  // **全銀の標準は 120 桁の固定長。** 2026-08 まで 73 桁しか出ておらず、
  // **銀行が受け付けないファイル**になっていた(データレコードも同じ問題だった)。
  const line = [
    "1",                                                 // データ区分
    params.typeCode ?? "21",                             // 種別コード(21=総合振込)
    "0",                                                 // コード区分(0=JIS)
    padLeft(consignor.code, 10),                         // 委託者コード
    padRight(toHankakuKana(consignor.name), 40),         // 委託者名
    padLeft(params.transferDate, 4),                     // 取組日(MMDD)
    padLeft(consignor.bankCode, 4),                      // 仕向銀行番号
    padRight(toHankakuKana(consignor.bankName ?? ""), 15),   // 仕向銀行名(任意)
    padLeft(consignor.branchCode, 3),                    // 仕向支店番号
    padRight(toHankakuKana(consignor.branchName ?? ""), 15), // 仕向支店名(任意)
    consignor.accountType,                               // 預金種目
    padLeft(consignor.accountNumber, 7),                 // 口座番号
    " ".repeat(17),                                      // ダミー
  ].join("");
  if (line.length !== 120) {
    throw new Error(`ヘッダレコードが 120 桁になりません(${line.length} 桁)`);
  }
  return line;
}

/**
 * データレコード(種別 2)を作る。
 *
 * **振込 1 件につき 1 レコード**。
 *
 * @param r 振込先の銀行・支店・口座・金額
 * @returns 120 バイトの固定長レコード
 * @throws `Error` — 銀行コード・支店コード・口座番号・金額の桁数が不正な場合
 *   (**桁が違うと振込が失敗し、組戻し手数料がかかる**)。
 *   このパッケージは純ロジックで基盤に依存しないため `AppError` は使わない——
 *   呼び出し側が `AppError` へ包むこと
 */
export function buildDataRecord(r: TransferRecord): string {
  if (!Number.isInteger(r.amount) || r.amount <= 0) {
    throw new Error(`振込金額が不正です: ${r.amount}`);
  }
  // **全銀の標準は 120 桁の固定長。** 2026-08 まで主要項目だけを並べており
  // **55 桁しか出ていなかった**——TSDoc は「120 バイト」と書いていたのに実装が違い、
  // **銀行に持ち込んでも受け付けられない**ファイルができる。
  //
  // 桁の並びは全国銀行協会の標準に合わせた。**銀行名・支店名・手形交換所番号は
  // 任意項目**(省略時はスペース/ゼロ埋め)で、多くの銀行は番号で名寄せするため
  // 空でも通る。ただし**銀行ごとに差異がある**ので、初回は必ずテスト送信すること。
  const line = [
    "2",                                              // データ区分
    padLeft(r.bankCode, 4),                           // 被仕向銀行番号
    padRight(toHankakuKana(r.bankName ?? ""), 15),    // 被仕向銀行名(任意)
    padLeft(r.branchCode, 3),                         // 被仕向支店番号
    padRight(toHankakuKana(r.branchName ?? ""), 15),  // 被仕向支店名(任意)
    padRight(r.clearingHouseCode ?? "", 4),           // 手形交換所番号(任意)
    r.accountType,                                    // 預金種目
    padLeft(r.accountNumber, 7),                      // 口座番号
    padRight(toHankakuKana(r.recipientName), 30),     // 受取人名
    padLeft(r.amount, 10),                            // 振込金額
    r.newCode ?? "0",                                 // 新規コード
    padRight(r.customerCode1 ?? "", 10),              // 顧客コード 1
    padRight(r.customerCode2 ?? "", 10),              // 顧客コード 2
    r.transferCategory ?? "0",                        // 振込指定区分
    r.identification ?? " ",                          // 識別表示
    " ".repeat(7),                                    // ダミー
  ].join("");
  // **桁が合わなければ気づける。** 項目を足し引きしたときに崩れるのを防ぐ
  if (line.length !== 120) {
    throw new Error(`データレコードが 120 桁になりません(${line.length} 桁)。項目の桁数を確かめてください`);
  }
  return line;
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
 * @throws 件数や合計金額が桁数に収まらない場合
 */
export function buildTrailer(count: number, totalAmount: number): string {
  // **120 桁の固定長**(残りはダミーのスペース)。2026-08 まで 19 桁だった
  const line = ["8", padLeft(count, 6), padLeft(totalAmount, 12), " ".repeat(101)].join("");
  if (line.length !== 120) {
    throw new Error(`トレーラレコードが 120 桁になりません(${line.length} 桁)`);
  }
  return line;
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
/**
 * 全銀ファイルを **Shift_JIS のバイト列**にする。
 *
 * **文字列のままファイルに書かない。** JavaScript の文字列を既定の UTF-8 で
 * 書き出すと、**半角カナが 1 文字 3 バイト**になり——120 桁の行が 360 バイト近くになる
 * ——銀行のシステムは桁位置で項目を切り出すので、**まったく読めない**。
 *
 * 全銀で使う文字は **ASCII + 半角カナ + 空白**だけなので、
 * 外部ライブラリ無しで変換できる(半角カナは Shift_JIS でも 1 バイト)。
 *
 * **使えない文字が混ざっていたら例外を投げる。** 黙って `?` に置き換えると、
 * **受取人名が変わったまま振り込まれる**(別人の口座に入る、あるいは組戻しになる)。
 *
 * @param content {@link buildZenginTransfer} が返した文字列
 * @returns Shift_JIS のバイト列(そのままファイルに書ける)
 * @throws `Error` — 全銀で使えない文字(漢字・ひらがな・全角)が含まれる場合
 *
 * @example
 * ```ts
 * const { content } = buildZenginTransfer(consignor, records, params);
 * await fs.writeFile("furikomi.txt", toShiftJisBytes(content));
 * ```
 */
/**
 * 全銀で使えない文字が残っていないか調べる。
 *
 * **`toHankakuKana` は変換できない文字をそのまま残す。**
 * `ヶ` `ヵ` `々` `ゐ` `ゑ` `㈱` やひらがな・漢字は半角カナに対応がなく、
 * 通しても消えない——{@link toShiftJisBytes} で例外になるが、
 * **それはファイル生成の直前**で、どの受取人が原因かが分かりにくい。
 *
 * **登録の時点で通すこと。** 受取人名を保存する画面で弾けば、
 * 振込の当日に慌てずに済む。
 *
 * @param text 半角カナに変換した後の文字列
 * @returns 使えない文字の一覧(重複なし)。空なら問題なし
 *
 * @example
 * ```ts
 * const bad = findUnsupportedChars(toHankakuKana(name));
 * if (bad.length > 0) throw new Error(`受取人名に使えない文字: ${bad.join("")}`);
 * ```
 */
export function findUnsupportedChars(text: string): string[] {
  const bad = new Set<string>();
  for (const ch of text) {
    const cp = ch.codePointAt(0) ?? 0;
    const ok = cp === 0x0d || cp === 0x0a || (cp >= 0x20 && cp <= 0x7e) || (cp >= 0xff61 && cp <= 0xff9f);
    if (!ok) bad.add(ch);
  }
  return [...bad];
}

/**
 * 全銀ファイルの中身を **Shift_JIS のバイト列**にする。
 *
 * **銀行のシステムは Shift_JIS しか受け取りません。** UTF-8 で渡すと、
 * **カタカナが化けて振込先が読めなくなります**。
 *
 * **扱えるのは半角のみ**です——英数字・記号（`0x20`〜`0x7e`）と半角カナ。
 * 全角が混ざっていたら、**先に {@link toHankakuKana} を通してください**。
 *
 * 改行は **CRLF**（`0x0d 0x0a`）です。LF だけだと**銀行側で 1 行として読まれます**。
 *
 * @param content 全銀フォーマットの本文（**半角のみ**）
 * @returns Shift_JIS のバイト列
 * @throws 半角に変換できない文字が含まれる場合
 */
export function toShiftJisBytes(content: string): Uint8Array {
  const out: number[] = [];
  for (const ch of content) {
    const cp = ch.codePointAt(0) ?? 0;
    if (cp === 0x0d || cp === 0x0a || (cp >= 0x20 && cp <= 0x7e)) {
      // ASCII と改行はそのまま(円記号だけは 0x5c で送るのが慣行)
      out.push(cp);
    } else if (cp >= 0xff61 && cp <= 0xff9f) {
      // **半角カナ**(U+FF61〜U+FF9F)は Shift_JIS で 0xA1〜0xDF の 1 バイト
      out.push(cp - 0xff61 + 0xa1);
    } else {
      throw new Error(
        `全銀ファイルに使えない文字が含まれています: ${JSON.stringify(ch)}`
        + "(半角カナ・英数字・記号のみ。toHankakuKana を通してください)",
      );
    }
  }
  return Uint8Array.from(out);
}

/**
 * **総合振込の全銀ファイル**を組み立てる。
 *
 * ヘッダ・データ・トレーラ・エンドを順に並べます。
 * **件数と合計金額はトレーラに入る**ので、**渡したレコードと必ず一致します**
 * ——手で数えて入れると、**1 件ずれただけで銀行に弾かれます**。
 *
 * **金額は 1 円単位の整数**で渡してください。小数を渡すと**桁がずれます**。
 *
 * @param consignor 委託者（振込を依頼する側）の情報
 * @param records 振込先の一覧
 * @param transferDate 振込指定日
 * @returns 全銀フォーマットの本文（**半角のみ**。バイト列にするには {@link toShiftJisBytes}）
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
  lines.push(`9${" ".repeat(119)}`); // エンドレコード(**120 桁固定**。残りはダミー)
  return { content: lines.join("\r\n"), count: records.length, totalAmount: total };
}
