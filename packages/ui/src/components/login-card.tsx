"use client";
/**
 * ログインカード。ソーシャルログイン(Google/Zoho など)を中心に、タイトル・ロゴ・
 * 区切り線・メール認証スロット・エラー表示・フッターを 1 枚にまとめた完成版のログイン画面。
 * 認証フロー自体はアプリ側(@platform/google / @platform/zoho / @platform/auth の OIDC)で行い、
 * ここは開始点(onSelectProvider / hrefs)と見た目を提供する。
 * @packageDocumentation
 */
import * as React from "react";
import { cn } from "../lib/cn";
import { SocialLoginGroup, LoginDivider } from "./social-login-group";
import { type SocialProvider } from "./social-login-button";

/** {@link LoginCard} の props。 */
export interface LoginCardProps {
  /** 見出し(既定「ログイン」)。 */
  title?: string;
  /** 補足文(既定なし)。 */
  subtitle?: string;
  /** ロゴ(見出しの上に表示)。 */
  logo?: React.ReactNode;
  /** 表示するプロバイダ(既定 Google と Zoho)。 */
  providers?: SocialProvider[];
  /** プロバイダ選択時のハンドラ(認証開始)。 */
  onSelectProvider?: (provider: SocialProvider) => void;
  /** プロバイダごとの遷移先 URL(指定するとリンクとして描画)。 */
  hrefs?: Partial<Record<SocialProvider, string>>;
  /** 読み込み中のプロバイダ(スピナー表示)。 */
  loadingProvider?: SocialProvider | null;
  /** ボタンの動詞(既定「ログイン」。例「登録」「続ける」)。 */
  action?: string;
  /** エラーメッセージ(あれば赤帯で表示)。 */
  error?: string;
  /**
   * メール認証など、区切り線の下に置く追加要素。指定すると「または」区切り線が入る。
   */
  children?: React.ReactNode;
  /** カード下部の補足(利用規約・新規登録リンクなど)。 */
  footer?: React.ReactNode;
  className?: string;
}

/** 既定のプロバイダ(Google と Zoho)。 */
const DEFAULT_PROVIDERS: SocialProvider[] = ["google", "zoho"];

/** ソーシャルログイン中心の完成版ログインカード。 */
export function LoginCard({
  title = "ログイン",
  subtitle,
  logo,
  providers = DEFAULT_PROVIDERS,
  onSelectProvider,
  hrefs,
  loadingProvider,
  action = "ログイン",
  error,
  children,
  footer,
  className,
}: LoginCardProps) {
  return (
    <div className={cn("w-full max-w-sm rounded-[calc(var(--radius)*1.5)] border border-[var(--color-border)] bg-[var(--color-card,#fff)] p-6 shadow-sm sm:p-8", className)}>
      {logo != null && <div className="mb-5 flex justify-center">{logo}</div>}

      <div className="mb-6 text-center">
        <h1 className="text-lg font-semibold text-[var(--color-fg)]">{title}</h1>
        {subtitle != null && <p className="mt-1 text-sm text-[var(--color-muted)]">{subtitle}</p>}
      </div>

      {error != null && (
        <div className="mb-4 rounded-[var(--radius)] border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {error}
        </div>
      )}

      <SocialLoginGroup
        providers={providers}
        onSelect={onSelectProvider}
        hrefs={hrefs}
        loadingProvider={loadingProvider}
        action={action}
      />

      {children != null && (
        <>
          <LoginDivider className="my-5" />
          {children}
        </>
      )}

      {footer != null && <div className="mt-6 text-center text-xs text-[var(--color-muted)]">{footer}</div>}
    </div>
  );
}
