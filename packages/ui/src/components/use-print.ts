"use client";
/**
 * 印刷フック。ref を付けた要素を印刷、または任意 HTML を印刷する(@platform/print ラッパー)。
 * @packageDocumentation
 */
import * as React from "react";
import { printElement, printHtml, type PrintOptions, type PrintElementOptions } from "@platform/print";

export interface UsePrintResult<T extends HTMLElement> {
  /** 印刷したい要素に付ける ref。 */
  ref: React.RefObject<T | null>;
  /** ref の要素を印刷する。 */
  print: () => Promise<void>;
  /** 任意の HTML を印刷する。 */
  printContent: (html: string, options?: PrintOptions) => Promise<void>;
}

/**
 * 印刷フック。
 *
 *
 * @param options 用紙・向き・余白
 * @returns 印刷の操作(**印刷ダイアログが開く**)
 */
export function usePrint<T extends HTMLElement = HTMLDivElement>(options?: PrintElementOptions): UsePrintResult<T> {
  const ref = React.useRef<T | null>(null);
  const print = React.useCallback(async () => {
    if (ref.current) await printElement(ref.current, options);
  }, [options]);
  const printContent = React.useCallback(async (html: string, opts?: PrintOptions) => {
    await printHtml(html, opts);
  }, []);
  return { ref, print, printContent };
}
