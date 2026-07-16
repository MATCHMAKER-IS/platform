import * as React from "react";
import { CmsNav } from "../cms-nav";
import { MediaClient } from "./media-client";

export const metadata = { title: "メディアライブラリ" };

export default function CmsMediaPage() {
  return (
    <>
      <CmsNav active="/cms/media" />
      <MediaClient />
    </>
  );
}
