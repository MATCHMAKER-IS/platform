import * as React from "react";
import { CmsNav } from "../cms-nav.js";
import { DashboardClient } from "./dashboard-client.js";

export const metadata = { title: "ダッシュボード" };

export default function CmsDashboardPage() {
  return (
    <>
      <CmsNav active="/cms/dashboard" />
      <DashboardClient />
    </>
  );
}
