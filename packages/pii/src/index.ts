/**
 * `@platform/pii` — 個人情報(PII)の保護ヘルパー。
 *
 * 表示/ログ用マスキング、検索可能暗号(blind index)、フィールド暗号化、匿名化(削除権対応)を提供する。
 * 個人情報保護法(APPI)/GDPR 対応の土台。暗号本体は注入(`@platform/crypto` の encrypt/decrypt)する。
 * @packageDocumentation
 */
import { createHmac } from "node:crypto";

// **伏せ字は `./mask` に分けてある。** 画面から使うときは
// `@platform/pii/mask` を直接取ること（入口は node:crypto を巻き込む）
export { maskEmail, maskPhone, maskName, maskPartial } from "./mask";

// ─────────────────────────── マスキング(表示・ログ用・純関数) ───────────────────────────

// ─────────────────────────── 検索可能暗号(blind index) ───────────────────────────

/**
 * blind index を作る。値を正規化(小文字化・トリム)して HMAC-SHA256 でハッシュ化する。
 * 暗号化した列とは別に「検索用の決定的ハッシュ列」を持たせることで、平文を復号せずに
 * 完全一致検索(例: メールでユーザ検索)ができる。HMAC 鍵は暗号鍵とは別管理を推奨。
 *
 * **候補が少ない項目には使わない。** 同じ値は常に同じハッシュになるので、
 * DB を見られると**値の分布が分かる**——性別・都道府県・部署のように
 * 取りうる値が数個〜数十個しかない項目では、**頻度から中身を当てられる**
 * (「東京都」が全体の 30% なら、最多のハッシュが東京都)。
 *
 * メールアドレスや電話番号のように**一意に近い値**なら実害は小さいが、
 * それでも「同じメールを使っている行」は特定できる。
 *
 * **部分一致・前方一致はできない**(ハッシュなので順序が保たれない)。
 * 「〜で始まる」検索が要るなら、この方式では実現できない(2026-08 に明記)。
 *
 * @param value 索引を作る値
 * @param hmacKey pepper(**環境変数から**)
 * @returns 決定的なハッシュ。**暗号化した項目を検索可能にする**(完全一致のみ)
 */
export function blindIndex(value: string, hmacKey: string): string {
  const normalized = value.trim().toLowerCase();
  return createHmac("sha256", hmacKey).update(normalized).digest("hex");
}

// ─────────────────────────── フィールド暗号化 ───────────────────────────

/** 暗号化関数のペア(@platform/crypto の encrypt/decrypt を注入)。 */
export interface FieldCipherDeps {
  encrypt: (plaintext: string) => string;
  decrypt: (ciphertext: string) => string;
}

/** PII フィールドの暗号化ヘルパー。null/undefined はそのまま通す(任意フィールド対応)。 */
export interface FieldCipher {
  encryptField(value: string | null | undefined): string | null;
  decryptField(value: string | null | undefined): string | null;
  /** 暗号化 + blind index をまとめて返す(保存用)。 */
  protect(value: string | null | undefined, hmacKey: string): { enc: string | null; idx: string | null };
}

/**
 * フィールド暗号のヘルパーを作る。
 *
 * **DB に入れる前に個人情報を暗号化する**(DB が漏れても中身が読めない)。
 * ただし**暗号化した項目では検索できない**(部分一致も範囲検索も不可)。
 * 検索が要るなら、ハッシュの列を別に持つなどの設計が要る。
 *
 * @param deps 暗号鍵(**環境変数から。コードに直書きしない**)
 * @returns 暗号ヘルパー(`encrypt` / `decrypt`)
 */
export function createFieldCipher(deps: FieldCipherDeps): FieldCipher {
  return {
    encryptField(value) {
      if (value === null || value === undefined) return null;
      return deps.encrypt(value);
    },
    decryptField(value) {
      if (value === null || value === undefined) return null;
      return deps.decrypt(value);
    },
    protect(value, hmacKey) {
      if (value === null || value === undefined) return { enc: null, idx: null };
      return { enc: deps.encrypt(value), idx: blindIndex(value, hmacKey) };
    },
  };
}

// ─────────────────────────── 匿名化(削除権・保持ポリシー) ───────────────────────────

/** 匿名化のトゥームストーン(削除済みを示す既定値)。 */
export const PII_TOMBSTONE = "[削除済み]";

/**
 * レコードの指定フィールドを匿名化する(削除権・保持期間超過時の処理)。
 * 実際の行削除ではなく、PII だけを消して関連データ(集計・監査)は保持する用途。
 *
 * **消す項目を挙げ漏らすと、残りから本人が分かる。**
 * 氏名とメールを消しても、**生年月日・郵便番号・性別の 3 つが揃えば
 * 相当な確率で個人を特定できる**(有名な再識別の研究がある)。
 * 「直接それと分かる項目」だけでなく、**組み合わせで分かる項目**も対象にすること。
 *
 * **他のテーブルに残った参照も消えない。** このレコードだけを匿名化しても、
 * 監査ログ・通知の履歴・添付ファイル名に氏名が残っていれば意味がない。
 * 削除権への対応では、**どこに何が残るかを先に洗うこと**(2026-08 に明記)。
 * @param record 対象レコード(コピーを返す・元は変更しない)
 * @param fields 匿名化するフィールド名
 * @param tombstone 置換値(既定 {@link PII_TOMBSTONE})
 */
export function anonymizeRecord<T extends Record<string, unknown>>(record: T, fields: (keyof T)[], tombstone: string = PII_TOMBSTONE): T {
  const copy = { ...record };
  for (const f of fields) {
    if (copy[f] !== null && copy[f] !== undefined) copy[f] = tombstone as T[keyof T];
  }
  return copy;
}

/**
 * 保持期限を過ぎたか判定する(保持ポリシー)。
 * @param createdAt レコード作成時刻(epoch ms)
 * @param retentionDays 保持日数
 * @param now 現在時刻(epoch ms)
 * @returns 保持期間を過ぎていれば true(**過ぎたデータは消す義務がある**。持ち続けると法令違反)
 */
export function isRetentionExpired(createdAt: number, retentionDays: number, now: number = Date.now()): boolean {
  return now - createdAt > retentionDays * 24 * 60 * 60 * 1000;
}
export * from "./identity-mask";
export * from "./subject-rights";
