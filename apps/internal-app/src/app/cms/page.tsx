import * as React from "react";
import { CmsNav } from "./cms-nav";
import { CmsClient } from "./cms-client";

export const metadata = { title: "記事管理" };

export default function CmsPage() {
  return (
    <>
      <CmsNav active="/cms" />
      <CmsClient />
    </>
  );
}
