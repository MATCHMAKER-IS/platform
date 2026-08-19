// public-api: デモ用。社内資料の検索結果を渡して回答を生成する
/**
 * 社内資料アシスタントの回答生成。
 *
 * ブラウザから直接 LLM を叩かない理由は連携先と同じ:
 *   1. 鍵が画面側に露出する
 *   2. 利用量と費用を誰も把握できなくなる
 * そのため **必ず @platform/ai のゲートウェイを通す**(ADR 0010)。
 * ゲートウェイが担当するのは、モデルの差し替え・トークン上限・費用の記録・
 * 失敗時のフォールバック・ログのマスクで、アプリはそれを意識しない。
 *
 * 鍵(ANTHROPIC_API_KEY / OPENAI_API_KEY)が無い環境では、
 * **何を設定すれば動くか**を返す。動かないことを黙って隠さない。
 */
import { NextResponse } from "next/server";
import { createAiGateway, type AiProvider, type AiCallLog } from "@platform/ai";
import { createRateLimiter, createMemoryStore } from "@platform/ratelimit/browser";
import { handleRoute } from "@platform/http";
// **呼び出し元の見分け方は基盤に 1 つ**（同じ 3 行が 8 ファイルに散っていた）
import { clientIp } from "@platform/guard";
import { validate, z } from "@platform/validation";
import { showcaseEnv } from "../../../server/env";

/**
 * **回数を制限する。** AI の呼び出しは 1 回ごとに費用が出るため、
 * 認証の要らない口を無防備に置くと、**叩かれた分だけ請求が来る**。
 *
 * メモリ実装なのでサーバごとに数える(複数台なら Redis 実装に差し替える)。
 * 1 分あたり 10 回は、人が使う分には十分で、機械的な連打は止まる程度。
 */
const limiter = createRateLimiter({
  store: createMemoryStore(),
  limit: 10,
  windowSeconds: 60,
});

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 送信前に伏せる。ログにも生の値を残さないため、ゲートウェイの redact に渡す。 */
function redact(text: string): string {
  return text
    .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, "[メール]")
    .replace(/\b0\d{1,4}-\d{1,4}-\d{3,4}\b/g, "[電話]")
    .replace(/\b\d{12}\b/g, "[番号]")
    .replace(/(sk|pk|whsec|re)_[A-Za-z0-9_-]{8,}/g, "[鍵]");
}

/** Anthropic の Messages API を最小限だけ叩くプロバイダ。 */
function anthropicProvider(apiKey: string): AiProvider {
  return {
    id: "anthropic",
    models: ["claude-"],
    async chat(req) {
      // **時間を切る。** 相手が応答しないと画面が待ち続ける
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        signal: AbortSignal.timeout(60_000),
        // **リダイレクトを追わない。** 送り先が差し替えられたとき、
        // 問い合わせの内容と API キーが別の場所へ渡る
        redirect: "manual",
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: req.model,
          max_tokens: req.maxTokens ?? 1024,
          temperature: req.temperature ?? 0,
          system: req.messages.find((m) => m.role === "system")?.content,
          messages: req.messages.filter((m) => m.role !== "system").map((m) => ({ role: m.role, content: m.content })),
        }),
      });
      if (!res.ok) throw new Error(`Anthropic API が ${res.status} を返しました`);
      const json = (await res.json()) as {
        content: { type: string; text?: string }[];
        usage: { input_tokens: number; output_tokens: number };
      };
      return {
        text: json.content.filter((c) => c.type === "text").map((c) => c.text ?? "").join(""),
        usage: { inputTokens: json.usage.input_tokens, outputTokens: json.usage.output_tokens },
      };
    },
  };
}

async function handlePOST(req: Request): Promise<Response> {
  // **本文を読む前に判定する。** 読んでから弾くと、その分の資源は使われている
  const rl = await limiter.check(`assistant:${clientIp(req)}`);
  if (rl.ok && !rl.value.allowed) {
    return NextResponse.json(
      { ok: false, message: "呼び出しが多すぎます。しばらく待ってからやり直してください" },
      { status: 429, headers: { "Retry-After": "60" } },
    );
  }

  // **長さに上限を設ける。** AI 呼び出しは文字数に応じて費用が変わる——
  // 無制限だと「1 分 10 回」の制限があっても、1 回あたりの費用で
  // コストを膨らませられる(2026-08 に発見)。
  const AssistantInput = z.object({
    question: z.string().max(2000).default(""),
    context: z.string().max(4000).default(""),
    history: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(2000) })).max(20).default([]),
  });

  const parsed = validate(AssistantInput, await req.json().catch(() => ({})));
  if (!parsed.ok) {
    return NextResponse.json({ ok: false, message: parsed.error.message }, { status: 400 });
  }
  const body = parsed.value;

  const question = body.question.trim();
  const context = body.context.trim();
  if (question === "" || context === "") {
    return NextResponse.json({ ok: false, message: "question と context が必要です" }, { status: 400 });
  }

  const apiKey = showcaseEnv.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json({
      ok: false,
      configured: false,
      message: "AI の鍵が設定されていないため、回答は生成できません。",
      hint: "サーバの環境変数に ANTHROPIC_API_KEY を設定して再起動すると、この画面から回答まで生成できます。実運用では @platform/env で起動時に検証し、@platform/secrets 経由で読みます。",
    });
  }

  // 呼び出しの記録先。実運用では DB やログ基盤へ流す(ここでは 1 リクエスト分だけ返す)
  const logs: AiCallLog[] = [];

  // 会話履歴は直近だけを渡す。全部渡すと入力トークンが際限なく増え、費用も応答時間も伸びる。
  const history = (body.history ?? [])
    .filter((m) => m.role === "user" || m.role === "assistant")
    .slice(-6)
    .map((m) => ({ role: m.role, content: m.content.slice(0, 2000) }));

  const gateway = createAiGateway({
    providers: [anthropicProvider(apiKey)],
    defaultModel: "claude-sonnet-4-5",
    // 料金を登録しておくと、応答に概算費用が付く(1000 トークンあたりの円)
    pricing: { "claude-sonnet-4-5": { inJpyPer1k: 0.45, outJpyPer1k: 2.25 } },
    limits: { maxTokensPerCall: 800 },
    fallback: true,
    redact,
    logStore: { add: (log) => { logs.push(log); } },
  });

  const result = await gateway.chat({
    messages: [
      {
        role: "system",
        content:
          "あなたは社内基盤の案内役です。与えられた資料だけを根拠に、日本語で簡潔に答えてください。" +
          "資料に書かれていないことは「資料には見当たりません」と答えてください。" +
          "最後に、根拠にした資料のパスを列挙してください。" +
          "会話の続きでは、直前までのやり取りも踏まえて答えてください。",
      },
      ...history,
      { role: "user", content: `# 質問\n${question}\n\n# 資料\n${context}` },
    ],
    user: "assistant-demo",
  });

  if (!result.ok) {
    return NextResponse.json({
      ok: false,
      configured: true,
      message: `生成に失敗しました: ${result.error.message}`,
      hint: "鍵の有効性、モデル名、ネットワーク経路を確認してください。",
    });
  }

  const { text, model, provider, usage, latencyMs, costJpy } = result.value;
  return NextResponse.json({
    ok: true,
    configured: true,
    answer: text,
    meta: { model, provider, usage, latencyMs, costJpy },
    log: logs[0] ?? null,
  });
}

export const POST = handleRoute(handlePOST);
