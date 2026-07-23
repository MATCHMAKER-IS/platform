/**
 * パスワード再設定(忘れたときの手続き)。
 *
 * 仕組みは単純だが、**間違えると乗っ取りに直結する**ため、危ない点を明示しておく。
 *
 *   1. 利用者がメールアドレスを入力する
 *   2. 使い捨てトークンを発行し、**ハッシュだけ**を保存する
 *   3. 生のトークンを含むリンクをメールで送る
 *   4. リンクを開いて新しいパスワードを設定する
 *   5. トークンを使用済みにし、**既存のセッションを無効化**する
 *
 * 守っていること:
 *   - **生のトークンを保存しない**  … 保存先が漏れても、そのままでは使えない
 *   - **短い有効期限**(既定 30 分)  … 盗まれた場合の猶予を短くする
 *   - **1 回だけ有効**              … 使用済みは再利用できない
 *   - **存在しないメールでも同じ応答** … 「登録があるか」を外部に漏らさない
 *   - **比較は一定時間**            … 応答時間からトークンを推測されない
 *
 * 保存先(RequestStore)はアプリが用意する。開発ではメモリ、本番は DB。
 * @packageDocumentation
 */
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/** 保存する再設定要求(生のトークンは含まない)。 */
export interface PasswordResetRequest {
  /** 対象ユーザー。 */
  userId: string;
  /** トークンのハッシュ(生の値は保存しない)。 */
  tokenHash: string;
  /** 期限(ミリ秒。Date.now() と比較する)。 */
  expiresAt: number;
  /** 使用済みなら、その時刻。 */
  usedAt?: number;
  /** 要求元(監査用。誰が要求したかを後から追える)。 */
  requestedFrom?: string;
}

/** 保存先。アプリが memory / DB のどちらかで実装する。 */
export interface PasswordResetStore {
  save(req: PasswordResetRequest): Promise<void> | void;
  /** トークンのハッシュで引く。 */
  findByHash(tokenHash: string): Promise<PasswordResetRequest | null> | PasswordResetRequest | null;
  /** 使用済みにする。 */
  markUsed(tokenHash: string, at: number): Promise<void> | void;
  /** 同じ利用者の未使用の要求を無効化する(新しく発行したら古いものは使えなくする)。 */
  invalidateFor(userId: string): Promise<void> | void;
}

/**
 * トークンをハッシュ化する(保存と照合に使う)。
 *
 * @param token 生のトークン
 * @returns SHA-256 の 16 進表現
 */
export function hashResetToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** 発行の設定。 */
export interface IssueOptions {
  /** 有効期限(分。既定 30)。長くすると盗まれたときの猶予が伸びる。 */
  expiresInMinutes?: number;
  /** 要求元(IP など。監査用)。 */
  requestedFrom?: string;
  /** 現在時刻(テスト用)。 */
  now?: () => number;
  /** トークン生成(テスト用)。 */
  generateToken?: () => string;
}

/** 発行結果。`token` はメールに載せる生の値で、**保存してはいけない**。 */
export interface IssuedReset {
  token: string;
  expiresAt: number;
}

/**
 * 再設定トークンを発行する。
 *
 * 古い未使用の要求は無効化する(複数のリンクが同時に生きている状態を作らない)。
 *
 * @example
 * ```ts
 * const issued = await issuePasswordReset(store, user.id);
 * await mailer.sendMail({ to: user.email, subject: "パスワード再設定",
 *   text: `次のリンクから再設定してください（30分間有効）\n${base}/reset?token=${issued.token}` });
 * ```
 *
 * @param store   保存先
 * @param userId  対象ユーザー
 * @param options 有効期限・要求元など
 * @returns 生のトークンと期限(トークンはメールに載せ、保存しない)
 */
export async function issuePasswordReset(
  store: PasswordResetStore,
  userId: string,
  options: IssueOptions = {},
): Promise<IssuedReset> {
  const now = options.now ?? (() => Date.now());
  const token = options.generateToken
    ? options.generateToken()
    : randomBytes(32).toString("base64url");
  const expiresAt = now() + (options.expiresInMinutes ?? 30) * 60_000;

  await store.invalidateFor(userId);
  await store.save({
    userId,
    tokenHash: hashResetToken(token),
    expiresAt,
    requestedFrom: options.requestedFrom,
  });
  return { token, expiresAt };
}

/** 照合の失敗理由。画面には**区別せず**「無効なリンクです」と出す。 */
export type ResetFailure = "not_found" | "expired" | "used";

/** 照合結果。 */
export type ResetVerification =
  | { ok: true; userId: string; tokenHash: string }
  | { ok: false; reason: ResetFailure };

/**
 * トークンを照合する(まだ使用済みにはしない)。
 *
 * 失敗理由は呼び出し側でログに残す用で、**画面には出さない**。
 * 「期限切れ」と「存在しない」を区別して見せると、有効なトークンを探る手がかりになる。
 *
 * @param store 保存先
 * @param token 利用者が持ってきた生のトークン
 * @param now   現在時刻(テスト用に差し替え可能)
 * @returns 成功なら userId と tokenHash、失敗なら理由
 */
export async function verifyPasswordReset(
  store: PasswordResetStore,
  token: string,
  now: () => number = () => Date.now(),
): Promise<ResetVerification> {
  const tokenHash = hashResetToken(token);
  const found = await store.findByHash(tokenHash);
  if (!found) return { ok: false, reason: "not_found" };

  // 念のため一定時間比較(保存側の実装が前方一致などでも安全側に倒す)
  const a = Buffer.from(found.tokenHash);
  const b = Buffer.from(tokenHash);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return { ok: false, reason: "not_found" };

  if (found.usedAt !== undefined) return { ok: false, reason: "used" };
  if (found.expiresAt <= now()) return { ok: false, reason: "expired" };
  return { ok: true, userId: found.userId, tokenHash };
}

/**
 * 再設定を確定する(トークンを使用済みにする)。
 *
 * **パスワードの更新とセッションの無効化は呼び出し側の責任**。
 * 「新しいパスワードにしたのに、盗まれたセッションが生きている」を防ぐため、
 * ここを終えたら必ず既存セッションを切ること。
 *
 * @param store     保存先
 * @param tokenHash verifyPasswordReset が返したハッシュ
 * @param now       現在時刻(テスト用に差し替え可能)
 */
export async function completePasswordReset(
  store: PasswordResetStore,
  tokenHash: string,
  now: () => number = () => Date.now(),
): Promise<void> {
  await store.markUsed(tokenHash, now());
}

/**
 * メモリ実装(開発・テスト用)。
 *
 * **本番では DB 実装を使うこと。** 再起動で消えると、
 * 送ったメールのリンクが全部無効になる。
 *
 * @returns メモリ上に保持する保存先
 */
export function createMemoryPasswordResetStore(): PasswordResetStore {
  const rows = new Map<string, PasswordResetRequest>();
  return {
    save(req) { rows.set(req.tokenHash, { ...req }); },
    findByHash(h) { return rows.get(h) ?? null; },
    markUsed(h, at) {
      const r = rows.get(h);
      if (r) rows.set(h, { ...r, usedAt: at });
    },
    invalidateFor(userId) {
      for (const [h, r] of rows) {
        if (r.userId === userId && r.usedAt === undefined) rows.delete(h);
      }
    },
  };
}
