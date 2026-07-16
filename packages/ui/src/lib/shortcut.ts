/**
 * キーボードショートカットの解析・照合(純ロジック・React 非依存)。
 * "mod+k"(Mac は ⌘、他は Ctrl)や "ctrl+shift+p"、"g h"(連続入力)を扱う。
 * @packageDocumentation
 */

/** 解析済みショートカット(単一コード)。 */
export interface ParsedShortcut {
  key: string;
  /** mod = Mac の ⌘ / それ以外の Ctrl。 */
  mod: boolean;
  ctrl: boolean;
  meta: boolean;
  shift: boolean;
  alt: boolean;
}

/** キー入力(KeyboardEvent 互換の最小形)。 */
export interface KeyChord {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
}

const MOD_TOKENS = new Set(["mod", "cmdctrl"]);

/**
 * ショートカット文字列を解析する。
 *
 * **`mod` は Mac なら ⌘、他なら Ctrl**。これを使うと、OS ごとに書き分けなくてよい。
 *
 * @param combo `mod+shift+k` のような文字列
 * @returns 解析した修飾キーとキー
 */
export function parseShortcut(input: string): ParsedShortcut {
  const parts = input.toLowerCase().split("+").map((p) => p.trim()).filter(Boolean);
  const result: ParsedShortcut = { key: "", mod: false, ctrl: false, meta: false, shift: false, alt: false };
  for (const p of parts) {
    if (MOD_TOKENS.has(p)) result.mod = true;
    else if (p === "ctrl" || p === "control") result.ctrl = true;
    else if (p === "meta" || p === "cmd" || p === "command" || p === "win") result.meta = true;
    else if (p === "shift") result.shift = true;
    else if (p === "alt" || p === "option" || p === "opt") result.alt = true;
    else result.key = p;
  }
  return result;
}

/**
 * キー入力がショートカットに一致するかを判定する。
 *
 * @param event キーイベント
 * @param combo ショートカット文字列
 * @param isMac Mac か(**`mod` の解決に使う**)
 * @returns 一致すれば true
 */
export function matchShortcut(chord: KeyChord, shortcut: ParsedShortcut, isMac: boolean): boolean {
  if (chord.key.toLowerCase() !== shortcut.key) return false;
  const wantCtrl = shortcut.ctrl || (shortcut.mod && !isMac);
  const wantMeta = shortcut.meta || (shortcut.mod && isMac);
  return chord.ctrlKey === wantCtrl && chord.metaKey === wantMeta && chord.shiftKey === shortcut.shift && chord.altKey === shortcut.alt;
}

/**
 * ショートカットを表示用にする。
 *
 * **Mac は記号(⌘⇧K)、他は語(Ctrl+Shift+K)**。OS の慣習に合わせないと、
 * 利用者は自分のキーボードのどれを押すか分からない。
 *
 * @param combo ショートカット文字列
 * @param isMac Mac か
 * @returns 表示用の文字列
 */
export function formatShortcut(shortcut: ParsedShortcut, isMac: boolean): string {
  const parts: string[] = [];
  if (shortcut.mod) parts.push(isMac ? "⌘" : "Ctrl");
  if (shortcut.ctrl) parts.push(isMac ? "⌃" : "Ctrl");
  if (shortcut.alt) parts.push(isMac ? "⌥" : "Alt");
  if (shortcut.shift) parts.push(isMac ? "⇧" : "Shift");
  if (shortcut.meta && !shortcut.mod) parts.push(isMac ? "⌘" : "Win");
  parts.push(shortcut.key.length === 1 ? shortcut.key.toUpperCase() : shortcut.key);
  return isMac ? parts.join("") : parts.join("+");
}

/**
 * 連続入力かを判定する(`g h` のように空白区切り)。
 *
 * **Vim 風の連続キー**(g を押してから h)。同時押しとは区別が要る。
 *
 * @param combo ショートカット文字列
 * @returns 連続入力なら true
 */
export function isSequence(input: string): boolean {
  return input.trim().includes(" ");
}

/**
 * 連続入力をキーの配列に分解する。
 *
 * @param combo `g h` のような文字列
 * @returns `["g", "h"]`
 */
export function parseSequence(input: string): string[] {
  return input.toLowerCase().split(/\s+/).map((k) => k.trim()).filter(Boolean);
}

/**
 * 入力履歴が目的の連続入力にどこまで一致しているか。
 * 履歴の末尾が連続入力の「先頭からの一致」になっているかを見る(g→h の途中で g だけなら partial)。
 *
 * @param pressed 押されたキーの列
 * @param combo 連続入力のショートカット
 * @returns 一致すれば true(**途中まで一致していれば待つ**)
 */
export function sequenceMatches(history: string[], sequence: string[]): "complete" | "partial" | "none" {
  if (sequence.length === 0) return "none";
  let best = 0;
  for (let k = 1; k <= sequence.length; k++) {
    if (history.length < k) break;
    const tail = history.slice(history.length - k);
    const prefix = sequence.slice(0, k);
    if (tail.every((v, i) => v === prefix[i])) best = k;
  }
  if (best === sequence.length) return "complete";
  return best >= 1 ? "partial" : "none";
}
