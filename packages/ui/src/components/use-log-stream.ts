"use client";
/**
 * ログストリームを購読し、末尾 max 件を保持するフック。
 * @packageDocumentation
 */
import * as React from "react";
import { appendCapped } from "../lib/log.js";
import { createLogStream, type LogStreamOptions } from "../lib/log-stream.js";

/**
 * ストリームを購読して行配列を返す(末尾 max 件)。
 *
 * @param options.max 保持する件数(**ログは無限に流れてくる**)
 */
export function useLogStream(options: LogStreamOptions & { max?: number; paused?: boolean }): { lines: string[]; clear: () => void } {
  const { max = 1000, paused = false, ...streamOptions } = options;
  const [lines, setLines] = React.useState<string[]>([]);
  const pausedRef = React.useRef(paused);
  pausedRef.current = paused;

  React.useEffect(() => {
    const stream = createLogStream(streamOptions);
    const unsub = stream.subscribe((incoming) => {
      if (pausedRef.current) return;
      setLines((prev) => appendCapped(prev, incoming, max));
    });
    return () => { unsub(); stream.close(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [streamOptions.url, streamOptions.type, max]);

  return { lines, clear: () => setLines([]) };
}
