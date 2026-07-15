import * as React from "react";
import { CmsNav } from "../cms-nav.js";
import { HistoryClient } from "./history-client.js";

export const metadata = { title: "操作履歴" };

export default function CmsHistoryPage() {
  return (
    <>
      <CmsNav active="/cms/history" />
      <HistoryClient />
    </>
  );
}
