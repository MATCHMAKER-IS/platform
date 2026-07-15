/**
 * バックアップコード(2要素認証のリカバリーコード)。
 * 認証アプリや電話を失ったときの代替ログイン手段。コードは平文で保存せず HMAC ハッシュで保持し、
 * 各コードは一度だけ使える(使用済みは無効化)。生成時に平文を一度だけユーザーに提示する。
 * @packageDocumentation
 */
import { randomInt, createHmac, timingSafeEqual } from "node:crypto";

// 紛らわしい文字(0/O, 1/l/I 等)を除いた読みやすい英数字。
const CODE_ALPHABET = "abcdefghijkmnpqrstuvwxyz23456789";

/** 保存するバックアップコードのレコード(シリアライズ可能)。 */
export interface BackupCodeRecord {
  /** コードの HMAC ハッシュ(平文は保持しない)。 */
  hash: string;
  /** 使用日時(エポックミリ秒)。未使用なら undefined。 */
  usedAt?: number;
}

/** ランダムなコード文字列を生成する(区切りなしの素の文字列)。 */
function randomCode(length: number): string {
  let out = "";
  for (let i = 0; i < length; i++) out += CODE_ALPHABET[randomInt(0, CODE_ALPHABET.length)];
  return out;
}

/** 表示用に区切りを入れる("abcdefgh" → "abcd-efgh")。 */
function formatCode(raw: string, groupSize: number): string {
  const groups: string[] = [];
  for (let i = 0; i < raw.length; i += groupSize) groups.push(raw.slice(i, i + groupSize));
  return groups.join("-");
}

/**
 * 入力コードを正規化する(区切り・空白除去、小文字化)。
 *
 * 利用者は紙に控えたコードを「XXXX-XXXX」のように区切って入力するため、
 * 照合の前に必ず通す。
 *
 * @param code 利用者が入力したコード
 * @returns 正規化した文字列(英数字のみ・小文字)
 */
export function normalizeBackupCode(code: string): string {
  return code.replace(/[\s-]/g, "").toLowerCase();
}

/**
 * コードを HMAC-SHA256 でハッシュする。
 *
 * **平文のバックアップコードを保存しない**ため(漏洩時に即座に悪用される)。
 *
 * @param code   正規化済みのコード
 * @param secret サーバー側の pepper(環境変数などから)
 * @returns 16 進のハッシュ文字列
 */
export function hashBackupCode(code: string, secret: string): string {
  return createHmac("sha256", secret).update(normalizeBackupCode(code)).digest("hex");
}

/** {@link generateBackupCodes} のオプション。 */
export interface GenerateBackupCodesOptions {
  /** 生成する個数(既定 10)。 */
  count?: number;
  /** 1 コードの文字数(既定 8)。 */
  length?: number;
  /** 表示時の区切りグループ長(既定 4。0 で区切りなし)。 */
  groupSize?: number;
}

/**
 * バックアップコードを生成する。
 * `codes`(平文・一度だけ表示)と `records`(保存用ハッシュ)を返す。平文は保存しないこと。
 *
 * @param secret  ハッシュ用の pepper
 * @param options 生成数・桁数(省略時は既定)
 * @returns `codes`(**画面に一度だけ表示**。二度と見せられない)と `records`(DB に保存する)
 */
export function generateBackupCodes(secret: string, options: GenerateBackupCodesOptions = {}): { codes: string[]; records: BackupCodeRecord[] } {
  const count = options.count ?? 10;
  const length = options.length ?? 8;
  const groupSize = options.groupSize ?? 4;
  const codes: string[] = [];
  const records: BackupCodeRecord[] = [];
  const seen = new Set<string>();
  while (codes.length < count) {
    const raw = randomCode(length);
    if (seen.has(raw)) continue; // 重複回避
    seen.add(raw);
    const display = groupSize > 0 ? formatCode(raw, groupSize) : raw;
    codes.push(display);
    records.push({ hash: hashBackupCode(raw, secret) });
  }
  return { codes, records };
}

/** バックアップコード検証の結果。 */
export interface BackupCodeVerifyResult {
  /** 有効なコードだったか。 */
  valid: boolean;
  /** 使用済みマークを付けた新しいレコード配列(保存し直す)。 */
  records: BackupCodeRecord[];
  /** 一致したコードのインデックス(valid のとき)。 */
  matchedIndex?: number;
}

/**
 * * バックアップコードを検証し、一致すれば使用済みにする(単回利用・定数時間比較)。
 * 既に使用済みのコードには一致しない。返り値の records を保存し直すこと。
 *
 * @param records 保存してあるコードの記録
 * @param input   利用者が入力したコード(正規化前でよい)
 * @param secret  作成時と同じ pepper
 * @returns 一致したかと、使用済みに更新した records。**成功したら records を保存し直すこと**
 */
export function verifyBackupCode(code: string, records: BackupCodeRecord[], secret: string, now: Date = new Date()): BackupCodeVerifyResult {
  const target = hashBackupCode(code, secret);
  for (let i = 0; i < records.length; i++) {
    const rec = records[i]!;
    if (rec.usedAt !== undefined) continue; // 使用済みはスキップ
    let match = false;
    try {
      match = rec.hash.length === target.length && timingSafeEqual(Buffer.from(rec.hash), Buffer.from(target));
    } catch {
      match = false;
    }
    if (match) {
      const updated = records.map((r, idx) => (idx === i ? { ...r, usedAt: now.getTime() } : r));
      return { valid: true, records: updated, matchedIndex: i };
    }
  }
  return { valid: false, records };
}

/**
 * 未使用のバックアップコード数を返す(残数が少なければ再生成を促す)。
 *
 * @param records 保存してある記録
 * @returns まだ使えるコードの数。**0 になったら再発行を促す**
 */
export function remainingBackupCodes(records: BackupCodeRecord[]): number {
  return records.filter((r) => r.usedAt === undefined).length;
}
