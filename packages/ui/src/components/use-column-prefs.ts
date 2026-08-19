"use client";
/**
 * 列設定フック。マウント時にストアからロードし、変更時に保存する。
 * @packageDocumentation
 */
import * as React from "react";
import { emptyColumnPrefs, type ColumnPrefs, type ColumnPrefsStore } from "../lib/column-prefs";

/**
 * 列設定をロード/保存するフック。
 *
 * @param store 保存先（**Claude 上の成果物では localStorage が使えない**ので、渡す形にしてあります）
 * @param table テーブルの識別子(**テーブルごとに設定を分ける**)
 * @param initial 保存が無いときの初期設定
 */
export function useColumnPrefs(store: ColumnPrefsStore, table: string, initial: ColumnPrefs = emptyColumnPrefs) {
  const [prefs, setPrefs] = React.useState<ColumnPrefs>(initial);
  React.useEffect(() => {
    let active = true;
    void (async () => { const saved = await store.load(table); if (active && saved) setPrefs(saved); })();
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table]);
  const update = React.useCallback((p: ColumnPrefs) => { setPrefs(p); void store.save(table, p); }, [store, table]);
  return { prefs, setPrefs: update };
}
