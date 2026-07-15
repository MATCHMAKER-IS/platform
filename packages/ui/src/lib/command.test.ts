import { describe, it, expect } from "vitest";
import { scoreCommand, filterCommands, groupCommands, nextIndex, type Command } from "./command.js";
const cmds: Command[] = [
  { id: "1", label: "ダッシュボード", keywords: ["home"], group: "ページ" },
  { id: "2", label: "予約一覧", keywords: ["booking"], group: "ページ" },
  { id: "3", label: "新規予約を作成", keywords: ["add"], group: "操作" },
  { id: "4", label: "設定", group: "ページ" },
];
describe("ui command lib", () => {
  it("scores and filters", () => {
    expect(scoreCommand(cmds[0]!, "ダッシュ")).toBe(3);
    expect(scoreCommand(cmds[2]!, "予約")).toBe(2);
    expect(scoreCommand(cmds[1]!, "booking")).toBe(1);
    expect(scoreCommand(cmds[3]!, "予約")).toBeNull();
    expect(filterCommands(cmds, "").map((c) => c.id)).toEqual(["1", "2", "3", "4"]);
    expect(filterCommands(cmds, "予約").map((c) => c.id).sort()).toEqual(["2", "3"]);
    expect(filterCommands([{ id: "a", label: "予約作成" }, { id: "b", label: "新規予約" }], "予約")[0]!.id).toBe("a");
    expect(filterCommands(cmds, "", 2)).toHaveLength(2);
  });
  it("groups and navigates", () => {
    const g = groupCommands(cmds);
    expect(g.map((x) => x.group)).toEqual(["ページ", "操作"]);
    expect(groupCommands([{ id: "x", label: "X" }])[0]!.group).toBe("その他");
    expect(nextIndex(0, 3, -1)).toBe(2);
    expect(nextIndex(2, 3, 1)).toBe(0);
    expect(nextIndex(0, 0, 1)).toBe(-1);
  });
});
