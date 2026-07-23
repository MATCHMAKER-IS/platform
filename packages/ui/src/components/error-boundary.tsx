"use client";
/**
 * エラー境界。子コンポーネントで投げられた描画エラーを捕捉し、フォールバックを表示する。
 * @packageDocumentation
 */
import * as React from "react";

/** {@link ErrorBoundary} の props。 */
export interface ErrorBoundaryProps {
  children: React.ReactNode;
  /** エラー時の表示(関数なら error を受け取る)。 */
  fallback?: React.ReactNode | ((error: Error, reset: () => void) => React.ReactNode);
  /** エラー発生時のコールバック(ログ送信等)。 */
  onError?: (error: Error, info: { componentStack: string }) => void;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/** 描画エラーを捕捉するエラー境界。 */
/**
 * 画面の一部が壊れたときの受け皿。
 *
 * 1 か所の例外で**全画面が白くなる**のを防ぐ。
 * ダッシュボードのように独立した部品が並ぶ画面では、
 * **タイルごとに囲む**と、1 つ壊れても他が見られる。
 *
 * 何が起きたかを見せ、再読み込みの手段を出すこと。
 * 例外の内容は `@platform/observability` へ送り、利用者には見せない
 * (内部の構造が漏れる)。
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { error: null };
    this.reset = this.reset.bind(this);
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  override componentDidCatch(error: Error, info: { componentStack: string }): void {
    this.props.onError?.(error, info);
  }

  reset(): void {
    this.setState({ error: null });
  }

  override render(): React.ReactNode {
    if (this.state.error) {
      const { fallback } = this.props;
      if (typeof fallback === "function") return fallback(this.state.error, this.reset);
      if (fallback != null) return fallback;
      return (
        <div role="alert" className="rounded-[var(--radius)] border border-red-200 bg-red-50 p-6 text-center">
          <p className="text-sm font-medium text-red-700">問題が発生しました</p>
          <button type="button" onClick={this.reset} className="mt-3 rounded-[var(--radius)] border border-red-300 px-3 py-1.5 text-sm text-red-700 hover:bg-red-100">
            再読み込み
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
