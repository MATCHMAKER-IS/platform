/**
 * `@platform/guard` — ルート/ページ保護の共通ガード。
 *
 * セッション(`@platform/session`)・RBAC(`@platform/auth`)・レート制限
 * (`@platform/ratelimit`)を束ね、Route ハンドラの入口で「認証必須」「権限必須」
 * 「試行回数制限」を宣言的に強制する。失敗は AppError で投げ、`@platform/http` の
 * `handleRoute` が適切な HTTP ステータス(401/403/429)に変換する。
 *
 * @packageDocumentation
 */
import { timingSafeEqual } from "node:crypto";
import { AppError, ErrorCode } from "@platform/core";
import type { Session } from "@platform/session";
import { assertCan, type AuthUser, type Policy, type Permission } from "@platform/auth";
import type { RateLimiter, RateLimitResult } from "@platform/ratelimit";

/**
 * セッションを必須にする。無ければ 401(UNAUTHORIZED)。
 * @param source `Request` か Cookie ヘッダの文字列
 * @param session `@platform/session` の `createSession` で作ったもの
 * @returns セッションデータ
 * @throws {@link @platform/core#AppError} `UNAUTHORIZED`
 */
/**
 * ログイン中の利用者を返す(**未ログインなら `null`**)。
 *
 * **{@link requireSession} と対で使う。** あちらは無ければ 401 を投げるが、
 * こちらは `null` を返す——**ログインしていなくても見せる画面**
 * (公開ページ・ログイン画面そのもの・「ログイン中なら名前を出す」ヘッダ)で使う。
 *
 * **`Request` をそのまま渡せる。** 各アプリが
 * `session.read(req.headers.get("cookie"))` を毎回書いており、
 * `internal-app` と `line-console` で**同じ形のラッパーを別々に持っていた**
 * (2026-08 に基盤へ)。
 *
 * **セッションが無いことと、壊れていることを区別しない。**
 * どちらも `null` を返す——**利用者から見れば「ログインしていない」で同じ**だし、
 * 区別して伝えると**セッションの偽造を試す手がかり**になる。
 *
 * @param source `Request` か Cookie ヘッダの文字列
 * @param session `@platform/session` の `createSession` で作ったもの
 * @returns セッションの中身。無効・期限切れ・未ログインなら `null`
 *
 * @example
 * ```ts
 * const user = currentSession(req, session);
 * if (user === null) return NextResponse.redirect("/login");
 * ```
 */
export function currentSession<T>(
  source: Request | string | null | undefined,
  session: Session<T>,
): T | null {
  const cookieHeader = typeof source === "object" && source !== null && "headers" in source
    ? source.headers.get("cookie")
    : source;
  return session.read(cookieHeader);
}

/**
 * **ログインしていること**を確かめ、していなければ例外を投げる。
 *
 * **戻り値を見なくても止まります**——`if` を書き忘れても素通りしません。
 * これが `currentUser()` との違いです（あちらは `undefined` を返すだけ）。
 *
 * **「この人はこれをしてよいか」は別**です（`@platform/auth` の `can` 系）。
 * ここで見るのは「**誰かであること**」だけです。
 *
 * @param source 要求（またはクッキーの文字列）
 * @param session セッションの入れ物
 * @returns ログインしている人の情報
 * @throws ログインしていない場合（`AppError(UNAUTHORIZED)`）
 */
export function requireSession<T>(source: Request | string | null | undefined, session: Session<T>): T {
  // **`Request` も受け取る**(`currentSession` と揃える。2026-08)
  const data = currentSession(source, session);
  if (!data) throw new AppError(ErrorCode.UNAUTHORIZED, "ログインが必要です");
  return data;
}

/**
 * ユーザーが指定ロールを持つことを必須にする。無ければ 403(FORBIDDEN)。
 * @param user 利用者
 * @param role 必要なロール(**いずれか 1 つ**)
 * @throws {@link @platform/core#AppError} コード `FORBIDDEN` — 権限が無い場合
 */
export function requireRole(user: AuthUser, role: string): void {
  if (!user.roles.includes(role)) {
    throw new AppError(ErrorCode.FORBIDDEN, "この操作を行う権限がありません", { details: { required: role, roles: user.roles } });
  }
}

/**
 * ユーザーが指定権限を持つことを必須にする(RBAC)。無ければ 403。
 * `@platform/auth` の `assertCan` に委譲。
 * @param policy 役割と権限の対応表（**アプリごとに違う**ので渡す）
 * @param user 利用者
 * @param permission 必要な権限
 */
export function requirePermission(policy: Policy, user: AuthUser, permission: Permission): void {
  assertCan(policy, user, permission);
}

/**
 * レート制限を強制する。上限超過なら 429(RATE_LIMITED)。
 *
 * **ストア障害時は既定でフェイルオープン(通す)し、`null` を返す。**
 * Redis が落ちただけで全部の API が止まるのは可用性として困るため。
 *
 * **ログインでは `onStoreError: "deny"` を渡すこと。**
 * 通す設定のままだと、**Redis を落とせば防御が消える**——
 * 総当たりを止めるための仕組みが、攻撃者に無効化される。
 * 「ログインできない」方が「誰でも入れる」より軽い。
 *
 * @param limiter `@platform/ratelimit` の `createRateLimiter`
 * @param key 制限キー(`login:${email}` や IP など)
 * @param options.onStoreError ストア障害時の扱い(既定 `"allow"` = 通す)。**ログインでは `"deny"`**
 * @returns 判定結果(通過時)、ストア障害時は null
 * @throws {@link @platform/core#AppError} `RATE_LIMITED`
 *
 * @example
 * ```ts
 * await enforceRateLimit(limiter, `login:${email}`); // 超過なら 429
 * ```
 */
/**
 * 書き込み要求の共通ガード(**本文サイズ・CSRF・レート制限**)。
 *
 * **ルートごとに書かない。** 3 つとも「書き忘れても動いてしまう」ので、
 * 新しい API を足したときに抜けやすい——抜けても**平常時は何も起きず、
 * 攻撃されて初めて分かる**。
 *
 * 見るのは 3 つ:
 *
 * - **本文の大きさ** … 巨大な JSON を送られると**解析でメモリを食い潰す**。
 *   検証は解析の後なので、**その前に止める**必要がある。
 * - **`Origin`(CSRF)** … 他所のページから勝手に書き込ませる攻撃を防ぐ。
 *   `Origin` はブラウザが管理するので**偽装できない**。
 *   **送ってこない相手(古いクライアント・サーバ間通信)は通す**——送られたときだけ見る。
 * - **レート制限** … 書き込みだけ数える。読み取りは副作用が無いので対象外。
 *
 * **`GET` / `HEAD` は素通し**する(副作用が無い)。
 *
 * @param req 受け取った要求（`headers.get` さえあればよい。**試験で作りやすくする**ため）
 * @param options.limiter レート制限(省略すると制限しない)
 * @param options.maxBodyBytes 本文の上限(既定 1MB。ファイルを扱うルートでは上げる)
 * @param options.userId 制限の単位にする利用者(省略すると接続元 IP)
 * @returns 弾いたときは `Response`、通すときは `null`
 *
 * @example
 * ```ts
 * export async function POST(req: Request) {
 *   const blocked = await guardWrite(req, { limiter: writeLimiter });
 *   if (blocked !== null) return blocked;
 *   // ここから本処理
 * }
 * ```
 */
export async function guardWrite(
  req: Request,
  options: { limiter?: RateLimiter; maxBodyBytes?: number; userId?: string } = {},
): Promise<Response | null> {
  // **読み取りは対象外。** 副作用が無く、制限しても遅くなるだけ
  if (req.method === "GET" || req.method === "HEAD") return null;

  const maxBytes = options.maxBodyBytes ?? 1_000_000;
  const length = Number(req.headers.get("content-length") ?? "0");
  if (Number.isFinite(length) && length > maxBytes) {
    return Response.json({ error: "送信された内容が大きすぎます" }, { status: 413 });
  }

  // **`Origin` が来ていれば一致を見る。** 来ていなければ通す
  const origin = req.headers.get("origin");
  if (origin !== null && origin !== new URL(req.url).origin) {
    return Response.json({ error: "不正な要求です" }, { status: 403 });
  }

  if (options.limiter !== undefined) {
    const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0]?.trim() ?? "unknown";
    const key = options.userId !== undefined ? `user:${options.userId}` : `ip:${ip}`;
    const hit = await options.limiter.check(key);
    // **ストアが落ちても通す(fail-open)。** 制限の仕組みが止まったせいで
    // 業務が止まる方が困る。**ログインだけは別**で、`enforceRateLimit` の
    // `onStoreError: "deny"` を使うこと
    if (hit.ok && !hit.value.allowed) {
      return Response.json({ error: "リクエストが多すぎます。しばらくしてからお試しください" }, { status: 429 });
    }
  }
  return null;
}

/**
 * **回数の上限**を確かめ、超えていれば例外を投げる。
 *
 * **戻り値を見なくても止まります。** ログインの試行など、
 * **繰り返されると困る操作の入口**で呼んでください。
 *
 * **鍵の決め方に注意**——IP だけだと**同じ会社の全員が 1 人分**になります
 * （社内からは同じ IP に見えるため）。**利用者 ID と組み合わせて**ください。
 *
 * @param limiter 上限を見張る器（`@platform/ratelimit`）
 * @param key 誰を数えるかの鍵（**IP だけにしない**）
 * @param options 上限に達したときの扱い（保存先が落ちたときに通すか止めるか等）
 * @returns 残り回数など
 * @throws 上限を超えている場合（`AppError(RATE_LIMITED)`）
 */
export async function enforceRateLimit(
  limiter: RateLimiter,
  key: string,
  options: { onStoreError?: "allow" | "deny" } = {},
): Promise<RateLimitResult | null> {
  const res = await limiter.check(key);
  if (!res.ok) {
    // **ストア障害時の扱いは呼び出し側が選ぶ。**
    // 既定は通す(可用性優先)が、ログインでは止める方が安全
    if (options.onStoreError === "deny") {
      throw new AppError(ErrorCode.RATE_LIMITED, "混み合っています。しばらくしてから再度お試しください。", {
        details: { reason: "rate-limit-store-unavailable" },
      });
    }
    return null;
  }
  if (!res.value.allowed) {
    throw new AppError(ErrorCode.RATE_LIMITED, "リクエストが多すぎます。しばらくしてから再度お試しください。", {
      details: { limit: res.value.limit },
    });
  }
  return res.value;
}

/**
 * **共有トークンを、定数時間で照合する。**
 *
 * cron から叩く API、Webhook、収集用の口——**認証が無い代わりに
 * 共有の秘密で守る**場面で使います。
 *
 * 【なぜ `===` を使わないか】
 * `===` は**一致した文字数で時間が変わります**。
 * 応答時間を測りながら 1 文字ずつ試せば、**トークンを割り出せます**。
 * 総当たりと違い、**試行回数が桁違いに少なくて済む**のが厄介なところです。
 *
 * 【なぜ基盤に置くか】
 * 同じ判定が **`internal-app` の 6 か所**にあり、**すべて `===` で比べていました**
 * (2026-08 に発見)。各所で直すと、また片方だけ古いまま残ります。
 *
 * **認可の判断は含めません。** 「管理者も通す」「開発中は素通し」といった
 * 判断はアプリごとに違うので、**照合の結果だけ**を返します。
 *
 * @param given 受け取った値(ヘッダなど。`null` / `undefined` なら false)
 * @param expected 期待する値(未設定なら **false**)
 * @returns 一致すれば true
 *
 * @example
 * ```ts
 * // アプリ側で「管理者も通す」を足す(`apps/internal-app/src/server/cron-auth.ts`)
 * const byToken = matchesSharedToken(req.headers.get("x-cron-token"), env.CRON_TOKEN);
 * const byRole = currentUser(req)?.roles.includes("admin") ?? false;
 * return byToken || byRole;
 * ```
 */
export function matchesSharedToken(
  given: string | null | undefined,
  expected: string | null | undefined,
): boolean {
  // **未設定なら通さない。** 「鍵を決めていない口が素通し」が最も危ない
  if (given === null || given === undefined || given === "") return false;
  if (expected === null || expected === undefined || expected === "") return false;

  const a = Buffer.from(given, "utf8");
  const b = Buffer.from(expected, "utf8");
  // **長さを先に確かめる。** 違うと `timingSafeEqual` は例外を投げる。
  // 長さの違いは漏れるが、**中身は漏れない**——長さだけでは当てられない
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * 呼び出し元を見分ける鍵（速度制限の単位）を作る。
 *
 * 【なぜ基盤に置くか】
 * 2026-08 の時点で、**同じ 3 行が 8 ファイルに散らばっていました**
 * （`showcase` の API 群。1 つのファイルには**2 回**書かれていた）。
 * 散らばると、**直すときに全部を見つけられません**——
 * 「`x-real-ip` も見るべきだった」と気づいた日に、8 か所を探すことになります。
 *
 * 【気をつけること】
 * **`x-forwarded-for` は利用者が名乗るヘッダです。** 信用してよいのは
 * **自分の前段（ALB / CloudFront）が付け直している場合だけ**です。
 * 前段が無い環境では、**誰でも別人になりすまして制限を回避できます**。
 *
 * 認証済みの利用者がいるなら、**IP ではなく利用者 ID で数えてください**
 * ——そちらの方が正確で、共有回線の巻き添えも防げます。
 *
 * @param req 受け取った要求（`headers.get` さえあればよい。**試験で作りやすくする**ため）
 * @returns 呼び出し元を表す文字列。**分からなければ `"unknown"`**
 */
export function clientIp(req: { headers: { get(name: string): string | null } }): string {
  const fwd = req.headers.get("x-forwarded-for");
  // **先頭が大元の呼び出し元。** 後ろは経由した中継の並び
  const first = fwd === null ? undefined : fwd.split(",")[0]?.trim();
  if (first !== undefined && first !== "") return first;
  // **`x-real-ip` も見る。** nginx など、`x-forwarded-for` を付けない前段がある
  return req.headers.get("x-real-ip") ?? "unknown";
}
