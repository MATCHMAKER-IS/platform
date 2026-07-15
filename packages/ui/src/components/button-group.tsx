/**
 * 共通 ButtonGroup。ボタンを横に連結して 1 つの塊として見せる(表示切替・ページャ等)。
 * @packageDocumentation
 */
import * as React from "react";
import { cn } from "../lib/cn.js";

/** {@link ButtonGroup} の props。 */
export interface ButtonGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  /** 縦連結にする。 */
  vertical?: boolean;
}

/**
 * ボタンを連結表示する。子の Button の角丸を内側で潰し、境界を共有する。
 * @example
 * ```tsx
 * <ButtonGroup>
 *   <Button variant="secondary">日</Button>
 *   <Button variant="secondary">週</Button>
 *   <Button variant="secondary">月</Button>
 * </ButtonGroup>
 * ```
 */
export function ButtonGroup({ className, vertical, ...props }: ButtonGroupProps) {
  return (
    <div
      role="group"
      className={cn(
        "inline-flex",
        vertical ? "flex-col" : "flex-row",
        // 連結: 内側の角丸と境界線を調整
        vertical
          ? "[&>*:not(:first-child)]:rounded-t-none [&>*:not(:last-child)]:rounded-b-none [&>*:not(:first-child)]:-mt-px"
          : "[&>*:not(:first-child)]:rounded-l-none [&>*:not(:last-child)]:rounded-r-none [&>*:not(:first-child)]:-ml-px",
        className,
      )}
      {...props}
    />
  );
}
