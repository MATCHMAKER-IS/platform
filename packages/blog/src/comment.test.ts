import { describe, it, expect } from "vitest";
import { buildCommentTree, approvedComments, sortComments, countComments, pendingCount } from "./comment.js";
const comments = [
  { id: "1", author: "A", body: "最初", createdAt: "2025-07-20T10:00:00Z", status: "approved" as const },
  { id: "2", parentId: "1", author: "B", body: "返信", createdAt: "2025-07-20T11:00:00Z", status: "approved" as const },
  { id: "3", author: "C", body: "別", createdAt: "2025-07-21T10:00:00Z", status: "pending" as const },
  { id: "4", parentId: "1", author: "D", body: "返信2", createdAt: "2025-07-20T12:00:00Z", status: "approved" as const },
];
describe("comment", () => {
  it("builds tree, filters, sorts, counts", () => {
    const tree = buildCommentTree(comments);
    expect(tree).toHaveLength(2);
    expect(tree[0]!.replies).toHaveLength(2);
    expect(approvedComments(comments)).toHaveLength(3);
    expect(sortComments(comments, "newest")[0]!.id).toBe("3");
    expect(countComments(tree)).toBe(4);
    expect(pendingCount(comments)).toBe(1);
  });
});
