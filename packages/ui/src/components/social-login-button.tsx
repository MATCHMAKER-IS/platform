"use client";
/**
 * ソーシャルログインボタン。プロバイダ(Google/Zoho など)のブランドに沿ったログインボタン。
 * 認証フロー自体はアプリ側(@platform/google / @platform/zoho / @platform/auth の OIDC)で行い、
 * このコンポーネントは onClick か href で開始点を提供する。
 * @packageDocumentation
 */
import * as React from "react";
import { cn } from "../lib/cn";

/** 対応プロバイダ。 */
export type SocialProvider = "google" | "zoho" | "microsoft" | "github" | "apple" | "line";

/** プロバイダごとの表示情報。 */
interface ProviderMeta {
  label: string;
  /** ボタンの見た目(白地=light, ブランド色地=brand)。 */
  style: "light" | "brand";
  /** brand スタイルの背景色・文字色。 */
  brandBg?: string;
  brandFg?: string;
}

const PROVIDERS: Record<SocialProvider, ProviderMeta> = {
  google: { label: "Google", style: "light" },
  zoho: { label: "Zoho", style: "light" },
  microsoft: { label: "Microsoft", style: "light" },
  github: { label: "GitHub", style: "brand", brandBg: "#24292f", brandFg: "#ffffff" },
  apple: { label: "Apple", style: "brand", brandBg: "#000000", brandFg: "#ffffff" },
  line: { label: "LINE", style: "brand", brandBg: "#06C755", brandFg: "#ffffff" },
};

/** 各プロバイダのブランドアイコン(SVG)。 */
function ProviderIcon({ provider }: { provider: SocialProvider }) {
  switch (provider) {
    case "google":
      return (
        <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
          <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92a8.78 8.78 0 0 0 2.68-6.62z" />
          <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z" />
          <path fill="#FBBC05" d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33z" />
          <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.46 3.44 1.35l2.58-2.58A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z" />
        </svg>
      );
    case "zoho":
      // Zoho の 4 色マーク(赤 Z / 青 O / 黄 H / 緑 O を象徴)
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
          <path fill="#E42527" d="M2 8h5.4v1.6l-3 3.9h3.1V15H1.9v-1.6l3-3.9H2z" />
          <circle cx="11.4" cy="11.5" r="3" fill="#089949" />
          <circle cx="18.6" cy="11.5" r="3" fill="#F9B21D" />
          <rect x="7.9" y="3.5" width="1.9" height="16" rx="0.9" fill="#226DB4" opacity="0" />
        </svg>
      );
    case "microsoft":
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
          <rect x="1" y="1" width="10" height="10" fill="#F25022" />
          <rect x="13" y="1" width="10" height="10" fill="#7FBA00" />
          <rect x="1" y="13" width="10" height="10" fill="#00A4EF" />
          <rect x="13" y="13" width="10" height="10" fill="#FFB900" />
        </svg>
      );
    case "github":
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M12 1a11 11 0 0 0-3.48 21.44c.55.1.75-.24.75-.53v-1.86c-3.06.67-3.71-1.47-3.71-1.47-.5-1.28-1.22-1.62-1.22-1.62-1-.68.08-.67.08-.67 1.1.08 1.68 1.14 1.68 1.14.98 1.68 2.57 1.2 3.2.92.1-.71.38-1.2.7-1.47-2.44-.28-5.01-1.22-5.01-5.43 0-1.2.43-2.18 1.14-2.95-.11-.28-.5-1.4.11-2.91 0 0 .93-.3 3.05 1.13a10.6 10.6 0 0 1 5.56 0c2.12-1.43 3.05-1.13 3.05-1.13.61 1.51.22 2.63.11 2.91.71.77 1.14 1.75 1.14 2.95 0 4.22-2.58 5.15-5.03 5.42.4.34.75 1.01.75 2.04v3.02c0 .3.2.64.76.53A11 11 0 0 0 12 1z" />
        </svg>
      );
    case "apple":
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M16.36 12.78c.02 2.5 2.19 3.33 2.22 3.34-.02.06-.35 1.2-1.15 2.37-.68 1.02-1.4 2.03-2.52 2.05-1.1.02-1.46-.65-2.72-.65-1.26 0-1.66.63-2.7.67-1.09.04-1.92-1.1-2.6-2.11-1.4-2.04-2.47-5.77-1.03-8.29a4.02 4.02 0 0 1 3.4-2.06c1.07-.02 2.07.72 2.72.72.65 0 1.87-.89 3.16-.76.54.02 2.05.22 3.02 1.64-.08.05-1.8 1.05-1.79 3.13zM14.3 5.3c.57-.7.96-1.66.85-2.62-.83.03-1.83.55-2.42 1.24-.53.62-1 1.6-.87 2.54.92.07 1.87-.47 2.44-1.16z" />
        </svg>
      );
    case "line":
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M12 3C6.9 3 3 6.3 3 10.4c0 3.7 3.1 6.8 7.3 7.4.3.06.7.2.8.44.08.22.05.55.03.77l-.12.72c-.04.22-.17.85.75.46 1.06-.44 5.7-3.36 7.77-5.75 1.43-1.57 2.11-3.16 2.11-4.7C24 6.3 20.1 3 12 3z" />
        </svg>
      );
  }
}

/** {@link SocialLoginButton} の props。 */
export interface SocialLoginButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** プロバイダ。 */
  provider: SocialProvider;
  /** ラベルの動詞(既定「ログイン」。例「登録」「続ける」)。children 指定時は無視。 */
  action?: string;
  /** href を指定するとリンク(<a>)として描画。 */
  href?: string;
  /** 読み込み中(スピナー表示・操作不可)。 */
  loading?: boolean;
  /** 横幅いっぱいに広げる。 */
  fullWidth?: boolean;
}

/** ソーシャルログインボタン。プロバイダのブランドに沿ったボタンを描画する。 */
export const SocialLoginButton = React.forwardRef<HTMLButtonElement, SocialLoginButtonProps>(
  ({ provider, action = "ログイン", href, loading = false, fullWidth = false, disabled, className, children, ...props }, ref) => {
    const meta = PROVIDERS[provider];
    const content = children ?? `${meta.label} で${action}`;
    const base = cn(
      "inline-flex items-center justify-center gap-2.5 rounded-[var(--radius)] h-10 px-4 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none",
      meta.style === "light"
        ? "border border-[var(--color-border)] bg-white text-[#3c4043] hover:bg-[var(--color-subtle)]"
        : "border border-transparent hover:opacity-90",
      fullWidth && "w-full",
      className,
    );
    const style = meta.style === "brand" ? { backgroundColor: meta.brandBg, color: meta.brandFg } : undefined;
    const inner = (
      <>
        <span className="shrink-0" aria-hidden="true">{loading ? <Spinner /> : <ProviderIcon provider={provider} />}</span>
        <span className="truncate">{content}</span>
      </>
    );

    if (href && !disabled && !loading) {
      return (
        <a href={href} className={base} style={style} role="button">
          {inner}
        </a>
      );
    }
    return (
      <button ref={ref} type="button" className={base} style={style} disabled={disabled || loading} aria-busy={loading} {...props}>
        {inner}
      </button>
    );
  },
);
SocialLoginButton.displayName = "SocialLoginButton";

/** 小さなスピナー。 */
function Spinner() {
  return (
    <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.25" />
      <path d="M22 12a10 10 0 0 1-10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
