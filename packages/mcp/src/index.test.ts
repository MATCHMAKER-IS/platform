import { describe, it, expect } from "vitest";
import {
  parseJsonRpc, handleMcpMessage, textResult, errorResult, jsonResult,
  extractBearerToken, SUPPORTED_PROTOCOL_VERSIONS,
  type McpServerOptions, type JsonRpcRequest,
} from "./index";

const req = (method: string, params?: Record<string, unknown>, id: number | string | null = 1): JsonRpcRequest =>
  ({ jsonrpc: "2.0", method, ...(params ? { params } : {}), ...(id === null ? {} : { id }) }) as JsonRpcRequest;

const server = (over: Partial<McpServerOptions> = {}): McpServerOptions => ({
  name: "test-server",
  version: "1.0.0",
  tools: [
    {
      name: "echo",
      description: "受け取った文字列をそのまま返す",
      inputSchema: { type: "object", properties: { text: { type: "string" } } },
      handler: async (args) => textResult(String(args.text ?? "")),
    },
    {
      name: "boom",
      description: "必ず失敗する",
      inputSchema: { type: "object", properties: {} },
      handler: async () => { throw new Error("壊れました"); },
    },
    {
      name: "wipe",
      description: "破壊的な操作",
      destructive: true,
      inputSchema: { type: "object", properties: {} },
      handler: async () => textResult("消しました"),
    },
  ],
  ...over,
});

describe("parseJsonRpc", () => {
  it("正しい JSON-RPC を受け付ける", () => {
    const r = parseJsonRpc('{"jsonrpc":"2.0","method":"ping","id":1}');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.method).toBe("ping");
  });

  it("壊れた JSON は -32700(Parse error)", () => {
    const r = parseJsonRpc("{ これは JSON ではない");
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.error?.code).toBe(-32700);
  });

  it("jsonrpc が 2.0 でなければ -32600(Invalid Request)", () => {
    const r = parseJsonRpc('{"jsonrpc":"1.0","method":"ping","id":1}');
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.error?.code).toBe(-32600);
  });

  it("method が無ければ -32600", () => {
    const r = parseJsonRpc('{"jsonrpc":"2.0","id":1}');
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.error?.code).toBe(-32600);
  });
});

describe("initialize", () => {
  it("サーバ情報と対応プロトコルを返す", async () => {
    const res = await handleMcpMessage(server(), req("initialize"));
    const result = res?.result as { protocolVersion: string; serverInfo: { name: string; version: string } };
    expect(result.serverInfo).toEqual({ name: "test-server", version: "1.0.0" });
    expect(SUPPORTED_PROTOCOL_VERSIONS.includes(result.protocolVersion as never)).toBe(true);
  });

  it("クライアントが対応版を指定すればそれに合わせる", async () => {
    const res = await handleMcpMessage(server(), req("initialize", { protocolVersion: "2024-11-05" }));
    expect((res?.result as { protocolVersion: string }).protocolVersion).toBe("2024-11-05");
  });

  it("未知の版を指定されたら既定(最新)にフォールバックする", async () => {
    const res = await handleMcpMessage(server(), req("initialize", { protocolVersion: "1999-01-01" }));
    expect((res?.result as { protocolVersion: string }).protocolVersion).toBe(SUPPORTED_PROTOCOL_VERSIONS[0]);
  });

  it("resources / prompts を持つときだけ capabilities に出す", async () => {
    const bare = await handleMcpMessage(server(), req("initialize"));
    expect(Object.keys((bare?.result as { capabilities: Record<string, unknown> }).capabilities)).toEqual(["tools"]);

    const rich = await handleMcpMessage(
      server({ resources: [{ uri: "mem://a", name: "a", read: async () => "本文" }] }),
      req("initialize"),
    );
    expect(Object.keys((rich?.result as { capabilities: Record<string, unknown> }).capabilities)).toContain("resources");
  });
});

describe("通知(id 無し)には応答しない", () => {
  it("notifications/initialized は null", async () => {
    expect(await handleMcpMessage(server(), req("notifications/initialized", undefined, null))).toBe(null);
  });

  it("id 無しの ping は null(JSON-RPC の規定)", async () => {
    expect(await handleMcpMessage(server(), req("ping", undefined, null))).toBe(null);
  });

  it("id 付きの ping は空の結果を返す", async () => {
    const res = await handleMcpMessage(server(), req("ping"));
    expect(res?.result).toEqual({});
  });

  it("未対応メソッドでも id 無しなら黙る", async () => {
    expect(await handleMcpMessage(server(), req("no/such/method", undefined, null))).toBe(null);
  });

  it("未対応メソッドは -32601(Method not found)", async () => {
    const res = await handleMcpMessage(server(), req("no/such/method"));
    expect(res?.error?.code).toBe(-32601);
  });
});

describe("tools/list", () => {
  it("登録したツールを名前・説明・スキーマ付きで返す", async () => {
    const res = await handleMcpMessage(server(), req("tools/list"));
    const tools = (res?.result as { tools: { name: string; description: string }[] }).tools;
    expect(tools.map((t) => t.name)).toEqual(["echo", "boom", "wipe"]);
    expect(tools[0]?.description).toBe("受け取った文字列をそのまま返す");
  });

  it("destructive なツールには注意書き(annotations)を付ける", async () => {
    const res = await handleMcpMessage(server(), req("tools/list"));
    const tools = (res?.result as { tools: { name: string; annotations?: { destructiveHint?: boolean } }[] }).tools;
    expect(tools.find((t) => t.name === "wipe")?.annotations?.destructiveHint).toBe(true);
    expect(tools.find((t) => t.name === "echo")?.annotations).toBeUndefined();
  });
});

describe("tools/call", () => {
  it("引数を渡して実行できる", async () => {
    const res = await handleMcpMessage(server(), req("tools/call", { name: "echo", arguments: { text: "やあ" } }));
    expect(JSON.stringify(res?.result)).toContain("やあ");
  });

  it("引数が無くても呼べる(既定は空オブジェクト)", async () => {
    const res = await handleMcpMessage(server(), req("tools/call", { name: "echo" }));
    expect(res?.error).toBeUndefined();
  });

  it("未知のツールは -32602(Invalid params)", async () => {
    const res = await handleMcpMessage(server(), req("tools/call", { name: "nope" }));
    expect(res?.error?.code).toBe(-32602);
  });

  it("**ツール内の例外は RPC エラーにせず、結果として返す**", async () => {
    // ツールが落ちても接続は生きている。エラーにすると AI 側が会話ごと切ってしまう
    const res = await handleMcpMessage(server(), req("tools/call", { name: "boom" }));
    expect(res?.error).toBeUndefined();
    expect(JSON.stringify(res?.result)).toContain("壊れました");
    expect((res?.result as { isError?: boolean }).isError).toBe(true);
  });
});

describe("authorizeTool(呼び出し側の権限で止める)", () => {
  // **戻り値は `true | string`**(`false` は無い)。
  // 拒否は**理由の文字列**で返す——「なぜ止まったか」を呼び出し側に伝えるため。
  // `boolean` で受けると `false` が入りうるので代入できない(2026-08、型検査で判明)。
  const withAuth = (verdict: true | string) =>
    server({ authorizeTool: () => verdict });

  it("true なら実行できる", async () => {
    const res = await handleMcpMessage(withAuth(true), req("tools/call", { name: "echo", arguments: { text: "ok" } }));
    expect(JSON.stringify(res?.result)).toContain("ok");
  });

  // **`false` は返せない**(実型は `true | string`)。
  // 拒否は**理由の文字列**で返す——「なぜ止まったか」を呼び出し側に伝えるため。
  // 2026-08 まで `false` を渡すテストがあり、実型と食い違っていた。
  it("true 以外なら実行せずに断る", async () => {
    const res = await handleMcpMessage(withAuth("権限がありません"), req("tools/call", { name: "echo", arguments: { text: "ng" } }));
    expect(JSON.stringify(res?.result)).not.toContain("ng");
    expect((res?.result as { isError?: boolean }).isError).toBe(true);
  });

  it("文字列を返すとその理由を伝える", async () => {
    const res = await handleMcpMessage(withAuth("経理部のみ実行できます"), req("tools/call", { name: "echo" }));
    expect(JSON.stringify(res?.result)).toContain("経理部のみ");
  });

  // **`McpCallContext` が持つのは `subject`**(認証済みの主体と scope)。
  // 2026-08 まで `ctx.user` を見ており、**存在しないプロパティ**だった
  // ——`undefined` が入るので、`authorizeTool` で誰が呼んだか判断できない。
  it("呼び出しコンテキストが渡る", async () => {
    let seen: unknown;
    const opts = server({ authorizeTool: (_tool, ctx) => { seen = ctx.subject?.id; return true; } });
    await handleMcpMessage(opts, req("tools/call", { name: "echo" }), { subject: { id: "taro", scopes: [] } });
    expect(seen).toBe("taro");
  });
});

describe("resources / prompts", () => {
  const opts = server({
    resources: [{ uri: "mem://doc", name: "資料", mimeType: "text/plain", read: async () => "本文です" }],
    prompts: [{ name: "greet", description: "あいさつ", build: (a) => [{ role: "user", content: `やあ ${a.name ?? ""}` }] }],
  });

  it("resources/list で一覧が取れる", async () => {
    const res = await handleMcpMessage(opts, req("resources/list"));
    expect((res?.result as { resources: { uri: string }[] }).resources[0]?.uri).toBe("mem://doc");
  });

  it("resources/read で中身が取れる", async () => {
    const res = await handleMcpMessage(opts, req("resources/read", { uri: "mem://doc" }));
    expect(JSON.stringify(res?.result)).toContain("本文です");
  });

  it("未知の URI は -32602", async () => {
    const res = await handleMcpMessage(opts, req("resources/read", { uri: "mem://nope" }));
    expect(res?.error?.code).toBe(-32602);
  });

  it("読み取りが落ちたら -32603(Internal error)", async () => {
    const broken = server({ resources: [{ uri: "mem://x", name: "x", read: async () => { throw new Error("読めません"); } }] });
    const res = await handleMcpMessage(broken, req("resources/read", { uri: "mem://x" }));
    expect(res?.error?.code).toBe(-32603);
  });

  it("prompts/get は引数を差し込んだメッセージを返す", async () => {
    const res = await handleMcpMessage(opts, req("prompts/get", { name: "greet", arguments: { name: "太郎" } }));
    expect(JSON.stringify(res?.result)).toContain("やあ 太郎");
  });

  it("未知のプロンプトは -32602", async () => {
    const res = await handleMcpMessage(opts, req("prompts/get", { name: "nope" }));
    expect(res?.error?.code).toBe(-32602);
  });
});

describe("結果の組み立て", () => {
  it("textResult は text 型で返す", () => {
    expect(textResult("あ")).toEqual({ content: [{ type: "text", text: "あ" }] });
  });

  it("errorResult は isError を立てる(AI 側が失敗と分かる)", () => {
    expect(errorResult("だめ").isError).toBe(true);
  });

  it("jsonResult は JSON を読める形にして返す(往復できる)", () => {
    const r = jsonResult({ a: 1, b: ["x"] });
    const text = (r.content[0] as { type: string; text: string }).text;
    expect(JSON.parse(text)).toEqual({ a: 1, b: ["x"] });
  });
});

describe("extractBearerToken", () => {
  it("Bearer トークンを取り出す", () => {
    expect(extractBearerToken("Bearer abc123")).toBe("abc123");
  });

  it("大文字小文字を問わない", () => {
    expect(extractBearerToken("bearer abc123")).toBe("abc123");
  });

  it("前後の空白は落とす", () => {
    expect(extractBearerToken("Bearer   abc123  ")).toBe("abc123");
  });

  it("無い / 空 / 別方式は null", () => {
    expect(extractBearerToken(null)).toBe(null);
    expect(extractBearerToken(undefined)).toBe(null);
    expect(extractBearerToken("")).toBe(null);
    expect(extractBearerToken("Basic abc")).toBe(null);
    expect(extractBearerToken("Bearer    ")).toBe(null);
  });
});
