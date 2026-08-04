"use client";
/**
 * OCR 認識テキストを信頼度で色分け表示する。手書き数字の確認に便利。
 * @packageDocumentation
 */
import { cn } from "../lib/cn";
import { classifyConfidence, type ConfidenceThresholds, type ConfidenceProfile, type ConfidenceTier } from "../lib/confidence";
import { useT } from "./i18n-provider";

/** 表示する単語/文字。 */
export interface ConfidenceToken { text: string; confidence?: number }

/** {@link ConfidenceHighlight} の props。 */
export interface ConfidenceHighlightProps {
  tokens: ConfidenceToken[];
  thresholds?: ConfidenceThresholds | ConfidenceProfile;
  /** 低信頼度のみ強調(高/中は通常表示)。 */
  lowOnly?: boolean;
  className?: string;
}

const TIER_CLASS: Record<ConfidenceTier, string> = {
  high: "bg-transparent",
  medium: "bg-[color-mix(in_srgb,var(--color-warning)_15%,transparent)] text-[var(--color-warning)]",
  low: "bg-[color-mix(in_srgb,var(--color-danger)_15%,transparent)] text-[var(--color-danger)] underline decoration-wavy decoration-red-400",
};

/** 信頼度で色分けした OCR テキスト。 */
export function ConfidenceHighlight({ tokens, thresholds, lowOnly = false, className }: ConfidenceHighlightProps) {
  const t = useT();
  return (
    <span className={cn("leading-relaxed", className)}>
      {tokens.map((tok, i) => {
        const tier = classifyConfidence(tok.confidence, thresholds);
        const show = !lowOnly || tier === "low";
        return (
          <span key={i} className={cn("rounded px-0.5", show ? TIER_CLASS[tier] : "")} title={tok.confidence != null ? t("ocr.confidenceValue", { value: Math.round(tok.confidence) }) : t("ocr.confidenceUnknown")}>
            {tok.text}{i < tokens.length - 1 ? " " : ""}
          </span>
        );
      })}
    </span>
  );
}
