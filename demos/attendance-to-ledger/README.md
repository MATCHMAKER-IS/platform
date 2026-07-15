# @demos/attendance-to-ledger — 勤怠→給与→仕訳の通し画面

勤怠集計 → 給与計算（`@platform/payroll`）→ 給与明細 → 給与仕訳起票（`@platform/accounting`）までを Steps で辿る画面。
各段を「次へ」で確認でき、最終段で貸借一致した給与仕訳（部門付き）を表示します。
