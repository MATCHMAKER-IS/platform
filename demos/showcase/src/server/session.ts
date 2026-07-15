import { createSession } from "@platform/session";
/** デモ用セッション。実運用では env.SESSION_SECRET を使う。 */
export const session = createSession<{ email: string; loginAt: number }>({
  secret: process.env.SESSION_SECRET ?? "showcase-demo-session-secret-change-me",
  cookie: { secure: process.env.NODE_ENV === "production" },
});
