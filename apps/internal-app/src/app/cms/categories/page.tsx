import * as React from "react";
import { CmsNav } from "../cms-nav.js";
import { CategoryClient } from "./category-client.js";

export const metadata = { title: "カテゴリ・タグ管理" };

export default function CmsCategoriesPage() {
  return (
    <>
      <CmsNav active="/cms/categories" />
      <CategoryClient />
    </>
  );
}
