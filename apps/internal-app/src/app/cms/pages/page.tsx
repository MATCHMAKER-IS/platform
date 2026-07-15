import * as React from "react";
import { CmsNav } from "../cms-nav.js";
import { PageClient } from "./page-client.js";

export const metadata = { title: "固定ページ管理" };

export default function CmsPagesPage() {
  return (
    <>
      <CmsNav active="/cms/pages" />
      <PageClient />
    </>
  );
}
