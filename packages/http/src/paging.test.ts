import { describe, it, expect } from "vitest";
import {
  parseOffsetPaging, parseCursorPaging, buildOffsetPage, buildCursorPage,
  parseSort, buildLinkHeader, MAX_LIMIT, DEFAULT_LIMIT,
} from "./paging";

describe("parseOffsetPaging(オフセット方式)", () => {
  it("**不正な値は既定に丸める**（エラーにしない）", () => {
    expect(parseOffsetPaging({ page: "abc" }).page).toBe(1);
    expect(parseOffsetPaging({ page: "0" }).page).toBe(1);
    expect(parseOffsetPaging({ page: "-5" }).page).toBe(1);
    expect(parseOffsetPaging({ limit: "-1" }).limit).toBe(DEFAULT_LIMIT);
  });

  it("**上限を必ず守る**（記憶域を食い尽くされない）", () => {
    expect(parseOffsetPaging({ limit: "100000" }).limit).toBe(MAX_LIMIT);
  });

  it("page は 1 始まりで offset を計算する", () => {
    expect(parseOffsetPaging({ page: "1", limit: "10" }).offset).toBe(0);
    expect(parseOffsetPaging({ page: "3", limit: "10" }).offset).toBe(20);
  });

  it("URLSearchParams でも素のオブジェクトでも使える", () => {
    const sp = new URLSearchParams("page=2&limit=5");
    expect(parseOffsetPaging(sp).offset).toBe(5);
  });

  it("perPage という名前も受ける", () => {
    expect(parseOffsetPaging({ perPage: "5" }).limit).toBe(5);
  });

  it("上限は呼び出し側で下げられる", () => {
    expect(parseOffsetPaging({ limit: "100" }, { maxLimit: 50 }).limit).toBe(50);
  });
});

describe("parseCursorPaging(カーソル方式)", () => {
  it("カーソルが無ければ未指定", () => {
    expect(parseCursorPaging({}).cursor).toBeUndefined();
  });

  it("空文字は未指定として扱う", () => {
    expect(parseCursorPaging({ cursor: "" }).cursor).toBeUndefined();
  });

  it("上限を守る", () => {
    expect(parseCursorPaging({ limit: "9999" }).limit).toBe(MAX_LIMIT);
  });
});

describe("buildOffsetPage(応答の組み立て)", () => {
  it("総ページ数と前後の有無を返す", () => {
    const p = buildOffsetPage([1, 2, 3], 25, parseOffsetPaging({ page: "2", limit: "10" }));
    expect(p.totalPages).toBe(3);
    expect(p.hasNext).toBe(true);
    expect(p.hasPrev).toBe(true);
  });

  it("1 ページ目には前が無い", () => {
    const p = buildOffsetPage([1], 5, parseOffsetPaging({ page: "1", limit: "10" }));
    expect(p.hasPrev).toBe(false);
    expect(p.hasNext).toBe(false);
  });

  it("0 件でも落ちない", () => {
    const p = buildOffsetPage([], 0, parseOffsetPaging({}));
    expect(p.totalPages).toBe(0);
    expect(p.hasNext).toBe(false);
  });
});

describe("buildCursorPage(カーソル方式の応答)", () => {
  it("**1 件多く取れていれば次がある**（総件数を数えない）", () => {
    const c = buildCursorPage([{ id: "a" }, { id: "b" }, { id: "c" }], 2, (r) => r.id);
    expect(c.items).toHaveLength(2);
    expect(c.nextCursor).toBe("b");
    expect(c.hasNext).toBe(true);
  });

  it("末尾ならカーソルを返さない", () => {
    const c = buildCursorPage([{ id: "a" }], 2, (r) => r.id);
    expect(c.hasNext).toBe(false);
    expect(c.nextCursor).toBeUndefined();
  });

  it("0 件でも落ちない", () => {
    const c = buildCursorPage([], 10, (r: { id: string }) => r.id);
    expect(c.items).toHaveLength(0);
    expect(c.hasNext).toBe(false);
  });
});

describe("parseSort(並び順)", () => {
  const fallback = { field: "createdAt", direction: "desc" } as const;

  it("先頭の `-` が降順", () => {
    expect(parseSort({ sort: "-name" }, ["name"], fallback)).toEqual({ field: "name", direction: "desc" });
    expect(parseSort({ sort: "name" }, ["name"], fallback)).toEqual({ field: "name", direction: "asc" });
  });

  it("**許可した項目以外は既定に戻す**（クエリの値を信用しない）", () => {
    expect(parseSort({ sort: "password" }, ["name"], fallback)).toEqual(fallback);
  });

  it("指定が無ければ既定", () => {
    expect(parseSort({}, ["name"], fallback)).toEqual(fallback);
    expect(parseSort({ sort: "" }, ["name"], fallback)).toEqual(fallback);
  });
});

describe("buildLinkHeader(RFC 8288)", () => {
  it("next / last を含む", () => {
    const p = buildOffsetPage([1], 25, parseOffsetPaging({ page: "2", limit: "10" }));
    const link = buildLinkHeader("https://x.example/api/items", p);
    expect(link).toContain('rel="next"');
    expect(link).toContain('rel="last"');
    expect(link).toContain('rel="prev"');
  });

  it("**元のクエリを保つ**（絞り込み条件が消えない）", () => {
    const p = buildOffsetPage([1], 25, parseOffsetPaging({ page: "2", limit: "10" }));
    expect(buildLinkHeader("https://x.example/api/items?q=abc", p)).toContain("q=abc");
  });

  it("1 ページしか無ければ空", () => {
    const p = buildOffsetPage([1], 5, parseOffsetPaging({ limit: "10" }));
    expect(buildLinkHeader("https://x.example/a", p)).toBe("");
  });
});
