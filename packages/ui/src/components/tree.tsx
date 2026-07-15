/**
 * 共通 Tree。階層データの展開/折りたたみ表示(部門・カテゴリ・組織図など)。
 * 制御/非制御どちらでも使える。選択はコールバックで受け取る。
 * @packageDocumentation
 */
import * as React from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "../lib/cn.js";

/** ツリーの 1 ノード。 */
export interface TreeNode {
  id: string;
  label: React.ReactNode;
  children?: TreeNode[];
  icon?: React.ReactNode;
  /** 付随データ(選択時に受け取れる)。 */
  data?: unknown;
}

/** {@link Tree} の props。 */
export interface TreeProps extends Omit<React.HTMLAttributes<HTMLUListElement>, "onSelect"> {
  nodes: TreeNode[];
  /** 選択中のノード ID。 */
  selectedId?: string;
  /** ノード選択時。 */
  onSelect?: (node: TreeNode) => void;
  /** 初期展開する ID 群(既定は全折りたたみ)。 */
  defaultExpandedIds?: string[];
}

/** 階層ツリー。行クリックで選択、三角で展開/折りたたみ。 */
export function Tree({ nodes, selectedId, onSelect, defaultExpandedIds, className, ...props }: TreeProps) {
  const [expanded, setExpanded] = React.useState<Set<string>>(() => new Set(defaultExpandedIds ?? []));
  const toggle = (id: string) => setExpanded((prev) => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });
  return (
    <ul role="tree" className={cn("text-sm", className)} {...props}>
      {nodes.map((node) => (
        <TreeItem key={node.id} node={node} depth={0} expanded={expanded} toggle={toggle} selectedId={selectedId} onSelect={onSelect} />
      ))}
    </ul>
  );
}

function TreeItem({ node, depth, expanded, toggle, selectedId, onSelect }: {
  node: TreeNode; depth: number; expanded: Set<string>; toggle: (id: string) => void;
  selectedId?: string; onSelect?: (node: TreeNode) => void;
}) {
  const hasChildren = !!node.children?.length;
  const isOpen = expanded.has(node.id);
  const isSelected = selectedId === node.id;
  return (
    <li role="treeitem" aria-expanded={hasChildren ? isOpen : undefined} aria-selected={isSelected}>
      <div
        className={cn(
          "flex cursor-pointer items-center gap-1 rounded-md py-1 pr-2 hover:bg-slate-100",
          isSelected && "bg-slate-100 font-medium",
        )}
        style={{ paddingLeft: `${depth * 1.1 + 0.25}rem` }}
        onClick={() => onSelect?.(node)}
      >
        {hasChildren ? (
          <button type="button" aria-label={isOpen ? "折りたたむ" : "展開する"}
            onClick={(e) => { e.stopPropagation(); toggle(node.id); }}
            className="flex h-4 w-4 shrink-0 items-center justify-center text-[var(--color-muted)]">
            <ChevronRight className={cn("h-3.5 w-3.5 transition-transform", isOpen && "rotate-90")} />
          </button>
        ) : (
          <span className="h-4 w-4 shrink-0" aria-hidden />
        )}
        {node.icon && <span className="shrink-0">{node.icon}</span>}
        <span className="truncate">{node.label}</span>
      </div>
      {hasChildren && isOpen && (
        <ul role="group">
          {node.children!.map((child) => (
            <TreeItem key={child.id} node={child} depth={depth + 1} expanded={expanded} toggle={toggle} selectedId={selectedId} onSelect={onSelect} />
          ))}
        </ul>
      )}
    </li>
  );
}
