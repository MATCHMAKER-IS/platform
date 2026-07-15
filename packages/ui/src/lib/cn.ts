/**
 * Tailwind クラスを安全に結合するユーティリティ。
 * 条件付きクラスと重複解決(tailwind-merge)をまとめて扱う。
 * @packageDocumentation
 */
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * クラス名を結合し、競合する Tailwind ユーティリティを後勝ちで解決する。
 * @param inputs クラス値(文字列・条件・配列など)
 * @returns 結合済みのクラス文字列
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
