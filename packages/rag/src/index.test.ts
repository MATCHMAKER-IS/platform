import { describe, it, expect } from "vitest";
import {
  chunkDocument, canAccess, createRagStore, buildContext, cosineSimilarity,
  createMemoryVectorIndex, textToDocument, splitTextToDocuments,
  type RagDocument, type Principal, type RagSearchBackend,
} from "./index";
import { boostExactKeyword } from "./rerank";
import { ok } from "@platform/core";

/** 検索バックエンドの最小実装(部分一致 + 出現数をスコアに)。 */
function memoryBackend(): RagSearchBackend {
  let docs: { id: string; title: string; body: string }[] = [];
  return {
    async index(next) { docs = [...docs, ...next]; return ok(undefined); },
    async search(query, limit) {
      const q = query.toLowerCase();
      const hits = docs
        .map((d) => ({ document: d, score: (`${d.title}\n${d.body}`.toLowerCase().split(q).length - 1) }))
        .filter((h) => h.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);
      return ok(hits);
    },
    async delete(ids) { docs = docs.filter((d) => !ids.includes(d.id)); return ok(undefined); },
  };
}

const doc = (id: string, body: string, acl?: RagDocument["acl"]): RagDocument => ({
  id, title: `${id} の資料`, body, ...(acl ? { acl } : {}),
});

describe("canAccess(権限継承の中核)", () => {
  const taro: Principal = { id: "taro", roles: ["sales"] };

  it("ACL 未設定は既定で不可(明示 public を要求する)", () => {
    // 「付け忘れたら全員に見える」だと事故が静かに起きるため、既定は不可
    expect(canAccess(taro, undefined)).toBe(false);
  });

  it("public は誰でも可", () => {
    expect(canAccess(taro, { public: true })).toBe(true);
  });

  it("users に本人が含まれれば可", () => {
    expect(canAccess(taro, { users: ["taro"] })).toBe(true);
    expect(canAccess(taro, { users: ["hanako"] })).toBe(false);
  });

  it("roles が 1 つでも一致すれば可", () => {
    expect(canAccess(taro, { roles: ["sales", "admin"] })).toBe(true);
    expect(canAccess(taro, { roles: ["admin"] })).toBe(false);
  });

  it("空の users / roles では通さない", () => {
    expect(canAccess(taro, { users: [], roles: [] })).toBe(false);
  });
});

describe("chunkDocument", () => {
  it("段落境界で分割する", () => {
    const chunks = chunkDocument(doc("d1", "一段落目。\n\n二段落目。\n\n三段落目。"), { maxChars: 12, overlap: 0 });
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[0]?.text).toContain("一段落目");
  });

  it("id は docId#連番・index が振られる", () => {
    const chunks = chunkDocument(doc("d1", "あ\n\nい\n\nう"), { maxChars: 3, overlap: 0 });
    expect(chunks.map((c) => c.id)).toEqual(chunks.map((_, i) => `d1#${i}`));
    expect(chunks.map((c) => c.index)).toEqual(chunks.map((_, i) => i));
    expect(chunks.every((c) => c.docId === "d1")).toBe(true);
  });

  it("maxChars を超える段落は強制分割し、各断片は maxChars 以内に収まる", () => {
    const chunks = chunkDocument(doc("d1", "あ".repeat(100)), { maxChars: 30, overlap: 5 });
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((c) => c.text.length <= 30)).toBe(true);
  });

  it("overlap は maxChars の半分に丸められる(重ねすぎて進まなくなるのを防ぐ)", () => {
    const chunks = chunkDocument(doc("d1", "あ".repeat(200)), { maxChars: 20, overlap: 999 });
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((c) => c.text.length <= 20)).toBe(true);
  });

  it("空文・空白だけの段落は落とす", () => {
    expect(chunkDocument(doc("d1", "")).length).toBe(0);
    expect(chunkDocument(doc("d1", "\n\n   \n\n")).length).toBe(0);
  });

  it("文書の acl をチャンクへ引き継ぐ(引き継がないと権限フィルタが効かない)", () => {
    const chunks = chunkDocument(doc("d1", "本文", { roles: ["hr"] }));
    expect(chunks[0]?.acl).toEqual({ roles: ["hr"] });
  });
});

describe("createRagStore.retrieve(権限を継承した検索)", () => {
  const setup = async () => {
    const store = createRagStore({ backend: memoryBackend(), chunk: { maxChars: 200, overlap: 0 } });
    await store.ingest([
      doc("open", "経費 精算の申請方法について", { public: true }),
      doc("hr", "経費 と給与の内部資料", { roles: ["hr"] }),
      doc("mine", "経費 の個人メモ", { users: ["taro"] }),
      doc("noacl", "経費 の ACL 無し資料"),
    ]);
    return store;
  };

  it("権限を満たさない文書は結果に出ない", async () => {
    const store = await setup();
    const r = await store.retrieve("経費", { id: "taro", roles: ["sales"] }, 10);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const ids = r.value.map((h) => h.chunk.docId).sort();
    expect(ids).toEqual(["mine", "open"]); // hr(ロール不一致)と noacl(ACL 無し)は出ない
  });

  it("ロールを持つ人には見える", async () => {
    const store = await setup();
    const r = await store.retrieve("経費", { id: "hanako", roles: ["hr"] }, 10);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.map((h) => h.chunk.docId)).toContain("hr");
  });

  it("**管理者でも全件は返さない**(ADR: 利用者の権限を継承する)", async () => {
    const store = await setup();
    const r = await store.retrieve("経費", { id: "admin", roles: ["admin"] }, 10);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    // admin ロールは どの ACL にも含まれないので public だけ
    expect(r.value.map((h) => h.chunk.docId)).toEqual(["open"]);
  });

  it("空クエリは VALIDATION で失敗する", async () => {
    const store = await setup();
    const r = await store.retrieve("   ", { id: "taro", roles: [] });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.code).toBe("VALIDATION");
  });

  it("limit 件までに絞る", async () => {
    const store = createRagStore({ backend: memoryBackend() });
    await store.ingest([1, 2, 3, 4, 5].map((n) => doc(`d${n}`, "共通語", { public: true })));
    const r = await store.retrieve("共通語", { id: "x", roles: [] }, 2);
    expect(r.ok && r.value.length).toBe(2);
  });

  it("remove すると検索に出なくなる", async () => {
    const store = await setup();
    await store.remove(["open"]);
    const r = await store.retrieve("経費", { id: "taro", roles: ["sales"] }, 10);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.map((h) => h.chunk.docId)).not.toContain("open");
  });
});

describe("buildContext", () => {
  const hit = (id: string, text: string, source?: string) => ({
    chunk: { id, docId: id, title: `${id}の資料`, text, index: 0, ...(source ? { source } : {}) },
    score: 1,
  });

  it("引用元(番号・タイトル)を必ず付ける", () => {
    const ctx = buildContext([hit("a", "本文A"), hit("b", "本文B", "社内Wiki")]);
    expect(ctx).toContain("【1】");
    expect(ctx).toContain("【2】");
    expect(ctx).toContain("(社内Wiki)");
  });

  it("maxChars を超えた分は打ち切る(トークン上限に収める)", () => {
    const ctx = buildContext([hit("a", "あ".repeat(100)), hit("b", "い".repeat(100))], { maxChars: 120 });
    expect(ctx).toContain("あ");
    expect(ctx).not.toContain("い");
  });

  it("結果が無ければ空文字", () => {
    expect(buildContext([])).toBe("");
  });
});

describe("cosineSimilarity", () => {
  it("同じ向きなら 1、直交なら 0、逆向きなら -1", () => {
    expect(cosineSimilarity([1, 0], [1, 0])).toBeCloseTo(1);
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0);
    expect(cosineSimilarity([1, 0], [-1, 0])).toBeCloseTo(-1);
  });

  it("正規化されていなくても向きだけで測る", () => {
    expect(cosineSimilarity([3, 0], [7, 0])).toBeCloseTo(1);
  });

  it("次元が違えば 0(モデル差し替え時に偽の一致を出さない)", () => {
    // 短い方に合わせて計算すると、埋め込みモデルを変えたとき先頭だけで比較され、
    // それらしいスコアが出て検索が静かに劣化する
    expect(cosineSimilarity([1, 2, 3], [1, 2])).toBe(0);
    expect(cosineSimilarity([1], [1, 0, 0])).toBe(0);
  });

  it("零ベクトルは 0(0 除算で NaN にしない)", () => {
    expect(cosineSimilarity([0, 0], [1, 1])).toBe(0);
    expect(cosineSimilarity([0, 0], [0, 0])).toBe(0);
  });
});

describe("createMemoryVectorIndex", () => {
  const chunk = (id: string) => ({ id, docId: id, title: id, text: id, index: 0 });

  it("似ている順に返す", async () => {
    const index = createMemoryVectorIndex();
    await index.upsert([
      { id: "same", vector: [1, 0], chunk: chunk("same") },
      { id: "ortho", vector: [0, 1], chunk: chunk("ortho") },
    ]);
    const hits = await index.query([1, 0], 2);
    expect(hits[0]?.chunk.id).toBe("same");
  });

  it("同じ id の upsert は置き換え(重複しない)", async () => {
    const index = createMemoryVectorIndex();
    await index.upsert([{ id: "a", vector: [1, 0], chunk: chunk("a") }]);
    await index.upsert([{ id: "a", vector: [0, 1], chunk: chunk("a") }]);
    expect((await index.query([0, 1], 10)).length).toBe(1);
  });
});

describe("取り込みヘルパー", () => {
  it("textToDocument は 1 件の文書にする", () => {
    const d = textToDocument({ id: "x", title: "題", text: "本文", source: "wiki" });
    expect(d).toMatchObject({ id: "x", title: "題", body: "本文", source: "wiki" });
  });

  it("splitTextToDocuments は空行 3 つ以上で節に分ける", () => {
    const docs = splitTextToDocuments("節1の本文\n\n\n節2の本文", { idPrefix: "m", title: "手順" });
    expect(docs.length).toBe(2);
    expect(docs.map((d) => d.id)).toEqual(["m#0", "m#1"]);
    expect(docs[0]?.title).toBe("手順(1)");
  });

  it("区切りが無ければ 1 件のままにする(無駄に刻まない)", () => {
    const docs = splitTextToDocuments("ひとかたまりの本文", { idPrefix: "m", title: "手順" });
    expect(docs.length).toBe(1);
    expect(docs[0]?.id).toBe("m");
  });
});

describe("boostExactKeyword", () => {
  it("目印がクエリ中の語と完全一致した結果を前に出す", () => {
    const hits = [
      { score: 1, pkg: "mail" },
      { score: 1, pkg: "csv" },
    ];
    const ranked = boostExactKeyword(hits, "CSV を出力したい", (h) => h.pkg);
    expect(ranked[0]?.pkg).toBe("csv");
    expect(ranked[0]?.score).toBe(3); // 既定倍率
  });

  it("**部分一致では上げない**(偶然の一致で順位が動くのを避ける)", () => {
    const hits = [{ score: 1, pkg: "csv-export" }, { score: 2, pkg: "mail" }];
    const ranked = boostExactKeyword(hits, "csv", (h) => h.pkg);
    expect(ranked[0]?.pkg).toBe("mail"); // 元のスコア順のまま
  });

  it("1 文字の語は候補にしない(偶然一致しやすい)", () => {
    const hits = [{ score: 1, pkg: "a" }, { score: 2, pkg: "b" }];
    expect(boostExactKeyword(hits, "a", (h) => h.pkg)[0]?.pkg).toBe("b");
  });

  it("元の配列を書き換えない", () => {
    const hits = [{ score: 1, pkg: "csv" }];
    boostExactKeyword(hits, "csv を出す", (h) => h.pkg);
    expect(hits[0]?.score).toBe(1);
  });
});
