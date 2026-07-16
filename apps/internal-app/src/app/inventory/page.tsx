import * as React from "react";
import { InventoryClient } from "./inventory-client";

export const metadata = { title: "在庫管理" };

export default function InventoryPage() {
  return <InventoryClient />;
}
