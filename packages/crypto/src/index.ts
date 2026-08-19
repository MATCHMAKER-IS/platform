/**
 * `@platform/crypto` — 機密データの暗号化とパスワードハッシュ。
 *
 * DB に保存する機微項目(マイナンバー・口座番号等)の暗号化と、
 * パスワードの安全なハッシュ化を Node 標準の `node:crypto` で提供する。
 * 独自実装の暗号は使わず、確立されたアルゴリズム(AES-256-GCM / scrypt)を使う。
 *
 * @packageDocumentation
 */

import {
  randomBytes,
  randomInt,
  createCipheriv,
  createDecipheriv,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";
import { AppError, ErrorCode } from "@platform/core";

// **ブラウザからも使う部分は別ファイル。** 画面からは `/strength` `/blocks` を直接取ること
export { passwordStrength } from "./strength";

const ALGO = "aes-256-gcm";
const IV_LEN = 12;
const KEY_LEN = 32;

/**
 * 暗号化キー(32 バイト)を、任意長の秘密文字列から導出する。
 * `@platform/env` で検証した秘密鍵を渡して使う。
 *
 * @param secret 秘密文字列(十分に長くランダムなもの)
 * @param salt   ソルト(**必須**・アプリ/環境ごとに一意の値を設定すること)。
 *               固定の共有既定値を持たせると、複数環境で同一鍵になりレインボーテーブル攻撃に弱くなるため必須化している。
 * @returns 32 バイトのキー
 * @throws {@link @platform/core#AppError} コード `CONFIG` — salt が空の場合
 */
/**
 * scrypt のコスト設定。
 *
 * **Node の既定(N=2^14 / maxmem=32MB)より強くする。** 既定は 2010 年代の目安で、
 * 現在の GPU なら総当たりが現実的な範囲に入る。
 *
 * `N=2^16` は手元の計測で 1 回あたり約 180ms。**ログインの待ち時間として許容でき、
 * かつ総当たりのコストを 4 倍にできる**境目として選んだ。
 * OWASP の推奨は `N=2^17` だが、それだと約 4.4 秒かかり、
 * ログインのたびに待たせることになるので採らない。
 *
 * **`maxmem` も一緒に上げること。** scrypt は `128 * N * r` バイトを使うので、
 * `N` だけ上げると既定の 32MB を超えて**例外になる**(片方だけでは動かない)。
 */
const SCRYPT_OPTIONS = { N: 65536, r: 8, p: 1, maxmem: 128 * 1024 * 1024 } as const;

/**
 * パスワードや秘密から**暗号鍵を導く**。
 *
 * **同じ秘密でも salt が違えば別の鍵**になります。
 * **salt は秘密ではありません**——保存して構いませんが、
 * **利用者ごとに違うもの**にしてください（同じだと、1 つ破られたら全部破られます）。
 *
 * **共有の既定 salt は廃止しました**（ADR 0004）——
 * 「とりあえず動く」ために同じ salt を使うと、**その意味が失われます**。
 *
 * @param secret 元になる秘密（パスワードなど）
 * @param salt 利用者ごとに違う値（**8 文字以上**）
 * @returns 導いた鍵
 * @throws salt が 8 文字未満の場合（`AppError(CONFIG)`）
 */
export function deriveKey(secret: string, salt: string): Buffer {
  if (!salt || salt.length < 8) {
    throw new AppError(ErrorCode.CONFIG, "deriveKey には 8 文字以上の一意な salt が必須です(環境ごとに変えてください)");
  }
  return scryptSync(secret, salt, KEY_LEN, SCRYPT_OPTIONS);
}

/**
 * 文字列を AES-256-GCM で暗号化する。
 * 出力は `base64(iv):base64(tag):base64(ciphertext)` 形式。
 *
 * @param plaintext 平文
 * @param key       {@link deriveKey} で導出した 32 バイトキー
 * @returns 暗号文字列
 * @throws {@link @platform/core#AppError} コード `CONFIG` — キー長が不正な場合
 *
 * @example
 * ```ts
 * const key = deriveKey(env.ENCRYPTION_SECRET, env.ENCRYPTION_SALT);
 * const enc = encrypt("1234-5678", key);
 * const dec = decrypt(enc, key); // "1234-5678"
 * ```
 */
export function encrypt(plaintext: string, key: Buffer): string {
  if (key.length !== KEY_LEN) {
    throw new AppError(ErrorCode.CONFIG, "暗号化キーは32バイトである必要があります");
  }
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64")}:${tag.toString("base64")}:${enc.toString("base64")}`;
}

/**
 * {@link encrypt} で暗号化した文字列を復号する。
 *
 * @param ciphertext 暗号文字列
 * @param key        暗号化に使ったのと同じキー
 * @returns 平文
 * @throws {@link @platform/core#AppError} コード `INTERNAL` — 形式不正・改ざん検知時
 */
export function decrypt(ciphertext: string, key: Buffer): string {
  const parts = ciphertext.split(":");
  if (parts.length !== 3) {
    throw new AppError(ErrorCode.INTERNAL, "暗号文字列の形式が不正です");
  }
  const [ivB64, tagB64, dataB64] = parts as [string, string, string];
  try {
    const decipher = createDecipheriv(ALGO, key, Buffer.from(ivB64, "base64"));
    decipher.setAuthTag(Buffer.from(tagB64, "base64"));
    return Buffer.concat([
      decipher.update(Buffer.from(dataB64, "base64")),
      decipher.final(),
    ]).toString("utf8");
  } catch (e) {
    throw new AppError(ErrorCode.INTERNAL, "復号に失敗しました(改ざんの可能性)", { cause: e });
  }
}

/**
 * パスワードを scrypt でハッシュ化する。
 *
 * 出力は `scrypt$N$base64(salt)$base64(hash)`。
 *
 * **コストを文字列に含める。** 含めないと、後でコストを上げたときに
 * **保存済みのハッシュを検証できなくなる**——同じパスワードでも別の値になるため、
 * **全員がログイン不能**になる。2026-08 にコストを引き上げた際、
 * 旧形式(`base64(salt):base64(hash)`)を残したまま移行できるようにこの形にした。
 *
 * @param password 平文パスワード
 * @returns 保存用ハッシュ文字列
 */
export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 64, SCRYPT_OPTIONS);
  return `scrypt$${SCRYPT_OPTIONS.N}$${salt.toString("base64")}$${hash.toString("base64")}`;
}

/**
 * パスワードがハッシュと一致するか、タイミング安全に検証する。
 *
 * **旧形式(`base64(salt):base64(hash)`)も検証できる。** 2026-08 より前に
 * 保存されたものはコストが `N=2^14`(Node の既定)なので、その値で計算する。
 * **利用者が次にパスワードを変えるまで旧形式のまま**なので、
 * この経路は消さないこと。
 *
 * @param password 検証する平文
 * @param stored   {@link hashPassword} が返した文字列
 * @returns 一致すれば true
 */
export function verifyPassword(password: string, stored: string): boolean {
  let saltB64: string;
  let hashB64: string;
  let cost: number;
  if (stored.startsWith("scrypt$")) {
    const parts = stored.split("$");
    if (parts.length !== 4) return false;
    cost = Number(parts[1]);
    if (!Number.isInteger(cost) || cost < 1024) return false;
    [, , saltB64, hashB64] = parts as [string, string, string, string];
  } else {
    // **旧形式。** Node の既定コスト(N=2^14)で保存されている
    const parts = stored.split(":");
    if (parts.length !== 2) return false;
    cost = 16384;
    [saltB64, hashB64] = parts as [string, string];
  }
  const hash = scryptSync(password, Buffer.from(saltB64, "base64"), 64, {
    ...SCRYPT_OPTIONS,
    N: cost,
  });
  const expected = Buffer.from(hashB64, "base64");
  return hash.length === expected.length && timingSafeEqual(hash, expected);
}

/**
 * URL セーフなランダムトークンを生成する(セッション ID・ワンタイムトークン等)。
 * @param bytes バイト長(既定: 32)
 * @returns base64url 文字列
 */
export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

// ==== パスワードユーティリティ ====

/** {@link generatePassword} のオプション。 */
export interface PasswordGenerateOptions {
  /** 文字数(既定 16)。 */
  length?: number;
  /** 英大文字を含めるか(既定 true)。 */
  uppercase?: boolean;
  /** 英小文字を含めるか(既定 true)。 */
  lowercase?: boolean;
  /** 数字を含めるか(既定 true)。 */
  numbers?: boolean;
  /** 記号を含めるか(既定 true)。 */
  symbols?: boolean;
  /** 紛らわしい文字(0/O/1/l/I)を除外するか(既定 true)。 */
  excludeAmbiguous?: boolean;
}

/**
 * セキュアな乱数で強力なパスワードを生成する。
 * 指定した文字種を最低 1 文字ずつ含めたうえでシャッフルする。
 *
 * @param options 文字数・文字種
 * @returns 生成したパスワード
 * @throws {@link @platform/core#AppError} `VALIDATION` — 文字種を 1 つも選ばなかった場合
 *
 * @example
 * ```ts
 * const pw = generatePassword({ length: 20, symbols: true });
 * ```
 */
export function generatePassword(options: PasswordGenerateOptions = {}): string {
  const {
    length = 16, uppercase = true, lowercase = true,
    numbers = true, symbols = true, excludeAmbiguous = true,
  } = options;

  let U = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let L = "abcdefghijklmnopqrstuvwxyz";
  let N = "0123456789";
  const S = "!@#$%^&*-_=+";
  if (excludeAmbiguous) {
    U = U.replace(/[IO]/g, "");
    L = L.replace(/[lo]/g, "");
    N = N.replace(/[01]/g, "");
  }
  const sets: string[] = [];
  if (uppercase) sets.push(U);
  if (lowercase) sets.push(L);
  if (numbers) sets.push(N);
  if (symbols) sets.push(S);
  if (sets.length === 0) {
    throw new AppError(ErrorCode.VALIDATION, "少なくとも1種類の文字種を有効にしてください");
  }

  const all = sets.join("");
  const chars: string[] = sets.map((s) => s[randomInt(s.length)]!); // 各種1文字以上を保証
  for (let i = chars.length; i < length; i++) chars.push(all[randomInt(all.length)]!);
  // Fisher-Yates シャッフル(先頭に種別が偏らないように)
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j]!, chars[i]!];
  }
  return chars.join("");
}

/** パスワード強度の判定結果。 */
export interface PasswordStrength {
  /** 0(非常に弱い)〜4(非常に強い)。 */
  score: 0 | 1 | 2 | 3 | 4;
  /** 日本語のラベル。 */
  label: string;
  /** 改善のためのヒント。 */
  suggestions: string[];
}

const STRENGTH_LABELS = ["非常に弱い", "弱い", "普通", "強い", "非常に強い"] as const;
const COMMON_PASSWORDS = new Set([
  "password", "123456", "12345678", "qwerty", "abc123", "password1", "111111", "iloveyou", "admin",
]);

function isSequential(pw: string): boolean {
  const s = pw.toLowerCase();
  for (let i = 0; i < s.length - 2; i++) {
    const a = s.charCodeAt(i), b = s.charCodeAt(i + 1), c = s.charCodeAt(i + 2);
    if ((b - a === 1 && c - b === 1) || (a - b === 1 && b - c === 1)) return true;
  }
  return false;
}

/**
 * 秘密値を**定数時間**で比較する。
 *
 * **`===` は一致した文字数だけ時間が変わる。** その差を測ると、
 * 攻撃者は 1 文字ずつ正解を絞り込める(先頭が合っていれば少し遅い)。
 * トークン・API キー・署名の照合には必ずこちらを使う。
 *
 * 長さが違う場合も**同じ時間で** false を返す(長さから情報を漏らさない)。
 *
 * @param a 比較する値(利用者が持ってきたもの)
 * @param b 比較する値(こちらが持っている正解)
 * @returns 一致すれば true
 *
 * @example
 * ```ts
 * // 誤: 一致した文字数で時間が変わる
 * if (token === expected) { … }
 *
 * // 正
 * if (safeEqual(token, expected)) { … }
 * ```
 */
export function safeEqual(a: string, b: string): boolean {
  // **長さが違っても早期 return しない。**
  // ここで返すと「長さが合っているか」だけが速さから分かってしまう。
  // 同じ長さのバッファに詰めてから比較する
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  const len = Math.max(bufA.length, bufB.length, 1);
  const padA = Buffer.alloc(len);
  const padB = Buffer.alloc(len);
  bufA.copy(padA);
  bufB.copy(padB);
  // 長さの違いは最後に AND する(比較そのものは常に同じ回数)
  return timingSafeEqual(padA, padB) && bufA.length === bufB.length;
}
