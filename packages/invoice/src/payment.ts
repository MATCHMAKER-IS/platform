/**
 * 支払期限・入金状態(純ロジック)。
 * @packageDocumentation
 */

/**
 * 支払期限を求める(発行日からの日数)。
 *
 * @param issueDate 発行日
 * @param termDays 日数
 * @returns 支払期限
 */
/**
 * 「今」を **JST の日付**として UTC 0 時に正規化する。
 *
 * **`new Date()` をそのまま使わない。** UTC で動くサーバ(クラウドの既定)では
 * JST の 00:00〜08:59 が前日として扱われ、**判定が 1 日ずれる**。
 * `@platform/datetime` に依存を増やさないための最小実装
 * (9 時間ずらして UTC として読むだけ。`formatDateJst` と同じ計算)。
 */
function todayUtcFromJst(now: Date = new Date()): Date {
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
  return new Date(`${jst}T00:00:00.000Z`);
}

/**
 * 発行日から支払期日を求める。
 *
 * **既定は休日を考慮しない**(`adjust: "none"`)。
 * 「月末締め翌月末払い」で月末が土曜なら、実際の入金は**翌月曜**になるので、
 * 督促の判定に使うなら `adjust: "next"` を渡すこと
 * ——**入金が無い日に督促する**ことになる。
 *
 * 逆に「休日なら前倒し」の会社もあるので `"previous"` も選べる。
 *
 * **起算日は動かさない。** 下請法の「60 日以内」は休日でも起算日が変わらないので、
 * ずらすのは**支払日だけ**(2026-08 に追加)。
 *
 * @param issueDate 発行日
 * @param termDays 支払サイト(日数)
 * @param options.holidays 休日(`"YYYY-MM-DD"` の集合。土日は渡さなくても休みとして扱う)
 * @param options.adjust 休日に当たったときの寄せ方(既定 `"none"`)
 * @returns 支払期日(`YYYY-MM-DD`)
 *
 * @example
 * ```ts
 * const holidays = new Set([...yearEndHolidays(2026)]);
 * dueDateFrom("2026-11-30", 30, { holidays, adjust: "next" });
 * ```
 */
export function dueDateFrom(
  issueDate: string | Date,
  termDays: number,
  options: { holidays?: ReadonlySet<string>; adjust?: "next" | "previous" | "none" } = {},
): string {
  // **UTC で通す。** `setDate`/`getDate` はローカル時刻で動くのに `toISOString` は UTC なので、
  // 混ぜると JST 機で日付が 1 日ずれる(CI は UTC なので気づけない)。
  const d = new Date(issueDate);
  d.setUTCDate(d.getUTCDate() + termDays);
  const raw = d.toISOString().slice(0, 10);

  const adjust = options.adjust ?? "none";
  if (adjust === "none") return raw;

  // **休日に当たったらずらす。** 日本の商慣行では**翌営業日**が一般的だが、
  // 「休日なら前倒し」の会社もあるので選べるようにする。
  //
  // **土日は常に休み**として扱い、祝日と会社休日は `holidays` で渡す
  // (`@platform/datetime` の `holidaysInYear` と `yearEndHolidays` を合わせたもの)。
  // ここで依存を増やさないのは、この関数が請求書の計算だけで完結するため。
  //
  // **起算日は動かさない。** 下請法の「60 日以内」は休日でも起算日が変わらないので、
  // ずらすのは**支払日だけ**(2026-08 に追加)。
  const step = adjust === "next" ? 1 : -1;
  const cur = new Date(`${raw}T00:00:00.000Z`);
  for (let i = 0; i < 30; i += 1) {
    const iso = cur.toISOString().slice(0, 10);
    const dow = cur.getUTCDay();
    const isHoliday = dow === 0 || dow === 6 || (options.holidays?.has(iso) ?? false);
    if (!isHoliday) return iso;
    cur.setUTCDate(cur.getUTCDate() + step);
  }
  // **30 日連続で休みは無い。** それでも抜けたら元の日付を返す(黙って止まらない)
  return raw;
}

/**
 * 翌月末を返す(月末締め翌月末払い)。
 *
 * **日本の商習慣で最も多い支払条件**。
 *
 * @param issueDate 基準日
 * @returns 翌月末の日付
 */
export function endOfNextMonth(issueDate: string | Date): string {
  // **UTC で組み立てる。** `new Date(y, m, 0)` はローカル時刻の 0 時を作るため、
  // JST 機では UTC に直したときに前日へ回り、**支払期日が 1 日早くなる**。
  const d = new Date(issueDate);
  const end = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 2, 0));
  return end.toISOString().slice(0, 10);
}

/** 入金状態。 */
/**
 * 請求書の入金状況。
 *
 * **`overpaid`(過入金)を `paid` と混ぜない。** 実務では普通に起きる
 * ——振込手数料を差し引かずに送金された、前月分と合算された、桁を間違えた。
 * 完了扱いにすると**返金や次回への充当が要るのに見えなくなり**、
 * 決算時に「預り金」の残高が合わない(2026-08 に追加)。
 */
export type PaymentStatus = "draft" | "issued" | "paid" | "overpaid" | "overdue" | "cancelled";

/**
 * 入金状況から状態を判定する。
 *
 * @param invoice 請求書
 * @param now 入金の配列
 * @returns `unpaid` / `partial` / `paid` / `overpaid`(**過入金も検出する**。
 *   放置すると返金漏れになる)
 */
export function paymentStatus(
  invoice: { issued: boolean; cancelled?: boolean; dueDate: string; paidAmount: number; total: number },
  now: Date = todayUtcFromJst(),
): PaymentStatus {
  if (invoice.cancelled) return "cancelled";
  if (!invoice.issued) return "draft";
  // **過入金を見分ける。** `>=` だけだと多く払われても完了扱いになり、
  // 返金や充当の対象が見えなくなる
  if (invoice.paidAmount > invoice.total) return "overpaid";
  if (invoice.paidAmount === invoice.total) return "paid";
  // 日付だけの比較。UTC で揃える(ローカル時刻で作ると実行環境で結果が変わる)
  const due = new Date(invoice.dueDate);
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  return today > due ? "overdue" : "issued";
}

/**
 * 未収残高を返す。
 *
 * **過入金は 0 になる**(負を返さない)。多く払われた分は
 * {@link overpaidAmount} で取ること——`balanceDue` が 0 なだけでは
 * 「ちょうど払われた」のか「多く払われた」のか区別が付かない(2026-08 に明記)。
 *
 * @param total 請求書
 * @param paidAmount 入金の配列
 * @returns 残高(**過入金ならマイナス**)
 */
export function balanceDue(total: number, paidAmount: number): number {
  return Math.max(0, total - paidAmount);
}

/**
 * 過入金の額を返す(多く払われた分)。
 *
 * **返金か次回への充当が要る。** 実務では普通に起きる——
 * 振込手数料を差し引かずに送金された、前月分と合算された、桁を間違えた。
 * 見えないままにすると、決算時に「預り金」の残高が合わない。
 *
 * @param total 請求額
 * @param paidAmount 入金額
 * @returns 過入金の額(過入金でなければ 0)
 */
export function overpaidAmount(total: number, paidAmount: number): number {
  return Math.max(0, paidAmount - total);
}

/**
 * 支払期限までの日数を返す。
 *
 * @param dueDate 請求書
 * @param now 基準日(テスト注入用)
 * @returns 残り日数(**過ぎていれば負**)
 */
export function daysUntilDue(dueDate: string | Date, now: Date = todayUtcFromJst()): number {
  // 日付だけの比較。UTC で揃える(ローカル時刻で作ると実行環境で結果が変わる)
  const due = new Date(dueDate);
  const a = Date.UTC(due.getUTCFullYear(), due.getUTCMonth(), due.getUTCDate());
  const b = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.round((a - b) / 86_400_000);
}
