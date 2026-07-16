"use client";
/**
 * 共通 DataView。同じデータをカード表示 / リスト表示 / ブロック表示で切り替えて描画する。
 * 表示モードごとに描画を差し替えられ、ViewToggle でユーザーが切り替えられる。
 * @packageDocumentation
 */
import * as React from "react";
import { LayoutGrid, List as ListIcon, LayoutDashboard } from "lucide-react";
import { cn } from "../lib/cn";
import { useT } from "./i18n-provider";
import { CardGrid } from "./card";
import { List } from "./list";
import { BlockGrid } from "./block";

/** 表示モード。 */
export type ViewMode = "card" | "list" | "block";

const MODE_ICON: Record<ViewMode, React.ComponentType<{ className?: string }>> = {
  card: LayoutGrid,
  list: ListIcon,
  block: LayoutDashboard,
};
const MODE_LABEL: Record<ViewMode, string> = { card: "カード", list: "リスト", block: "ブロック" };

/** {@link ViewToggle} の props。 */
export interface ViewToggleProps {
  value: ViewMode;
  onChange: (mode: ViewMode) => void;
  /** 選択肢(既定 card/list/block)。 */
  modes?: ViewMode[];
  className?: string;
}

/** 表示モードの切り替えボタン群。 */
export function ViewToggle({ value, onChange, modes = ["card", "list", "block"], className }: ViewToggleProps) {
  const t = useT();
  return (
    <div className={cn("inline-flex rounded-[var(--radius)] border border-[var(--color-border)] p-0.5", className)} role="tablist" aria-label={t("view.toggle")}>
      {modes.map((m) => {
        const Icon = MODE_ICON[m];
        const active = m === value;
        return (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={active}
            aria-label={`${MODE_LABEL[m]}表示`}
            title={`${MODE_LABEL[m]}表示`}
            onClick={() => onChange(m)}
            className={cn(
              "flex h-8 w-9 items-center justify-center rounded-[calc(var(--radius)-2px)] text-[var(--color-muted)]",
              active && "bg-[var(--color-primary)] text-[var(--color-primary-fg)]",
            )}
          >
            <Icon className="h-4 w-4" />
          </button>
        );
      })}
    </div>
  );
}

/** {@link DataView} の props。 */
export interface DataViewProps<T> {
  /** 表示するデータ。 */
  items: T[];
  /** 各項目の描画(現在の表示モードが渡る)。card→Card, list→ListItem, block→Block を返す想定。 */
  renderItem: (item: T, mode: ViewMode) => React.ReactNode;
  /** key の取得。 */
  getKey: (item: T, index: number) => React.Key;
  /** 表示モード(制御する場合)。 */
  view?: ViewMode;
  /** 初期表示モード(非制御時、既定 "card")。 */
  defaultView?: ViewMode;
  /** 表示モード変更時。 */
  onViewChange?: (mode: ViewMode) => void;
  /** ViewToggle を表示するか(既定 true)。 */
  showToggle?: boolean;
  /** 利用する表示モード。 */
  modes?: ViewMode[];
  /** カード/ブロックの最小幅。 */
  cardMinWidth?: number;
  blockMinWidth?: number;
  /** データが空のときの表示。 */
  empty?: React.ReactNode;
  /** ツールバー左側に置く要素(件数表示など)。 */
  toolbarStart?: React.ReactNode;
  className?: string;
}

/**
 * データをカード/リスト/ブロックで切り替え表示する。
 * @example
 * ```tsx
 * <DataView
 *   items={products}
 *   getKey={(p) => p.id}
 *   renderItem={(p, mode) =>
 *     mode === "list"
 *       ? <ListItem title={p.name} description={p.category} trailing={`¥${p.price}`} />
 *       : mode === "block"
 *         ? <Block label={p.name} icon={<Icon name="package" />} />
 *         : <Card><CardHeader><CardTitle>{p.name}</CardTitle></CardHeader><CardContent>¥{p.price}</CardContent></Card>
 *   }
 * />
 * ```
 */
export function DataView<T>({
  items, renderItem, getKey, view, defaultView = "card", onViewChange,
  showToggle = true, modes, cardMinWidth, blockMinWidth, empty, toolbarStart, className,
}: DataViewProps<T>) {
  const t = useT();
  const [internal, setInternal] = React.useState<ViewMode>(defaultView);
  const mode = view ?? internal;
  const setMode = (m: ViewMode) => { onViewChange?.(m); if (view === undefined) setInternal(m); };

  const body = items.length === 0
    ? <div className="rounded-[var(--radius)] border border-dashed border-[var(--color-border)] p-8 text-center text-sm text-[var(--color-muted)]">{empty ?? "データがありません"}</div>
    : mode === "list"
      ? <List>{items.map((it, i) => <React.Fragment key={getKey(it, i)}>{renderItem(it, "list")}</React.Fragment>)}</List>
      : mode === "block"
        ? <BlockGrid minWidth={blockMinWidth}>{items.map((it, i) => <React.Fragment key={getKey(it, i)}>{renderItem(it, "block")}</React.Fragment>)}</BlockGrid>
        : <CardGrid minWidth={cardMinWidth}>{items.map((it, i) => <React.Fragment key={getKey(it, i)}>{renderItem(it, "card")}</React.Fragment>)}</CardGrid>;

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {(showToggle || toolbarStart) && (
        <div className="flex items-center justify-between gap-2">
          <div className="text-sm text-[var(--color-muted)]">{toolbarStart}</div>
          {showToggle && <ViewToggle value={mode} onChange={setMode} modes={modes} />}
        </div>
      )}
      {body}
    </div>
  );
}
