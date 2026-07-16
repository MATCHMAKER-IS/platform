"use client";
/**
 * ソーシャルログイン一式。複数プロバイダのログインボタンを縦に並べ、区切り線でメール認証等と分ける。
 * @packageDocumentation
 */
import * as React from "react";
import { cn } from "../lib/cn";
import { SocialLoginButton, type SocialProvider } from "./social-login-button";

/** {@link SocialLoginGroup} の props。 */
export interface SocialLoginGroupProps {
  /** 表示するプロバイダ(この順に並ぶ)。 */
  providers: SocialProvider[];
  /** プロバイダ選択時のハンドラ(認証開始をアプリ側で行う)。 */
  onSelect?: (provider: SocialProvider) => void;
  /** プロバイダごとの遷移先 URL(指定するとリンクとして描画)。 */
  hrefs?: Partial<Record<SocialProvider, string>>;
  /** 読み込み中のプロバイダ(スピナー表示)。 */
  loadingProvider?: SocialProvider | null;
  /** ラベルの動詞(既定「ログイン」)。 */
  action?: string;
  className?: string;
}

/** ソーシャルログインボタンを縦に並べたグループ。 */
export function SocialLoginGroup({ providers, onSelect, hrefs, loadingProvider, action, className }: SocialLoginGroupProps) {
  return (
    <div className={cn("flex flex-col gap-2.5", className)}>
      {providers.map((provider) => (
        <SocialLoginButton
          key={provider}
          provider={provider}
          action={action}
          href={hrefs?.[provider]}
          loading={loadingProvider === provider}
          disabled={loadingProvider != null && loadingProvider !== provider}
          fullWidth
          onClick={onSelect ? () => onSelect(provider) : undefined}
        />
      ))}
    </div>
  );
}

/** {@link LoginDivider} の props。 */
export interface LoginDividerProps {
  /** 中央のラベル(既定「または」)。 */
  label?: string;
  className?: string;
}

/** 「または」区切り線。ソーシャルログインとメール認証の間に置く。 */
export function LoginDivider({ label = "または", className }: LoginDividerProps) {
  return (
    <div className={cn("flex items-center gap-3 text-xs text-[var(--color-muted)]", className)} role="separator">
      <span className="h-px flex-1 bg-[var(--color-border)]" />
      <span>{label}</span>
      <span className="h-px flex-1 bg-[var(--color-border)]" />
    </div>
  );
}
