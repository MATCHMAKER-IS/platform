"use client";
/**
 * 共通 SoftwareKeyboard(react-simple-keyboard ラッパー)。
 * キオスク・タッチ端末向けのオンスクリーンキーボード。
 * @packageDocumentation
 */
import * as React from "react";
import Keyboard from "react-simple-keyboard";
import "react-simple-keyboard/build/css/index.css";
import { cn } from "../lib/cn";

/** {@link SoftwareKeyboard} の props。 */
export interface SoftwareKeyboardProps {
  /** 入力が変わったとき(全文字列)。 */
  onChange?: (input: string) => void;
  /** キー押下時。 */
  onKeyPress?: (button: string) => void;
  /** レイアウト名(例: "default" / "shift")。 */
  layoutName?: string;
  className?: string;
}

/** オンスクリーンキーボード。 */
export function SoftwareKeyboard({ onChange, onKeyPress, layoutName = "default", className }: SoftwareKeyboardProps) {
  return (
    <div className={cn("platform-osk", className)}>
      <Keyboard onChange={onChange} onKeyPress={onKeyPress} layoutName={layoutName} />
    </div>
  );
}
