"use client";
/**
 * 権限に応じた UI 出し分け。`/api/auth/me` の features を使う。
 */
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

interface AuthState {
  user: { email: string; name?: string; roles: string[] } | null;
  features: Record<string, boolean>;
  loading: boolean;
}

const AuthContext = createContext<AuthState>({ user: null, features: {}, loading: true });

/** ルートに置くプロバイダ。 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ user: null, features: {}, loading: true });
  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : { user: null, features: {} }))
      .then((d: { user: AuthState["user"]; features?: Record<string, boolean> }) => setState({ user: d.user, features: d.features ?? {}, loading: false }))
      .catch(() => setState({ user: null, features: {}, loading: false }));
  }, []);
  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}

/** 現在のユーザー/機能フラグを取得。 */
export function useAuth(): AuthState {
  return useContext(AuthContext);
}

/** feature が許可されている時だけ children を描画。 */
export function Can({ feature, fallback = null, children }: { feature: string; fallback?: ReactNode; children: ReactNode }) {
  const { features } = useAuth();
  return features[feature] ? <>{children}</> : <>{fallback}</>;
}

/** ロインしていない時にログイン導線を出す簡易バナー。 */
export function LoginGate({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) {
    return (
      <div style={{ padding: 16 }}>
        <a href="/api/auth/zoho/login">Zoho でログイン</a>
      </div>
    );
  }
  return <>{children}</>;
}
