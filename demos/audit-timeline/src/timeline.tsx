"use client";
/**
 * 監査ログのタイムライン画面。@platform/audit の履歴を @platform/ui の ActivityTimeline で可視化する。
 * 改ざん検知(verifyChain)の結果もバッジで表示する。
 * @packageDocumentation
 */
import * as React from "react";
import { ActivityTimeline, Badge, Card, type TimelineItem } from "@platform/ui";
import { historyOf, verifyChain, describeEvent, diffChanges, type AuditEntry } from "@platform/audit";

/** 操作 → タイムラインの点の色。 */
const STATUS_BY_ACTION: Record<string, "success" | "info" | "warning" | "danger" | "default"> = {
  "expense.create": "default",
  "expense.submit": "info",
  "expense.approve": "success",
  "expense.reject": "danger",
  "expense.journal": "success",
};

function toneForAction(action: string): "success" | "info" | "warning" | "danger" | "default" {
  const key = Object.keys(STATUS_BY_ACTION).find((k) => action.startsWith(k));
  return key ? STATUS_BY_ACTION[key]! : "default";
}

/** 監査エントリを ActivityTimeline のアイテムに変換する。 */
function toItems(entries: AuditEntry[]): TimelineItem[] {
  return entries.map((e) => {
    const changes = diffChanges(e.before, e.after);
    const tone = toneForAction(e.action);
    const status = tone === "default" ? undefined : tone;
    return {
      title: `${e.action}`,
      timestamp: `${e.at.slice(0, 19).replace("T", " ")} ・ ${e.actor}`,
      description: changes.length > 0 ? changes.map((c) => `${c.field}: ${String(c.before ?? "―")} → ${String(c.after ?? "―")}`).join(" / ") : undefined,
      status,
    };
  });
}

/** {@link AuditTimelineScreen} の props。 */
export interface AuditTimelineScreenProps {
  /** 監査ログ全体。 */
  log: AuditEntry[];
  /** 対象(例: "expense:1")。指定するとその履歴だけ表示。 */
  target?: string;
}

/** 監査ログのタイムライン画面。 */
export function AuditTimelineScreen({ log, target }: AuditTimelineScreenProps) {
  const entries = target ? historyOf(log, target) : log;
  const chain = verifyChain(log);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">操作履歴{target ? `（${target}）` : ""}</h1>
        {chain.valid ? (
          <Badge tone="success">改ざんなし</Badge>
        ) : (
          <Badge tone="danger">改ざん検知（#{chain.brokenAt}）</Badge>
        )}
      </div>

      <Card className="p-6">
        {entries.length > 0 ? (
          <ActivityTimeline items={toItems(entries)} />
        ) : (
          <p className="text-sm text-[var(--color-muted)]">記録がありません。</p>
        )}
      </Card>
    </div>
  );
}

export { describeEvent };
