import { describe, it, expect } from "vitest";
import { AppError, ErrorCode } from "@platform/core";
import { toUserMessage, toUserText, toUserMessageFor } from "./user-message";

// **業務システムを使うのは、パソコンが得意とは限らない人。**
// 文言が分からないと、情シスに電話がかかってくる
describe("toUserMessage", () => {
  it("入力の誤りは「直すところ」と伝える", () => {
    const m = toUserMessage(new AppError(ErrorCode.VALIDATION, "zod validation failed"));
    expect(m.title).toContain("直すところ");
    expect(m.recoverable).toBe(true);
  });

  // **元のメッセージを見せない。** 内部の事情(テーブル名・関数名)が混ざる
  it("開発者が書いた文言をそのまま出さない", () => {
    const m = toUserMessage(new AppError(ErrorCode.DATABASE, "P2002 unique constraint on ExpenseRow.userId"));
    expect(m.title).not.toContain("P2002");
    expect(m.title).not.toContain("ExpenseRow");
  });

  // **押しても直らないボタンは、不信につながる**
  it("利用者に直せないものは recoverable: false", () => {
    expect(toUserMessage(new AppError(ErrorCode.FORBIDDEN, "x")).recoverable).toBe(false);
    expect(toUserMessage(new AppError(ErrorCode.CONFIG, "x")).recoverable).toBe(false);
  });

  it("分類できないものにも案内を返す", () => {
    const m = toUserMessage(new Error("何か"));
    expect(m.title).not.toBe("");
    expect(m.action).not.toBe("");
  });

  // **専門用語を画面に出さない**
  it("専門用語を含まない", () => {
    const ng = ["バリデーション", "セッション", "トランザクション", "タイムアウト", "null", "undefined", "エラーコード"];
    for (const code of Object.values(ErrorCode)) {
      const m = toUserMessage(new AppError(code, "x"));
      for (const w of ng) {
        expect(`${m.title}${m.action}`, `${code} に「${w}」が入っています`).not.toContain(w);
      }
    }
  });

  // **「失敗しました」で終わらせない。** 次にすることが要る
  it("すべての案内が「次にすること」を含む", () => {
    for (const code of Object.values(ErrorCode)) {
      const m = toUserMessage(new AppError(code, "x"));
      expect(m.action.length, `${code} の案内が短すぎます`).toBeGreaterThan(10);
    }
  });
});

describe("toUserMessageFor", () => {
  it("操作名を添える", () => {
    const m = toUserMessageFor(new AppError(ErrorCode.DATABASE, "x"), "経費の保存");
    expect(m.title).toBe("経費の保存ができませんでした");
  });

  // **「経費の保存に、直すところがあります」とは言わない**
  it("入力の誤り・権限には操作名を足さない", () => {
    const v = toUserMessageFor(new AppError(ErrorCode.VALIDATION, "x"), "経費の保存");
    expect(v.title).not.toContain("経費の保存");
  });
});

describe("toUserText", () => {
  it("1 行にまとめる", () => {
    const text = toUserText(new AppError(ErrorCode.NOT_FOUND, "x"));
    expect(text).toContain("。");
    expect(text.split("\n")).toHaveLength(1);
  });
});
