import { describe, it, expect } from "vitest";
import { toKanjiNumber, toDaijiAmount } from "./japanese-number.js";

describe("japanese number", () => {
  it("kanji", () => { expect(toKanjiNumber(12345)).toBe("一万二千三百四十五"); expect(toKanjiNumber(10)).toBe("十"); expect(toKanjiNumber(100010000)).toBe("一億一万"); expect(toKanjiNumber(0)).toBe("〇"); expect(toKanjiNumber(-42)).toBe("マイナス四十二"); });
  it("daiji", () => { expect(toKanjiNumber(15, { daiji: true })).toBe("壱拾五"); expect(toKanjiNumber(1234, { daiji: true })).toBe("壱千弐百参拾四"); });
  it("daiji amount", () => { expect(toDaijiAmount(12345)).toBe("金壱萬弐千参百四拾五円"); expect(toDaijiAmount(500, { withPrefix: false, withSuffix: false })).toBe("五百"); });
});
