/**
 * ログイン試行の回数制限(総当たり対策)。
 *
 * パスワードだけで守っているログインは、**試し放題だと必ず破られる**。
 * 弱いパスワードは数千回で当たるため、回数を絞ることが最初の防御になる。
 *
 * 絞り方は 2 つを併用する:
 *   - **メールアドレス単位** … 特定の人を狙った総当たりを止める
 *   - **接続元単位**         … 多数のアカウントを少しずつ試す攻撃を止める
 *
 * 開発ではメモリ、本番は Redis(`createRedisStore`)に差し替える。
 * メモリだとサーバが複数台になった瞬間に、台数分だけ試行できてしまう。
 * @packageDocumentation
 */
import { createRateLimiter, createMemoryStore, type RateLimiter } from "@platform/ratelimit";

/** メール単位: 15 分で 5 回まで。 */
const byEmail: RateLimiter = createRateLimiter({ store: createMemoryStore(), limit: 5, windowSeconds: 15 * 60 });

/** 接続元単位: 15 分で 20 回まで(共有回線を考えて緩め)。 */
const byIp: RateLimiter = createRateLimiter({ store: createMemoryStore(), limit: 20, windowSeconds: 15 * 60 });

/** 判定結果。 */
export interface LoginAttemptCheck {
  /** 試行してよいか。 */
  allowed: boolean;
  /** 残り試行回数(利用者に見せるのは任意)。 */
  remaining: number;
}

/**
 * ログイン試行を 1 回分数える。
 *
 * **成否に関わらず呼ぶ**。成功したときだけ数えないと、
 * 失敗し続ける攻撃を素通りさせてしまう。
 *
 * @param email 入力されたメールアドレス
 * @param ip    接続元(取得できないときは "unknown")
 * @returns 試行してよいかと、残り回数
 */
export async function checkLoginAttempt(email: string, ip: string): Promise<LoginAttemptCheck> {
  const e = await byEmail.check(`login:email:${email.trim().toLowerCase()}`);
  const i = await byIp.check(`login:ip:${ip}`);
  // どちらかが上限に達したら止める
  const allowed = (e.ok ? e.value.allowed : true) && (i.ok ? i.value.allowed : true);
  const remaining = Math.min(e.ok ? e.value.remaining : 99, i.ok ? i.value.remaining : 99);
  return { allowed, remaining };
}

/**
 * リクエストから接続元を推定する。
 *
 * プロキシ経由だと `X-Forwarded-For` を見る必要があるが、**この値は偽装できる**。
 * 厳密な制限が要るなら、信頼できるプロキシの設定と合わせて使うこと。
 *
 * @param req リクエスト
 * @returns 接続元の文字列(取得できなければ "unknown")
 */
export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  return fwd?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
}
