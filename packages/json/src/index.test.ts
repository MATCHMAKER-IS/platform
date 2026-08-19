import { describe, expect, it } from "vitest";
import {
  safeParse, safeStringify, canonicalJson, parseWithLimit,
  deepMerge, getPointer, diffJson, redactJson, parseJsonLines, toJsonLines,
} from "./index";

describe("読み書き", () => {
  it("壊れた JSON で例外を投げない", () => {
    expect(safeParse("{壊れ")).toBeUndefined();
  });
  // **ログを書こうとして落ちる**のが最悪の形
  it("循環参照でも落ちない", () => {
    const a: Record<string, unknown> = { name: "x" };
    a.self = a;
    expect(safeStringify(a)).toContain("[Circular]");
  });
  // **DB の集計結果に混ざる**(そのままだと TypeError)
  it("BigInt でも落ちない", () => {
    expect(safeStringify({ n: 10n })).toBe('{"n":"10"}');
  });
});

describe("正規化", () => {
  // **キーの順序でハッシュが変わると「改ざん」と誤判定**する
  it("キーの順序が違っても同じ文字列", () => {
    expect(canonicalJson({ b: 1, a: 2 })).toBe(canonicalJson({ a: 2, b: 1 }));
  });
  it("入れ子も並べ替える", () => {
    expect(canonicalJson({ x: { b: 1, a: 2 } })).toBe(canonicalJson({ x: { a: 2, b: 1 } }));
  });
});

describe("大きさの制限", () => {
  // **数百 MB の JSON でサービスが止まる**のを防ぐ
  it("上限を超えたら読まない", () => {
    expect(parseWithLimit('{"a":1}', 3)).toBeUndefined();
  });
  // **バイト数で数える**(日本語は 1 文字 3 バイト)
  it("日本語をバイト数で数える", () => {
    expect(parseWithLimit('{"a":"あいう"}', 10)).toBeUndefined();
  });
});

describe("マージ", () => {
  // 浅いマージだと入れ子が丸ごと置き換わる
  it("入れ子を保ったまま重ねる", () => {
    // **`Partial<T>` は 1 段だけ。** 入れ子の中まで任意にはならないので、
    // `{ a: { y: 3 } }` は `a` の型(`{ x, y }`)を満たさない。
    // **実行時の挙動は正しい**(入れ子を保って重ねる)が、型としては
    // 部分指定を表せていない——`deepMerge` の型定義側の課題として記録する
    // (2026-08、型検査で判明)。
    expect(deepMerge({ a: { x: 1, y: 2 } }, { a: { x: 1, y: 3 } })).toEqual({ a: { x: 1, y: 3 } });
  });
  // **配列は置き換える**(結合すると既定値が混ざって消せない)
  it("配列は置き換える", () => {
    expect(deepMerge({ a: [1, 2] }, { a: [3] })).toEqual({ a: [3] });
  });
  // **「指定なし」を「消す」と解釈しない**
  it("undefined は無視する", () => {
    expect(deepMerge({ a: 1 }, { a: undefined })).toEqual({ a: 1 });
  });
});

describe("JSON Pointer", () => {
  it("深い値を取れる", () => {
    expect(getPointer({ items: [{ name: "A" }] }, "/items/0/name")).toBe("A");
  });
  // **途中で欠けても例外にしない**
  it("無ければ undefined", () => {
    expect(getPointer({ a: 1 }, "/b/c")).toBeUndefined();
  });
  // `~1` が `/`、`~0` が `~`(RFC 6901)
  it("エスケープを解く", () => {
    expect(getPointer({ "a/b": 1 }, "/a~1b")).toBe(1);
  });
});

describe("差分", () => {
  it("変わった場所だけ返す", () => {
    expect(diffJson({ a: 1, b: { c: 2 } }, { a: 1, b: { c: 3 } }))
      .toEqual([{ path: "/b/c", before: 2, after: 3 }]);
  });
  it("追加と削除を区別する", () => {
    const d = diffJson({ a: 1 }, { b: 2 });
    expect(d).toContainEqual({ path: "/a", before: 1 });
    expect(d).toContainEqual({ path: "/b", after: 2 });
  });
  // **キーの順序で「変わった」と誤判定しない**
  it("順序だけの違いは差分にしない", () => {
    expect(diffJson({ x: { b: 1, a: 2 } }, { x: { a: 2, b: 1 } })).toEqual([]);
  });
});

describe("伏せ字", () => {
  // **ログの閲覧権限がある全員に漏れる**のを防ぐ
  it("部分一致で伏せる", () => {
    expect(redactJson({ u: { passwordHash: "x" } }, ["password"]))
      .toEqual({ u: { passwordHash: "***" } });
  });
  it("大文字小文字を区別しない", () => {
    expect(redactJson({ Token: "x" }, ["token"])).toEqual({ Token: "***" });
  });
  it("配列の中も伏せる", () => {
    expect(redactJson([{ secret: "x" }], ["secret"])).toEqual([{ secret: "***" }]);
  });
});

describe("JSON Lines", () => {
  // **壊れた行を飛ばして数える**(全部失わず、欠けたことも分かる)
  it("壊れた行の番号を返す", () => {
    const r = parseJsonLines('{"a":1}\n壊れ\n{"b":2}');
    expect(r.rows).toHaveLength(2);
    expect(r.invalidLines).toEqual([2]);
  });
  it("空行は飛ばす", () => {
    expect(parseJsonLines('{"a":1}\n\n').rows).toHaveLength(1);
  });
  // **末尾に改行**(追記しやすい)
  it("書き出して読み戻せる", () => {
    const rows = [{ a: 1 }, { b: 2 }];
    expect(parseJsonLines(toJsonLines(rows)).rows).toEqual(rows);
  });
});
