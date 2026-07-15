import * as React from "react";
import { CmsNav } from "./cms-nav.js";
import { CmsClient } from "./cms-client.js";

export const metadata = { title: "記事管理" };

export default function CmsPage() {
  return (
    <>
      <CmsNav active="/cms" />
      <CmsClient />
    </>
  );
}
