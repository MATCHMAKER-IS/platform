import * as React from "react";
import { CmsNav } from "../cms-nav";
import { CategoryClient } from "./category-client";

export const metadata = { title: "カテゴリ・タグ管理" };

export default function CmsCategoriesPage() {
  return (
    <>
      <CmsNav active="/cms/categories" />
      <CategoryClient />
    </>
  );
}
