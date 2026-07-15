"use client";
/**
 * 共通 PrintButton。クリックで HTML か指定要素を印刷する。
 * @packageDocumentation
 */
import * as React from "react";
import { Printer } from "lucide-react";
import { printHtml, printElement, printPage, type PrintOptions } from "@platform/print";
import { Button, type ButtonProps } from "./button.js";

/** {@link PrintButton} の props。 */
export interface PrintButtonProps extends Omit<ButtonProps, "onClick"> {
  /** 印刷する HTML(指定時はこれを印刷)。 */
  html?: string;
  /** 印刷する要素の ref(html 未指定時)。 */
  targetRef?: React.RefObject<HTMLElement | null>;
  /** 印刷オプション。 */
  printOptions?: PrintOptions;
}

/** 印刷ボタン。html / targetRef のいずれも無ければページ全体を印刷。 */
export function PrintButton({ html, targetRef, printOptions, children, ...props }: PrintButtonProps) {
  const onClick = () => {
    if (html != null) void printHtml(html, printOptions);
    else if (targetRef?.current) void printElement(targetRef.current, printOptions);
    else printPage();
  };
  return (
    <Button onClick={onClick} {...props}>
      <Printer className="mr-2 h-4 w-4" />
      {children ?? "印刷"}
    </Button>
  );
}
