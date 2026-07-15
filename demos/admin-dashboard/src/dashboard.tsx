"use client";
/**
 * 統合管理ダッシュボード。各業務ドメイン(売上・経費・在庫・給与・監査)の要約を 1 画面に集約する。
 * AppShell + NavMenu + Tabs + KpiCard を組み合わせ、集計済みデータを表示する(集計は各基盤が担当)。
 * @packageDocumentation
 */
import * as React from "react";
import { AppShell, AppHeader, NavMenu, Tabs, TabsList, TabsTrigger, TabsContent, KpiCard, Card, DonutChart, Badge } from "@platform/ui";

/** ダッシュボードに渡す集計済みの各ドメイン指標。 */
export interface AdminDashboardData {
  sales: { thisMonth: number; lastMonth: number; outstanding: number };
  expenses: { thisMonth: number; pendingApprovals: number };
  inventory: { totalValue: number; lowStockItems: number };
  payroll: { grossThisMonth: number; headcount: number };
  audit: { events: number; chainValid: boolean };
  taxByRate: { rate: number; outputTax: number }[];
}

function yen(n: number): string {
  return `¥${n.toLocaleString("ja-JP")}`;
}

const NAV_ITEMS = [
  { label: "ダッシュボード", href: "/" },
  { label: "受発注", href: "/orders" },
  { label: "在庫", href: "/inventory" },
  { label: "請求・会計", href: "/accounting" },
  { label: "人事・給与", href: "/hr" },
  { label: "監査ログ", href: "/audit" },
];

/** 統合管理ダッシュボード。 */
export function AdminDashboard({ data }: { data: AdminDashboardData }) {
  return (
    <AppShell
      header={<AppHeader logo={<span className="font-semibold">社内基盤</span>} />}
      sidebar={<NavMenu items={NAV_ITEMS} currentPath="/" />}
    >
      <div className="flex flex-col gap-6 p-6">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold">経営ダッシュボード</h1>
          {data.audit.chainValid ? <Badge tone="success">監査ログ 改ざんなし</Badge> : <Badge tone="danger">監査ログ 要確認</Badge>}
        </div>

        <Tabs defaultValue="overview">
          <TabsList>
            <TabsTrigger value="overview">全体</TabsTrigger>
            <TabsTrigger value="finance">財務</TabsTrigger>
            <TabsTrigger value="hr">人事</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <KpiCard label="今月売上" value={data.sales.thisMonth} previous={data.sales.lastMonth} format={yen} />
              <KpiCard label="今月経費" value={data.expenses.thisMonth} format={yen} higherIsBetter={false} />
              <KpiCard label="在庫金額" value={data.inventory.totalValue} format={yen} />
              <KpiCard label="今月給与総額" value={data.payroll.grossThisMonth} format={yen} higherIsBetter={false} />
            </div>
          </TabsContent>

          <TabsContent value="finance">
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <div className="grid grid-cols-2 gap-4">
                <KpiCard label="売掛金残高" value={data.sales.outstanding} format={yen} higherIsBetter={false} />
                <KpiCard label="承認待ち経費" value={data.expenses.pendingApprovals} suffix=" 件" />
                <KpiCard label="在庫僅少品目" value={data.inventory.lowStockItems} suffix=" 件" higherIsBetter={false} />
                <KpiCard label="監査イベント" value={data.audit.events} suffix=" 件" />
              </div>
              <Card className="p-6">
                <h2 className="mb-4 text-sm font-medium text-[var(--color-muted)]">消費税(税率別 仮受)</h2>
                <DonutChart data={data.taxByRate.map((t) => ({ label: `${t.rate}%`, value: t.outputTax }))} centerLabel={yen(data.taxByRate.reduce((s, t) => s + t.outputTax, 0))} />
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="hr">
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
              <KpiCard label="従業員数" value={data.payroll.headcount} suffix=" 名" />
              <KpiCard label="今月給与総額" value={data.payroll.grossThisMonth} format={yen} higherIsBetter={false} />
              <KpiCard label="承認待ち経費" value={data.expenses.pendingApprovals} suffix=" 件" />
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}
