/**
 * 給与の源泉徴収と、総支給から手取りまでの組み立て。
 *
 * **報酬・料金の源泉徴収（`@platform/tax` の `withholdingTax`）とは別物**。
 * あちらは外注先への支払いで「10.21% を引く」もの。
 * こちらは従業員の給与で、**国税庁が毎年出す「給与所得の源泉徴収税額表」を引く**。
 *
 * 【なぜ計算式を持たないか】
 * 月額表は約 300 行 × 8 列の表で、給与所得控除・基礎控除・扶養控除が
 * 織り込まれている。**単純な料率では再現できない**。
 *
 * 近似で実装すると、実際の表と数千円ずれることがある
 * （社保控除後 255,930 円・扶養 1 人なら表は約 5,130 円だが、
 * 素朴な段階税率だと 11,000 円を超える）。**税額は 1 円の誤りも許されない**ので、
 * 基盤は「表を引く仕組み」だけを持ち、**表そのものはアプリが渡す**。
 *
 * 表は毎年変わるため、基盤に埋め込むと更新のたびに基盤を触ることになる。
 *
 * 【計算の順序】
 *   1. 総支給額（基本給 + 割増 + 手当）
 *   2. − 社会保険料（{@link calcInsuranceDeduction}）
 *   3. = **その月の社会保険料等控除後の給与等の金額**  ← これで表を引く
 *   4. 扶養親族等の数に応じた列を見て税額が決まる
 *
 * **順序を間違えると税額がずれる**。社会保険料を引く前の額で引いてしまうのが
 * よくある誤りで、毎月わずかに多く天引きし、年末調整で戻すことになる。
 *
 * @packageDocumentation
 *
 * 【対応しているのは甲欄だけです】
 * **乙欄（他社が主たる給与の人）には対応していません。**
 * 副業の人や、短期雇用で扶養控除等申告書を出していない人は、
 * **税額が変わります**——該当者が出たら、税額表の乙欄を足してください。
 *
 * **甲欄で計算してしまうと、源泉徴収が不足**し、
 * 年末調整や確定申告で追加の納付が必要になります。
 */

/**
 * 源泉徴収税額表の 1 行。
 *
 * 国税庁の「給与所得の源泉徴収税額表（月額表）」の 1 行に対応する。
 * `tax` は扶養親族等の数（0 人〜7 人）に対応する 8 個の配列。
 */
export interface WithholdingRow {
  /** その月の社会保険料等控除後の給与等の金額（円。以上）。 */
  from: number;
  /** 同（円。未満。最終行は Infinity）。 */
  to: number;
  /** 扶養親族等の数 0〜7 人に対応する税額（円）。 */
  tax: readonly number[];
}

/** 源泉徴収税額表（甲欄）。 */
export interface WithholdingTable {
  /** 表の年度（例 "2026"）。**どの年の表かを記録する**。 */
  year: string;
  /** 行（金額の昇順）。 */
  rows: readonly WithholdingRow[];
}

/**
 * 税額表を引いて源泉徴収税額を求める（甲欄）。
 *
 * **「社会保険料等控除後の給与等の金額」で引く**ことに注意。
 * 総支給額を渡すと、毎月わずかに多く天引きすることになる。
 *
 * @param table 税額表（アプリが年度に応じて用意する）
 * @param taxableAmount 社会保険料を引いた後の給与等の金額（円）
 * @param dependents 扶養親族等の数（0〜7。範囲外は丸める）
 * @returns 源泉徴収税額（円）
 * @throws {@link @platform/core#AppError} コード `CONFIG` — 表に該当行が無い場合
 *
 * @example
 * ```ts
 * const tax = lookupWithholdingTax(table2026, 255_930, 1);
 * ```
 */
export function lookupWithholdingTax(
  table: WithholdingTable,
  taxableAmount: number,
  dependents: number,
): number {
  const amount = Math.max(0, Math.floor(taxableAmount));
  // 表は 0〜7 人まで。8 人以上は 7 人の列を使う（実務でも別途調整する）
  const col = Math.min(7, Math.max(0, Math.floor(dependents)));

  const row = table.rows.find((r) => amount >= r.from && amount < r.to);
  if (row === undefined) {
    throw new Error(
      `源泉徴収税額表(${table.year})に ${amount.toLocaleString("ja-JP")} 円の行がありません。表の範囲を確認してください`,
    );
  }
  return row.tax[col] ?? row.tax[row.tax.length - 1] ?? 0;
}

/**
 * 表が壊れていないかを検査する。
 *
 * **税額表は手で作ると必ず穴が空く**（行の抜け・範囲の重なり・列数の不足）。
 * 使う前に一度通しておくと、給与計算の当日に気づくことを避けられる。
 *
 * @param table 検査する表
 * @returns 問題の一覧（空なら妥当）
 *
 * @example
 * ```ts
 * const problems = validateWithholdingTable(table2026);
 * if (problems.length > 0) throw new Error(problems.join("\n"));
 * ```
 */
export function validateWithholdingTable(table: WithholdingTable): string[] {
  const problems: string[] = [];
  if (table.rows.length === 0) return ["行がありません"];

  let prev: WithholdingRow | undefined;
  for (const [i, r] of table.rows.entries()) {
    if (r.from >= r.to) {
      problems.push(`${i + 1} 行目: from(${r.from}) が to(${r.to}) 以上です`);
    }
    // **扶養は 0〜7 人の 8 列**。足りないと、多い人の税額が取れない
    if (r.tax.length < 8) {
      problems.push(`${i + 1} 行目: 税額が ${r.tax.length} 列しかありません(扶養 0〜7 人の 8 列が要ります)`);
    }
    // **扶養が増えれば税額は下がる**（同額はありうるが、増えることはない）
    for (let c = 1; c < r.tax.length; c += 1) {
      if ((r.tax[c] ?? 0) > (r.tax[c - 1] ?? 0)) {
        problems.push(`${i + 1} 行目: 扶養 ${c} 人の税額が ${c - 1} 人より多くなっています`);
        break;
      }
    }
    if (prev !== undefined) {
      if (r.from < prev.to) problems.push(`${i + 1} 行目: 前の行と範囲が重なっています`);
      if (r.from > prev.to) problems.push(`${i + 1} 行目: 前の行との間に隙間があります(${prev.to} 〜 ${r.from})`);
    }
    prev = r;
  }
  // 最終行は上限なしであるべき（高給の人で表から外れる）
  const last = table.rows[table.rows.length - 1];
  if (last !== undefined && Number.isFinite(last.to)) {
    problems.push("最終行の to が有限です(上限を超える給与で引けなくなります)");
  }
  return problems;
}

/** 給与から天引きする合計の内訳。 */
export interface MonthlyDeductions {
  /** 社会保険料の合計。 */
  socialInsurance: number;
  /** 源泉所得税。 */
  incomeTax: number;
  /** 住民税（**前年の所得で決まる**ため計算せず受け取る）。 */
  residentTax: number;
  /** 天引き合計。 */
  total: number;
  /** 差引支給額（手取り）。 */
  netPay: number;
  /** 税額表を引くのに使った額（社会保険料控除後）。 */
  taxableAmount: number;
}

/**
 * 総支給額から手取りまでを組み立てる。
 *
 * **順序が決まっている**:
 *   総支給 − 社会保険料 = 課税対象 → 源泉所得税 → 住民税を引いて手取り
 *
 * 住民税は**前年の所得**で決まり、市区町村から通知が来る額をそのまま引く。
 * 計算するものではないので、引数で受け取る。
 *
 * @param input.grossPay 総支給額（基本給 + 割増 + 手当）
 * @param input.socialInsurance 社会保険料の合計（{@link calcInsuranceDeduction} の `total`）
 * @param input.dependents 扶養親族等の数
 * @param input.table 源泉徴収税額表
 * @param input.residentTax 住民税（市区町村からの通知額。既定 0）
 * @returns 内訳と手取り
 *
 * @example
 * ```ts
 * const ins = calcInsuranceDeduction({ monthlyPay: 300_000, birthDate, targetMonth }, rates);
 * const pay = buildMonthlyDeductions({
 *   grossPay: 300_000,
 *   socialInsurance: ins.total,
 *   dependents: 1,
 *   table: table2026,
 *   residentTax: 12_000,
 * });
 * ```
 */
export function buildMonthlyDeductions(input: {
  grossPay: number;
  socialInsurance: number;
  dependents: number;
  table: WithholdingTable;
  residentTax?: number;
}): MonthlyDeductions {
  const residentTax = input.residentTax ?? 0;
  // **社会保険料を引いてから**税額表を引く
  const taxableAmount = input.grossPay - input.socialInsurance;
  const incomeTax = lookupWithholdingTax(input.table, taxableAmount, input.dependents);
  const total = input.socialInsurance + incomeTax + residentTax;
  return {
    socialInsurance: input.socialInsurance,
    incomeTax,
    residentTax,
    total,
    netPay: input.grossPay - total,
    taxableAmount,
  };
}
