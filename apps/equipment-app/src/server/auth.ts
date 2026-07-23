/**
 * 認証(internal-app の zoho-session.ts / password.ts の最小移植)。
 * セッション: HMAC-SHA256 署名付きトークン("payload.signature")をクッキーへ。
 * パスワード: scrypt("salt:hash")。ユーザーはメモリ台帳(本番は internal-app の user-repo を移植)。
 * @packageDocumentation
 */
import { hashPassword as hashNew, verifyPassword as verifyNew } from "@platform/crypto";
import { createHmac, timingSafeEqual, scryptSync, randomBytes } from "node:crypto";

/** セッションのペイロード。 */
export interface SessionPayload {
  email: string;
  name?: string;
  roles: string[];
  /** 失効時刻(epoch 秒)。 */
  exp: number;
}

const b64url = (buf: Buffer) => buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const fromB64url = (s: string) => Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64");

/** ペイロードに署名してトークン("payload.signature")を返す。 */
export function signSession(payload: SessionPayload, secret: string): string {
  const body = b64url(Buffer.from(JSON.stringify(payload), "utf8"));
  const sig = b64url(createHmac("sha256", secret).update(body).digest());
  return `${body}.${sig}`;
}

/** トークンを検証してペイロードを返す。改ざん/失効/不正なら null。 */
export function verifySession(token: string, secret: string): SessionPayload | null {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [body, sig] = parts as [string, string];
  const expected = createHmac("sha256", secret).update(body).digest();
  const actual = fromB64url(sig);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
  try {
    const payload = JSON.parse(fromB64url(body).toString("utf8")) as SessionPayload;
    if (typeof payload.exp !== "number" || payload.exp * 1000 < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

/** 平文パスワードを `salt:hash` に変換する。 */
/**
 * パスワードのハッシュ化。**実装は @platform/crypto に一本化**した
 * (ADR 0015: 同じ機能を 2 か所に持たない)。自作していた頃は scrypt 32 byte だったが、
 * 基盤は 64 byte で強度が高い。
 */
export function hashPassword(plain: string): string {
  return hashNew(plain);
}

/**
 * 旧形式(`hex(salt):hex(hash)`・scrypt 32 byte)の照合。
 * これが無いと、移行前に作られた利用者が**全員ログインできなくなる**。
 */
function verifyLegacy(plain: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  if (!/^[0-9a-f]+$/i.test(salt) || !/^[0-9a-f]+$/i.test(hash)) return false;
  const actual = scryptSync(plain, salt, 32);
  const expected = Buffer.from(hash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/** パスワードを照合する(新形式・旧形式のどちらでも通る)。 */
export function verifyPassword(plain: string, stored: string): boolean {
  return verifyNew(plain, stored) || verifyLegacy(plain, stored);
}

interface UserRecord {
  email: string;
  name: string;
  roles: string[];
  passwordHash: string;
}

const users = new Map<string, UserRecord>();

/** 初期ユーザーを一度だけ登録する(冪等)。 */
export function seedUsers(adminPassword: string): void {
  if (users.size > 0) return;
  users.set("admin@example.com", { email: "admin@example.com", name: "管理者", roles: ["admin"], passwordHash: hashPassword(adminPassword) });
}

/** メール+パスワードでログインし、8時間有効のセッションペイロードを返す。失敗は null。 */
export function login(email: string, password: string, nowMs: number = Date.now()): SessionPayload | null {
  const user = users.get(email.trim().toLowerCase());
  if (!user || !verifyPassword(password, user.passwordHash)) return null;
  return { email: user.email, name: user.name, roles: user.roles, exp: Math.floor(nowMs / 1000) + SESSION_MAX_AGE };
}

/** セッション有効期間(秒)。 */
export const SESSION_MAX_AGE = 8 * 60 * 60;

/** リクエストのクッキーからセッションを取り出す。未ログインは null。 */
export function sessionFromRequest(req: Request, secret: string): SessionPayload | null {
  const token = req.headers.get("cookie")?.match(/session=([^;]+)/)?.[1];
  return token ? verifySession(token, secret) : null;
}
