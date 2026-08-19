import { createSession } from "@platform/session";
import { showcaseEnv } from "./env";

/**
 * デモ用セッション。
 *
 * **実運用では `env.SESSION_SECRET` / `env.SESSION_SALT` を使う**(`@platform/env` で検証)。
 * salt は **アプリ/環境ごとに一意**にすること——固定の共有既定値だと、
 * 複数環境で同一鍵になりレインボーテーブル攻撃に弱くなる。
 */
export const session = createSession<{ email: string; loginAt: number }>({
  secret: showcaseEnv.SESSION_SECRET ?? "showcase-session-secret-change-me",
  salt: showcaseEnv.SESSION_SALT ?? "showcase-salt",
  cookie: { secure: process.env.NODE_ENV === "production" },
});
