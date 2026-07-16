/**
 * キャストのプロフィール組み立て(純ロジック)。
 * プロフィール項目・SNS リンク・プロフィール充実度を、表示用にまとめる。
 * SNS は @platform/social の SocialAccount、空き枠は @platform/booking と組み合わせて使う。
 * @packageDocumentation
 */
import { type Cast } from "./cast";

/** プロフィールの 1 項目(ラベルと値)。 */
export interface ProfileItem {
  label: string;
  value: string;
}

/** プロフィール項目の定義。 */
export interface ProfileField {
  /** Cast 上のキー。 */
  key: string;
  label: string;
}

/**
 * プロフィール項目の一覧を作る。
 *
 * **値のある項目だけ**を返す(空欄を「未設定」と並べても意味がない)。
 *
 * @param cast キャスト
 * @returns ラベルと値の配列(**そのまま描画できる形**)
 */
export function profileItems(cast: Cast, fields: ProfileField[]): ProfileItem[] {
  const items: ProfileItem[] = [];
  for (const f of fields) {
    const value = cast[f.key];
    if (value === null || value === undefined || value === "") continue;
    items.push({ label: f.label, value: Array.isArray(value) ? value.join("、") : String(value) });
  }
  return items;
}

/**
 * プロフィールの充実度(0〜1)を計算する。
 * 指定フィールドのうち、値が埋まっている割合。
 *
 * **「あと少しで完成」と示して入力を促す**のに使う(進捗バー)。
 *
 * @param cast キャスト
 * @param fields 対象のフィールド(省略時は既定の項目)
 * @returns 0〜1 の割合
 */
export function profileCompleteness(cast: Cast, fields: ProfileField[]): number {
  if (fields.length === 0) return 1;
  const filled = fields.filter((f) => {
    const v = cast[f.key];
    return v !== null && v !== undefined && v !== "" && !(Array.isArray(v) && v.length === 0);
  }).length;
  return Math.round((filled / fields.length) * 100) / 100;
}

/**
 * プロフィールが必須項目を満たしているかを判定する。
 *
 * **公開の前に確認する**。項目が欠けたまま公開すると、見る側に不信感を与える。
 *
 * @param cast キャスト
 * @returns 満たしていれば true と、**足りない項目名**
 */
export function hasRequiredProfile(cast: Cast, requiredKeys: string[]): boolean {
  return requiredKeys.every((k) => {
    const v = cast[k];
    return v !== null && v !== undefined && v !== "" && !(Array.isArray(v) && v.length === 0);
  });
}
