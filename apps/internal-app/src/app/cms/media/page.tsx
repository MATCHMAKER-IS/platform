import * as React from "react";
import { CmsNav } from "../cms-nav.js";
import { MediaClient } from "./media-client.js";

export const metadata = { title: "メディアライブラリ" };

export default function CmsMediaPage() {
  return (
    <>
      <CmsNav active="/cms/media" />
      <MediaClient />
    </>
  );
}
