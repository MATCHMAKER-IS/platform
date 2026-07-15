"use client";
/**
 * ⌘K で開くコマンドパレットの実結線例。
 * useKeyboardShortcuts で "mod+k"(⌘K / Ctrl+K)を登録し、CommandPalette の開閉に結ぶ。
 * "g h" のような連続入力でのページ遷移も併せて示す。
 * @packageDocumentation
 */
import * as React from "react";
import { CommandPalette, useKeyboardShortcuts, type Command } from "@platform/ui";

/** {@link CommandMenu} の props。 */
export interface CommandMenuProps {
  /** パレットに出すコマンド。 */
  commands: Command[];
  /** ページ遷移(href 付きコマンド用)。 */
  onNavigate: (href: string) => void;
}

/** ⌘K でパレットを開き、g h 等のショートカットも登録する。 */
export function CommandMenu({ commands, onNavigate }: CommandMenuProps) {
  const [open, setOpen] = React.useState(false);

  // ⌘K でパレット開閉。g h でダッシュボードへ。入力欄でも ⌘K は有効に。
  useKeyboardShortcuts([
    { keys: "mod+k", handler: () => setOpen((v) => !v), enableInInput: true },
    { keys: "g h", handler: () => onNavigate("/") },
    { keys: "g b", handler: () => onNavigate("/bookings") },
  ]);

  return (
    <CommandPalette
      open={open}
      onOpenChange={setOpen}
      commands={commands}
      onSelect={(c) => { if (c.href) onNavigate(c.href); }}
    />
  );
}

/** サンプルのコマンド定義(ショートカット表示付き)。 */
export const SAMPLE_COMMANDS: Command[] = [
  { id: "home", label: "ダッシュボード", href: "/", group: "ページ", keywords: ["home", "トップ"], shortcut: "G H" },
  { id: "bookings", label: "予約一覧", href: "/bookings", group: "ページ", keywords: ["booking"], shortcut: "G B" },
  { id: "casts", label: "キャスト一覧", href: "/casts", group: "ページ", keywords: ["cast"] },
  { id: "new-booking", label: "新規予約を作成", href: "/bookings/new", group: "操作", keywords: ["add", "作成"] },
  { id: "settings", label: "設定", href: "/settings", group: "ページ" },
];
