/**
 * 署名付きセッション(HMAC-SHA256)。Zoho ログイン後の本人情報を安全にクッキーへ。
 * @packageDocumentation
 */
import { createHmac, timingSafeEqual } from "node:crypto";

/** セッションのペイロード。 */
export interface SessionPayload {
  email: string;
  name?: string;
  zuid?: string;
  /** 付与ロール(RBAC)。 */
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
