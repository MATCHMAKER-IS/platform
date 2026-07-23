"use client";
/**
 * useKeyboardShortcuts フック。単一コード("mod+k")と連続入力("g h")のショートカットを登録する。
 * @packageDocumentation
 */
import * as React from "react";
import { parseShortcut, matchShortcut, isSequence, parseSequence, sequenceMatches, type KeyChord } from "../lib/shortcut";

/** ショートカット定義。 */
export interface ShortcutBinding {
  /** "mod+k" や "g h"。 */
  keys: string;
  handler: (e: KeyboardEvent) => void;
  /** 入力欄にフォーカス中でも発火するか(既定 false)。 */
  enableInInput?: boolean;
}

function isEditable(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable;
}

/** ショートカットを登録する。isMac は省略時に自動判定。 */
/**
 * キーボード操作の登録。
 *
 * 慣れた人が速く動くための補助。**これだけでしかできない操作を作らない**
 * (知らない人には無いのと同じ)。
 *
 * 入力欄にいる間は動かさない(文字が打てなくなる)。
 * 割り当ては、ブラウザや読み上げソフトの操作と重ならないか確認する。
 */
export function useKeyboardShortcuts(bindings: ShortcutBinding[], isMac?: boolean): void {
  const bindingsRef = React.useRef(bindings);
  bindingsRef.current = bindings;

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const mac = isMac ?? /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
    let history: string[] = [];
    let timer: number | undefined;

    function onKeyDown(e: KeyboardEvent) {
      const editable = isEditable(e.target);
      const chord: KeyChord = { key: e.key, ctrlKey: e.ctrlKey, metaKey: e.metaKey, shiftKey: e.shiftKey, altKey: e.altKey };

      // 単一コード
      for (const b of bindingsRef.current) {
        if (isSequence(b.keys)) continue;
        if (editable && !b.enableInInput) continue;
        if (matchShortcut(chord, parseShortcut(b.keys), mac)) {
          e.preventDefault();
          b.handler(e);
          return;
        }
      }

      // 連続入力(修飾キーなしの通常キーのみ履歴に積む)
      if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key.length === 1) {
        history.push(e.key.toLowerCase());
        if (history.length > 8) history = history.slice(-8);
        window.clearTimeout(timer);
        timer = window.setTimeout(() => { history = []; }, 1000);
        for (const b of bindingsRef.current) {
          if (!isSequence(b.keys)) continue;
          if (editable && !b.enableInInput) continue;
          if (sequenceMatches(history, parseSequence(b.keys)) === "complete") {
            e.preventDefault();
            b.handler(e);
            history = [];
            return;
          }
        }
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.clearTimeout(timer);
    };
  }, [isMac]);
}
