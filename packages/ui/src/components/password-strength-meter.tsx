"use client";
/**
 * 共通 PasswordStrengthMeter。強度スコア(0〜4)を 4 本のバーで可視化する。
 * スコアは `@platform/crypto` の `passwordStrength()` で算出して渡す
 * (UI は crypto に依存せず、値だけ受け取る)。
 * @packageDocumentation
 */
import * as React from "react";
import { cn } from "../lib/cn.js";
import { useT } from "./i18n-provider.js";

/** {@link PasswordStrengthMeter} の props。 */
export interface PasswordStrengthMeterProps {
  /** 強度スコア(0〜4)。 */
  score: 0 | 1 | 2 | 3 | 4;
  /** 表示ラベル(例: "強い")。省略時は非表示。 */
  label?: string;
  className?: string;
}

const COLORS = ["#dc2626", "#f97316", "#eab308", "#65a30d", "#0f766e"]; // 弱→強

/**
 * パスワード強度メーター。
 * @example
 * ```tsx
 * const s = passwordStrength(pw); // @platform/crypto
 * <PasswordStrengthMeter score={s.score} label={s.label} />
 * ```
 */
export function PasswordStrengthMeter({ score, label, className }: PasswordStrengthMeterProps) {
  const t = useT();
  const color = COLORS[score];
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <div className="flex gap-1" role="meter" aria-valuenow={score} aria-valuemin={0} aria-valuemax={4} aria-label={t("password.strength")}>
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-1.5 flex-1 rounded-full"
            style={{ backgroundColor: i < score ? color : "#e2e8f0" }}
          />
        ))}
      </div>
      {label && <span className="text-xs" style={{ color }}>{label}</span>}
    </div>
  );
}
