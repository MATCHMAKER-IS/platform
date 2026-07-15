/**
 * キャストのプロフィール組み立て(純ロジック)。
 * プロフィール項目・SNS リンク・プロフィール充実度を、表示用にまとめる。
 * SNS は @platform/social の SocialAccount、空き枠は @platform/booking と組み合わせて使う。
 * @packageDocumentation
 */
import { type Cast } from "./cast.js";

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

/** キャストからプロフィール項目一覧を作る(値のある項目のみ)。 */
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
 */
export function profileCompleteness(cast: Cast, fields: ProfileField[]): number {
  if (fields.length === 0) return 1;
  const filled = fields.filter((f) => {
    const v = cast[f.key];
    return v !== null && v !== undefined && v !== "" && !(Array.isArray(v) && v.length === 0);
  }).length;
  return Math.round((filled / fields.length) * 100) / 100;
}

/** プロフィールが必須項目を満たしているか。 */
export function hasRequiredProfile(cast: Cast, requiredKeys: string[]): boolean {
  return requiredKeys.every((k) => {
    const v = cast[k];
    return v !== null && v !== undefined && v !== "" && !(Array.isArray(v) && v.length === 0);
  });
}
