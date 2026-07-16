import * as React from "react";
import { CmsNav } from "../cms-nav";
import { DashboardClient } from "./dashboard-client";

export const metadata = { title: "ダッシュボード" };

export default function CmsDashboardPage() {
  return (
    <>
      <CmsNav active="/cms/dashboard" />
      <DashboardClient />
    </>
  );
}
