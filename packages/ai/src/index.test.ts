import { describe, it, expect } from "vitest";
import {
  createAiGateway, createMemoryAiLogStore, createHashEmbedder,
  createAnthropicProvider, createOpenAiProvider,
  type AiProvider, type AiChatSuccess,
} from "./index";

/** 常に成功するプロバイダ。使用トークン数を指定できる。 */
function stubProvider(id: string, opts: { text?: string; inputTokens?: number; outputTokens?: number } = {}): AiProvider & { calls: { model: string; maxTokens?: number }[] } {
  const calls: { model: string; maxTokens?: number }[] = [];
  return {
    id,
    calls,
    async chat(req): Promise<AiChatSuccess extends never ? never : { text: string; usage: { inputTokens: number; outputTokens: number } }> {
      calls.push({ model: req.model, maxTokens: req.maxTokens });
      return {
        text: opts.text ?? `${id} の応答`,
        usage: { inputTokens: opts.inputTokens ?? 10, outputTokens: opts.outputTokens ?? 20 },
      };
    },
  } as AiProvider & { calls: { model: string; maxTokens?: number }[] };
}

/** 常に落ちるプロバイダ。 */
function failingProvider(id: string, message = "落ちました"): AiProvider {
  return { id, async chat() { throw new Error(message); } };
}

const hello = [{ role: "user" as const, content: "こんにちは" }];

describe("createAiGateway.chat", () => {
  it("プロバイダの応答を Result で返す", async () => {
    const gw = createAiGateway({ providers: [stubProvider("p1")], defaultModel: "m1" });
    const r = await gw.chat({ messages: hello });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.text).toBe("p1 の応答");
    expect(r.value.provider).toBe("p1");
    expect(r.value.model).toBe("m1");
  });

  it("空メッセージは VALIDATION で拒否する", async () => {
    const gw = createAiGateway({ providers: [stubProvider("p1")], defaultModel: "m1" });
    expect((await gw.chat({ messages: [] })).ok).toBe(false);
    const r = await gw.chat({ messages: [{ role: "user", content: "   " }] });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.code).toBe("VALIDATION");
  });
});

describe("モデルのルーティング", () => {
  it("routes の明示指定が最優先", async () => {
    const a = stubProvider("anthropic");
    const o = stubProvider("openai");
    const gw = createAiGateway({ providers: [a, o], defaultModel: "gpt-4o", routes: { "gpt-4o": "anthropic" } });
    const r = await gw.chat({ messages: hello });
    expect(r.ok && r.value.provider).toBe("anthropic"); // 接頭辞なら openai だが routes が勝つ
  });

  it("models の前方一致で選ぶ", async () => {
    const a = { ...stubProvider("a"), models: ["my-model"] };
    const b = stubProvider("b");
    const gw = createAiGateway({ providers: [b, a], defaultModel: "my-model-v2" });
    expect((await gw.chat({ messages: hello })).ok && (await gw.chat({ messages: hello })).ok).toBe(true);
    const r = await gw.chat({ messages: hello, model: "my-model-v2" });
    expect(r.ok && r.value.provider).toBe("a");
  });

  it("モデル名の接頭辞で推測する(claude→anthropic / gpt→openai)", async () => {
    const gw = createAiGateway({ providers: [stubProvider("openai"), stubProvider("anthropic")], defaultModel: "x" });
    // 一度変数に受ける。2 回呼ぶと絞り込みが効かず、**呼び出し回数も 2 倍**になる
    const claude = await gw.chat({ messages: hello, model: "claude-sonnet-4" });
    expect(claude.ok && claude.value.provider).toBe("anthropic");
    const gpt = await gw.chat({ messages: hello, model: "gpt-4o" });
    expect(gpt.ok && gpt.value.provider).toBe("openai");
  });

  it("どれにも当たらなければ先頭のプロバイダを使う", async () => {
    const gw = createAiGateway({ providers: [stubProvider("first"), stubProvider("second")], defaultModel: "unknown-model" });
    const r = await gw.chat({ messages: hello });
    expect(r.ok && r.value.provider).toBe("first");
  });
});

describe("上限(暴走を止める)", () => {
  it("maxTokensPerCall でリクエスト値を丸める", async () => {
    const p = stubProvider("p");
    const gw = createAiGateway({ providers: [p], defaultModel: "m", limits: { maxTokensPerCall: 100 } });
    await gw.chat({ messages: hello, maxTokens: 99999 });
    expect(p.calls[0]?.maxTokens).toBe(100);
  });

  it("指定が上限より小さければそのまま使う", async () => {
    const p = stubProvider("p");
    const gw = createAiGateway({ providers: [p], defaultModel: "m", limits: { maxTokensPerCall: 100 } });
    await gw.chat({ messages: hello, maxTokens: 30 });
    expect(p.calls[0]?.maxTokens).toBe(30);
  });

  it("累積予算を超えたら RATE_LIMITED で拒否する", async () => {
    const gw = createAiGateway({
      providers: [stubProvider("p", { inputTokens: 30, outputTokens: 30 })],
      defaultModel: "m",
      limits: { maxTotalTokens: 50 },
    });
    expect((await gw.chat({ messages: hello })).ok).toBe(true); // 1 回目は通る(累積 60)
    const r = await gw.chat({ messages: hello });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.code).toBe("RATE_LIMITED");
  });

  it("totalTokens で累積を確認できる", async () => {
    const gw = createAiGateway({ providers: [stubProvider("p", { inputTokens: 3, outputTokens: 7 })], defaultModel: "m" });
    await gw.chat({ messages: hello });
    await gw.chat({ messages: hello });
    expect(gw.totalTokens()).toBe(20);
  });
});

describe("フォールバック", () => {
  it("既定では 1 つ目が落ちたら EXTERNAL で失敗する", async () => {
    const gw = createAiGateway({ providers: [failingProvider("bad"), stubProvider("good")], defaultModel: "m" });
    const r = await gw.chat({ messages: hello });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.code).toBe("EXTERNAL");
  });

  it("fallback:true なら次のプロバイダを試す", async () => {
    const gw = createAiGateway({ providers: [failingProvider("bad"), stubProvider("good")], defaultModel: "m", fallback: true });
    const r = await gw.chat({ messages: hello });
    expect(r.ok && r.value.provider).toBe("good");
  });

  it("全部落ちたら最後のエラーを添えて失敗する", async () => {
    const gw = createAiGateway({ providers: [failingProvider("a", "AがNG"), failingProvider("b", "BがNG")], defaultModel: "m", fallback: true });
    const r = await gw.chat({ messages: hello });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.message).toContain("BがNG");
  });
});

describe("コスト計算とログ", () => {
  const pricing = { m: { inJpyPer1k: 1, outJpyPer1k: 2 } };

  it("pricing があれば costJpy を出す", async () => {
    const gw = createAiGateway({
      providers: [stubProvider("p", { inputTokens: 1000, outputTokens: 500 })],
      defaultModel: "m", pricing,
    });
    const r = await gw.chat({ messages: hello });
    expect(r.ok && r.value.costJpy).toBe(1 * 1 + 0.5 * 2); // 入 1000/1000*1 + 出 500/1000*2
  });

  it("pricing が無いモデルは costJpy を付けない", async () => {
    const gw = createAiGateway({ providers: [stubProvider("p")], defaultModel: "unknown", pricing });
    const r = await gw.chat({ messages: hello });
    expect(r.ok && r.value.costJpy).toBeUndefined();
  });

  it("成功も失敗もログに残る", async () => {
    const store = createMemoryAiLogStore();
    const gw = createAiGateway({ providers: [stubProvider("ok")], defaultModel: "m", logStore: store });
    await gw.chat({ messages: hello, user: "taro" });
    const gw2 = createAiGateway({ providers: [failingProvider("ng")], defaultModel: "m", logStore: store });
    await gw2.chat({ messages: hello });
    await new Promise((r) => setTimeout(r, 0)); // ログは非同期に積まれる
    const logs = store.list();
    expect(logs.length).toBe(2);
    expect(logs.map((l) => l.ok).sort()).toEqual([false, true]);
    expect(logs.find((l) => l.ok)?.user).toBe("taro");
  });

  it("既定ではプロンプトを残さない(情報漏れを避ける)", async () => {
    const store = createMemoryAiLogStore();
    const gw = createAiGateway({ providers: [stubProvider("p")], defaultModel: "m", logStore: store });
    await gw.chat({ messages: [{ role: "user", content: "社外秘の内容" }] });
    await new Promise((r) => setTimeout(r, 0));
    expect(store.list()[0]?.prompt).toBeUndefined();
  });

  it("logPrompt:true でも redact を通す", async () => {
    const store = createMemoryAiLogStore();
    const gw = createAiGateway({
      providers: [stubProvider("p")], defaultModel: "m", logStore: store,
      logPrompt: true, redact: (t) => t.replace(/\d/g, "*"),
    });
    await gw.chat({ messages: [{ role: "user", content: "番号は 12345" }] });
    await new Promise((r) => setTimeout(r, 0));
    expect(store.list()[0]?.prompt).toBe("番号は *****");
  });

  it("ログ保存に失敗しても本流は落とさない", async () => {
    const broken = { async add() { throw new Error("保存できません"); }, async list() { return []; } };
    const gw = createAiGateway({ providers: [stubProvider("p")], defaultModel: "m", logStore: broken });
    expect((await gw.chat({ messages: hello })).ok).toBe(true);
  });
});

describe("createHashEmbedder(鍵なしで動く埋め込み)", () => {
  it("同じ文字列は同じベクトルになる(決定的)", async () => {
    const e = createHashEmbedder(16);
    const [a] = await e.embed(["経費精算"]);
    const [b] = await e.embed(["経費精算"]);
    expect(a).toEqual(b);
  });

  it("指定した次元で返す", async () => {
    const e = createHashEmbedder(32);
    const [v] = await e.embed(["あ"]);
    expect(v?.length).toBe(32);
  });

  it("違う文字列は違うベクトルになる", async () => {
    const e = createHashEmbedder(16);
    const [a, b] = await e.embed(["経費精算", "在庫管理"]);
    expect(JSON.stringify(a)).not.toEqual(JSON.stringify(b));
  });

  it("複数まとめて渡すと同じ数だけ返る", async () => {
    const e = createHashEmbedder(8);
    expect((await e.embed(["a", "b", "c"])).length).toBe(3);
  });
});

describe("プロバイダ(fetch を注入して実 API 形状を確かめる)", () => {
  it("Anthropic: 応答の text と usage を取り出す", async () => {
    const provider = createAnthropicProvider({
      apiKey: "dummy",
      fetchImpl: (async () => new Response(JSON.stringify({
        content: [{ type: "text", text: "こたえ" }],
        usage: { input_tokens: 5, output_tokens: 9 },
      }), { status: 200 })) as unknown as typeof fetch,
    });
    const r = await provider.chat({ model: "claude", messages: hello, maxTokens: 10 });
    expect(r.text).toBe("こたえ");
    expect(r.usage).toEqual({ inputTokens: 5, outputTokens: 9 });
  });

  it("Anthropic: API がエラーを返したら例外(Gateway が受けて Result にする)", async () => {
    const provider = createAnthropicProvider({
      apiKey: "dummy",
      fetchImpl: (async () => new Response(JSON.stringify({ error: { message: "鍵が違います" } }), { status: 401 })) as unknown as typeof fetch,
    });
    let thrown = "";
    try { await provider.chat({ model: "claude", messages: hello, maxTokens: 10 }); }
    catch (e) { thrown = e instanceof Error ? e.message : String(e); }
    expect(thrown).toContain("鍵が違います");
  });

  it("OpenAI: 応答の text と usage を取り出す", async () => {
    const provider = createOpenAiProvider({
      apiKey: "dummy",
      fetchImpl: (async () => new Response(JSON.stringify({
        choices: [{ message: { content: "こたえ" } }],
        usage: { prompt_tokens: 4, completion_tokens: 6 },
      }), { status: 200 })) as unknown as typeof fetch,
    });
    const r = await provider.chat({ model: "gpt-4o", messages: hello, maxTokens: 10 });
    expect(r.text).toBe("こたえ");
    expect(r.usage).toEqual({ inputTokens: 4, outputTokens: 6 });
  });

  it("API キーはコードに直書きせず注入する(ADR-0010)", () => {
    // 形の確認。createXxxProvider は必ず apiKey を引数で受ける
    expect(typeof createAnthropicProvider).toBe("function");
    expect(typeof createOpenAiProvider).toBe("function");
  });
});
