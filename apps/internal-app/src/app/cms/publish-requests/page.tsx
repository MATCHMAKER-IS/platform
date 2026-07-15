import * as React from "react";
import { CmsNav } from "../cms-nav.js";
import { PublishRequestClient } from "./publish-request-client.js";

export const metadata = { title: "公開申請の承認" };

export default function CmsPublishRequestsPage() {
  return (
    <>
      <CmsNav active="/cms/publish-requests" />
      <PublishRequestClient />
    </>
  );
}
