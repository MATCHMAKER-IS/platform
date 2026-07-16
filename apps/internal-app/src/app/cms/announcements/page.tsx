import * as React from "react";
import { CmsNav } from "../cms-nav";
import { AnnouncementClient } from "./announcement-client";

export const metadata = { title: "お知らせ管理" };

export default function CmsAnnouncementsPage() {
  return (
    <>
      <CmsNav active="/cms/announcements" />
      <AnnouncementClient />
    </>
  );
}
