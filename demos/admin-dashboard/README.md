# @demos/admin-dashboard — 統合管理ダッシュボード

各業務ドメイン（売上・経費・在庫・給与・監査）の要約を 1 画面に集約。`AppShell` + `NavMenu` + `Tabs` + `KpiCard` + `DonutChart` で、
全体／財務／人事のタブに KPI を配置します。監査ログの改ざん検知バッジ、消費税の税率別ドーナツも表示。
集計は各基盤（accounting/inventory/payroll/audit）が担当し、この画面は表示のみに徹します。
