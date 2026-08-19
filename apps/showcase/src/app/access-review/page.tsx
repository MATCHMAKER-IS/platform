"use client";
import * as React from "react";
import { UsesPackages } from "../../components/uses-packages";
import { ReviewDemo } from "./review-demo";

export default function Page() {
  return (
    <main style={{ maxWidth: 1000, margin: "2rem auto", padding: "0 1rem" }}>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: 4 }}>権限の棚卸し</h1>
      <p style={{ fontSize: 13, color: "var(--color-muted)", marginBottom: 16 }}>
        退職者に残った権限・期限の無い強い権限・期限切れを機械的に洗い出します。
      </p>
      <ReviewDemo />
      <UsesPackages
        packages={["access-review"]}
        imports={{ "access-review": ["reviewAccess", "offboardingSteps"] }}
        snippet={`// 半年に1回の棚卸し。**正常なものは挙げない**(誤検知が混ざると読まれなくなる)
const findings = reviewAccess(people, grants, "2026-08-01");
findings.filter((f) => f.severity === "high");  // 退職者に残った権限など

// 退職時は**順序が大事**。権限だけ消してもセッションが生きていれば操作できる
offboardingSteps(person, grants);  // 1. セッション無効化 → 2. ログイン停止 → 3. 権限削除`}
      />
    </main>
  );
}
