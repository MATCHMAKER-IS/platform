import { createSession } from "@platform/session";

/**
 * デモ用セッション。
 *
 * **実運用では `env.SESSION_SECRET` / `env.SESSION_SALT` を使う**(`@platform/env` で検証)。
 * salt は **アプリ/環境ごとに一意**にすること——固定の共有既定値だと、
 * 複数環境で同一鍵になりレインボーテーブル攻撃に弱くなる。
 */
export const session = createSession<{ email: string; loginAt: number }>({
  secret: process.env.SESSION_SECRET ?? "showcase-demo-session-secret-change-me",
  salt: process.env.SESSION_SALT ?? "showcase-demo-salt",
  cookie: { secure: process.env.NODE_ENV === "production" },
});
