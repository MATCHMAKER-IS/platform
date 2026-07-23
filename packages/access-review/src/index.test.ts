import { describe, it, expect } from "vitest";
import { reviewAccess, offboardingSteps, summarizeReview, isStrongGrant, isActiveGrant, type Person, type AccessGrant } from "./index";

const people: Person[] = [
  { userId: "u1", name: "山田", department: "経理", status: "active" },
  { userId: "u2", name: "佐藤", department: "営業", status: "resigned", resignedOn: "2026-03-31" },
  { userId: "u3", name: "田中", department: "開発", status: "leave" },
];

const base = { grantedBy: "admin", reason: "業務のため" };

describe("reviewAccess", () => {
  it("退職者に残った権限を最優先で検出する", () => {
    const f = reviewAccess(people, [{ userId: "u2", grant: "expense:approve:any", grantedOn: "2026-01-01", ...base }], "2026-07-23");
    expect(f[0].severity).toBe("high");
    expect(f[0].reason).toContain("退職者");
  });

  it("名簿に無い利用者の権限を検出する(誰の権限か分からないため最も危ない)", () => {
    const f = reviewAccess(people, [{ userId: "unknown", grant: "admin", grantedOn: "2026-01-01", ...base }], "2026-07-23");
    expect(f[0].severity).toBe("high");
    expect(f[0].reason).toContain("名簿に存在しない");
  });

  it("期限の無い強い権限を検出する(恒久的に持たせない)", () => {
    const f = reviewAccess(people, [{ userId: "u1", grant: "pii:unmask", grantedOn: "2026-07-01", ...base }], "2026-07-23");
    expect(f.some((x) => x.severity === "high" && x.reason.includes("期限が設定されていません"))).toBe(true);
  });

  it("期限切れなのに残っている権限を検出する", () => {
    const f = reviewAccess(people, [{ userId: "u1", grant: "system:manage", grantedOn: "2026-06-01", expiresOn: "2026-07-01", ...base }], "2026-07-23");
    expect(f[0].reason).toContain("期限");
  });

  it("長く見直していない権限を検出する", () => {
    const f = reviewAccess(people, [{ userId: "u1", grant: "expense:read:own", grantedOn: "2025-01-01", ...base }], "2026-07-23");
    expect(f.some((x) => x.reason.includes("見直されていません"))).toBe(true);
  });

  it("理由の無い権限を検出する(次に要否を判断できない)", () => {
    const f = reviewAccess(people, [{ userId: "u1", grant: "expense:read:own", grantedOn: "2026-07-01", grantedBy: "a", reason: "" }], "2026-07-23");
    expect(f.some((x) => x.severity === "low" && x.reason.includes("理由"))).toBe(true);
  });

  it("既に外した権限は対象にしない", () => {
    const g: AccessGrant = { userId: "u2", grant: "admin", grantedOn: "2025-01-01", revokedOn: "2026-04-01", ...base };
    expect(reviewAccess(people, [g], "2026-07-23")).toHaveLength(0);
  });

  it("正常な権限は何も出ない", () => {
    const g: AccessGrant = { userId: "u1", grant: "expense:read:own", grantedOn: "2026-07-01", lastReviewedOn: "2026-07-01", ...base };
    expect(reviewAccess(people, [g], "2026-07-23")).toHaveLength(0);
  });
});

describe("isStrongGrant / isActiveGrant", () => {
  it("ワイルドカードと管理系を強い権限とみなす", () => {
    expect([isStrongGrant("*"), isStrongGrant("expense:*"), isStrongGrant("pii:unmask"), isStrongGrant("expense:read")])
      .toEqual([true, true, true, false]);
  });

  it("外した権限・期限切れは有効でない", () => {
    expect(isActiveGrant({ userId: "u", grant: "a", grantedOn: "2026-01-01", revokedOn: "2026-06-01", ...base }, "2026-07-23")).toBe(false);
    expect(isActiveGrant({ userId: "u", grant: "a", grantedOn: "2026-01-01", expiresOn: "2026-06-01", ...base }, "2026-07-23")).toBe(false);
    expect(isActiveGrant({ userId: "u", grant: "a", grantedOn: "2026-01-01", ...base }, "2026-07-23")).toBe(true);
  });
});

describe("offboardingSteps", () => {
  it("セッションの無効化を最初に行う(権限だけ消しても操作できるため)", () => {
    const steps = offboardingSteps(people[1], [{ userId: "u2", grant: "admin", grantedOn: "2025-01-01", ...base }]);
    expect(steps[0].title).toContain("セッション");
    expect(steps.map((s) => s.order)).toEqual([1, 2, 3, 4, 5]);
  });
});

describe("summarizeReview", () => {
  it("深刻度ごとの件数と対象人数を返す", () => {
    const f = reviewAccess(people, [
      { userId: "u2", grant: "admin", grantedOn: "2026-01-01", ...base },
      { userId: "u3", grant: "deploy", grantedOn: "2026-07-01", ...base },
    ], "2026-07-23");
    const s = summarizeReview(f);
    expect(s.high).toBeGreaterThan(0);
    expect(s.affectedUsers).toBe(2);
  });
});
