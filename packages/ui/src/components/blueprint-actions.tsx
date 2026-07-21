"use client";
/**
 * ブループリントのアクション UI。現在の状態バッジと、実行できる遷移のボタンを出し分ける。
 * blueprint パッケージには依存せず、算出済みのアクション一覧を受け取る(疎結合)。
 * @packageDocumentation
 */
import * as React from "react";
import { cn } from "../lib/cn";
import { Badge } from "./badge";
import { Button } from "./button";

/** 実行可能なアクション(遷移)。 */
export interface BlueprintAction {
  /** 遷移名(ボタン表示)。 */
  name: string;
  /** 押せない場合 true。 */
  disabled?: boolean;
  /** 押せない理由(必須項目不足など。ツールチップ表示)。 */
  reason?: string;
  /** 危険操作(却下など)は控えめな見た目に。 */
  danger?: boolean;
}

/** 状態ごとのバッジ色分け。 */
export interface BlueprintStateStyle {
  label?: string;
  tone?: "default" | "info" | "success" | "warning" | "danger";
}

/** {@link BlueprintActions} の props。 */
export interface BlueprintActionsProps {
  /** 現在の状態。 */
  state: string;
  /** 状態の表示設定(ラベル・色)。 */
  stateStyles?: Record<string, BlueprintStateStyle>;
  /** 実行できるアクション。 */
  actions: BlueprintAction[];
  /** アクション実行時。 */
  onAction: (name: string) => void;
  /** 終了状態なら操作を隠す。 */
  isFinal?: boolean;
  className?: string;
}

/** 状態表示 + アクションボタン群。 */
export function BlueprintActions({ state, stateStyles, actions, onAction, isFinal, className }: BlueprintActionsProps) {
  const style = stateStyles?.[state];
  return (
    <div className={cn("flex flex-wrap items-center gap-3", className)}>
      <span className="text-sm text-[var(--color-muted)]">状態</span>
      <Badge variant={style?.tone ?? "default"}>{style?.label ?? state}</Badge>

      {!isFinal && actions.length > 0 && (
        <div className="ml-auto flex flex-wrap gap-2">
          {actions.map((action) => (
            <Button
              key={action.name}
              variant={action.danger ? "ghost" : "primary"}
              size="sm"
              disabled={action.disabled}
              title={action.disabled ? action.reason : undefined}
              onClick={() => onAction(action.name)}
            >
              {action.name}
            </Button>
          ))}
        </div>
      )}

      {isFinal && <Badge variant="success">完了</Badge>}
    </div>
  );
}
